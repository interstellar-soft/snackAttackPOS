using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PosBackend.Application.Requests;
using PosBackend.Application.Responses;
using PosBackend.Application.Services;
using PosBackend.Infrastructure.Data;
using PosBackend.Domain.Entities;

namespace PosBackend.Features.Products;

[ApiController]
[Route("api/products")]
[Authorize]
public class ProductsController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly MlClient _mlClient;
    private readonly ScanWatchdog _watchdog;
    private readonly CurrencyService _currencyService;

    public ProductsController(
        ApplicationDbContext db,
        MlClient mlClient,
        ScanWatchdog watchdog,
        CurrencyService currencyService)
    {
        _db = db;
        _mlClient = mlClient;
        _watchdog = watchdog;
        _currencyService = currencyService;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<ProductResponse>>> GetProducts(CancellationToken cancellationToken)
    {
        var products = await _db.Products
            .Include(p => p.Category)
            .AsNoTracking()
            .OrderBy(p => p.Name)
            .ToListAsync(cancellationToken);

        var responses = products.Select(ToResponse).ToList();
        return Ok(responses);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ProductResponse>> GetProductById(Guid id, CancellationToken cancellationToken)
    {
        var product = await _db.Products
            .Include(p => p.Category)
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == id, cancellationToken);

        if (product is null)
        {
            return NotFound();
        }

        var response = ToResponse(product);
        return Ok(response);
    }

    [HttpPost]
    public async Task<ActionResult<ProductResponse>> CreateProduct([FromBody] CreateProductRequest request, CancellationToken cancellationToken)
    {
        var (errors, category) = await ValidateAsync(request, null, cancellationToken);
        if (errors.Count > 0)
        {
            return CreateValidationProblem(errors);
        }

        var priceResult = await TryResolvePricesAsync(request, cancellationToken);
        if (!priceResult.Succeeded)
        {
            return CreateValidationProblem(priceResult.Errors);
        }

        var product = new Product
        {
            Name = request.Name!,
            Sku = request.Sku!,
            Barcode = request.Barcode!,
            Description = NormalizeOptional(request.Description),
            CategoryId = request.CategoryId,
            PriceUsd = priceResult.PriceUsd,
            PriceLbp = priceResult.PriceLbp,
            IsActive = true,
            IsPinned = request.IsPinned
        };

        _db.Products.Add(product);
        await _db.SaveChangesAsync(cancellationToken);

        product.Category = category;
        var response = ToResponse(product);
        return CreatedAtAction(nameof(GetProductById), new { id = response.Id }, response);
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ProductResponse>> UpdateProduct(Guid id, [FromBody] UpdateProductRequest request, CancellationToken cancellationToken)
    {
        var product = await _db.Products.Include(p => p.Category)
            .FirstOrDefaultAsync(p => p.Id == id, cancellationToken);
        if (product is null)
        {
            return NotFound();
        }

        var (errors, category) = await ValidateAsync(request, id, cancellationToken);
        if (errors.Count > 0)
        {
            return CreateValidationProblem(errors);
        }

        var priceResult = await TryResolvePricesAsync(request, cancellationToken);
        if (!priceResult.Succeeded)
        {
            return CreateValidationProblem(priceResult.Errors);
        }

        product.Name = request.Name!;
        product.Sku = request.Sku!;
        product.Barcode = request.Barcode!;
        product.Description = NormalizeOptional(request.Description);
        product.CategoryId = request.CategoryId;
        product.PriceUsd = priceResult.PriceUsd;
        product.PriceLbp = priceResult.PriceLbp;
        product.IsPinned = request.IsPinned;
        product.Category = category;
        product.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(cancellationToken);

        var response = ToResponse(product);
        return Ok(response);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteProduct(Guid id, CancellationToken cancellationToken)
    {
        var product = await _db.Products.FindAsync(new object?[] { id }, cancellationToken);
        if (product is null)
        {
            return NotFound();
        }

        _db.Products.Remove(product);
        await _db.SaveChangesAsync(cancellationToken);

        return NoContent();
    }

    [HttpGet("search")]
    public async Task<ActionResult<IEnumerable<ProductResponse>>> Search([FromQuery] string? q, [FromQuery] bool? pinnedOnly, CancellationToken cancellationToken)
    {
        var query = _db.Products.Include(p => p.Category).AsQueryable();
        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = q.ToLower();
            query = query.Where(p => p.Name.ToLower().Contains(term) || p.Sku.ToLower().Contains(term) || p.Barcode.Contains(term));
        }

        if (pinnedOnly == true)
        {
            query = query.Where(p => p.IsPinned);
        }

        var products = await query
            .OrderBy(p => p.Name)
            .Take(50)
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        var results = products.Select(ToResponse).ToList();

        return Ok(results);
    }

    [HttpPost("scan")]
    public async Task<ActionResult<ProductResponse>> Scan([FromBody] ScanRequest request, CancellationToken cancellationToken)
    {
        var product = await _db.Products.Include(p => p.Category)
            .FirstOrDefaultAsync(p => p.Barcode == request.Barcode, cancellationToken);
        if (product is null)
        {
            return NotFound();
        }

        var userId = User.FindFirst("sub")?.Value ?? "anonymous";
        var rapid = _watchdog.IsRapidRepeat(userId, product.Sku);
        var anomaly = await _mlClient.PredictAnomalyAsync(new MlClient.AnomalyRequest(product.Sku, product.PriceUsd, 1), cancellationToken);

        var flagged = rapid || (anomaly?.IsAnomaly ?? false);
        var reason = rapid ? "rapid_repeat_scan" : anomaly?.Reason;

        return new ProductResponse
        {
            Id = product.Id,
            Sku = product.Sku,
            Name = product.Name,
            Barcode = product.Barcode,
            PriceUsd = product.PriceUsd,
            PriceLbp = product.PriceLbp,
            Description = product.Description,
            Category = product.Category?.Name ?? string.Empty,
            IsPinned = product.IsPinned,
            IsFlagged = flagged,
            FlagReason = reason
        };
    }

    private ProductResponse ToResponse(Product product)
    {
        return new ProductResponse
        {
            Id = product.Id,
            Sku = product.Sku,
            Name = product.Name,
            Barcode = product.Barcode,
            PriceUsd = product.PriceUsd,
            PriceLbp = product.PriceLbp,
            Description = product.Description,
            Category = product.Category?.Name ?? string.Empty,
            IsPinned = product.IsPinned
        };
    }

    private async Task<(Dictionary<string, string[]>, Category?)> ValidateAsync(
        ProductMutationRequestBase request,
        Guid? existingProductId,
        CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, List<string>>(StringComparer.Ordinal);

        if (string.IsNullOrWhiteSpace(request.Name))
        {
            AddError(errors, nameof(request.Name), "Name is required.");
        }
        else
        {
            request.Name = request.Name.Trim();
        }

        if (string.IsNullOrWhiteSpace(request.Sku))
        {
            AddError(errors, nameof(request.Sku), "SKU is required.");
        }
        else
        {
            request.Sku = request.Sku.Trim();
        }

        if (string.IsNullOrWhiteSpace(request.Barcode))
        {
            AddError(errors, nameof(request.Barcode), "Barcode is required.");
        }
        else
        {
            request.Barcode = request.Barcode.Trim();
        }

        if (request.Price is null)
        {
            AddError(errors, nameof(request.Price), "Price is required.");
        }
        else if (request.Price.Value < 0)
        {
            AddError(errors, nameof(request.Price), "Price cannot be negative.");
        }

        var currency = NormalizeCurrency(request.Currency);
        if (currency is null)
        {
            AddError(errors, nameof(request.Currency), "Currency must be either USD or LBP.");
        }
        else
        {
            request.Currency = currency;
        }

        if (request.CategoryId == Guid.Empty)
        {
            AddError(errors, nameof(request.CategoryId), "CategoryId is required.");
        }

        if (!errors.ContainsKey(nameof(request.Sku)))
        {
            var skuExists = await _db.Products
                .AnyAsync(p => p.Sku == request.Sku && (!existingProductId.HasValue || p.Id != existingProductId.Value), cancellationToken);
            if (skuExists)
            {
                AddError(errors, nameof(request.Sku), "SKU must be unique.");
            }
        }

        if (!errors.ContainsKey(nameof(request.Barcode)))
        {
            var barcodeExists = await _db.Products
                .AnyAsync(p => p.Barcode == request.Barcode && (!existingProductId.HasValue || p.Id != existingProductId.Value), cancellationToken);
            if (barcodeExists)
            {
                AddError(errors, nameof(request.Barcode), "Barcode must be unique.");
            }
        }

        Category? category = null;
        if (!errors.ContainsKey(nameof(request.CategoryId)))
        {
            category = await _db.Categories
                .FirstOrDefaultAsync(c => c.Id == request.CategoryId, cancellationToken);
            if (category is null)
            {
                AddError(errors, nameof(request.CategoryId), "Category not found.");
            }
        }

        var materialized = errors.ToDictionary(
            pair => pair.Key,
            pair => pair.Value.ToArray(),
            StringComparer.Ordinal);

        return (materialized, category);
    }

    private async Task<PriceComputationResult> TryResolvePricesAsync(ProductMutationRequestBase request, CancellationToken cancellationToken)
    {
        if (request.Price is not decimal priceValue)
        {
            return PriceComputationResult.Failure(new Dictionary<string, string[]>
            {
                [nameof(request.Price)] = new[] { "Price is required." }
            });
        }

        if (priceValue < 0)
        {
            return PriceComputationResult.Failure(new Dictionary<string, string[]>
            {
                [nameof(request.Price)] = new[] { "Price cannot be negative." }
            });
        }

        try
        {
            var rate = await _currencyService.GetCurrentRateAsync(cancellationToken);
            var currency = request.Currency ?? "USD";

            decimal priceUsd;
            decimal priceLbp;

            if (currency == "LBP")
            {
                priceLbp = _currencyService.RoundLbp(priceValue);
                priceUsd = _currencyService.ConvertLbpToUsd(priceLbp, rate.Rate);
            }
            else
            {
                priceUsd = _currencyService.RoundUsd(priceValue);
                priceLbp = _currencyService.ConvertUsdToLbp(priceUsd, rate.Rate);
            }

            return PriceComputationResult.Success(priceUsd, priceLbp);
        }
        catch (InvalidOperationException)
        {
            return PriceComputationResult.Failure(new Dictionary<string, string[]>
            {
                [nameof(request.Currency)] = new[] { "Exchange rate is not configured." }
            });
        }
    }

    private ActionResult CreateValidationProblem(IDictionary<string, string[]> errors)
    {
        ModelState.Clear();
        foreach (var error in errors)
        {
            foreach (var message in error.Value)
            {
                ModelState.AddModelError(error.Key, message);
            }
        }

        return ValidationProblem(ModelState);
    }

    private static void AddError(Dictionary<string, List<string>> errors, string key, string message)
    {
        if (!errors.TryGetValue(key, out var list))
        {
            list = new List<string>();
            errors[key] = list;
        }

        list.Add(message);
    }

    private static string? NormalizeOptional(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static string? NormalizeCurrency(string? currency)
    {
        if (string.IsNullOrWhiteSpace(currency))
        {
            return "USD";
        }

        var trimmed = currency.Trim().ToUpperInvariant();
        return trimmed is "USD" or "LBP" ? trimmed : null;
    }

    private sealed record PriceComputationResult(bool Succeeded, decimal PriceUsd, decimal PriceLbp, IDictionary<string, string[]> Errors)
    {
        public static PriceComputationResult Success(decimal priceUsd, decimal priceLbp) =>
            new(true, priceUsd, priceLbp, new Dictionary<string, string[]>(StringComparer.Ordinal));

        public static PriceComputationResult Failure(IDictionary<string, string[]> errors) =>
            new(false, 0m, 0m, errors);
    }
}

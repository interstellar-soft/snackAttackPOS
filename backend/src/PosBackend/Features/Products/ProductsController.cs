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
            .Include(p => p.Inventory)
            .Include(p => p.AdditionalBarcodes)
            .AsNoTracking()
            .OrderBy(p => p.Name)
            .ToListAsync(cancellationToken);

        var responses = products.Select(product => ToResponse(product)).ToList();
        return Ok(responses);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ProductResponse>> GetProductById(Guid id, CancellationToken cancellationToken)
    {
        var product = await _db.Products
            .Include(p => p.Category)
            .Include(p => p.Inventory)
            .Include(p => p.AdditionalBarcodes)
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
        var (errors, category, categoryWasAdded) = await ValidateAsync(request, null, cancellationToken);
        if (errors.Count > 0)
        {
            return CreateValidationProblem(errors);
        }

        var priceResult = await TryResolvePricesAsync(request, cancellationToken);
        if (!priceResult.Succeeded)
        {
            return CreateValidationProblem(priceResult.Errors);
        }

        var costResult = await TryResolveCostAsync(request, cancellationToken);
        if (!costResult.Succeeded)
        {
            return CreateValidationProblem(costResult.Errors);
        }

        if (category is null)
        {
            return CreateValidationProblem(new Dictionary<string, string[]>
            {
                [nameof(request.CategoryName)] = new[] { "Category could not be resolved." }
            });
        }

        if (categoryWasAdded)
        {
            await _db.SaveChangesAsync(cancellationToken);
        }

        request.AdditionalBarcodes ??= new List<ProductBarcodeInput>();
        var barcodeResult = await ResolveAdditionalBarcodesAsync(request.AdditionalBarcodes, cancellationToken);
        if (!barcodeResult.Succeeded)
        {
            return CreateValidationProblem(barcodeResult.Errors);
        }

        var product = new Product
        {
            Name = request.Name!,
            Sku = NormalizeOptional(request.Sku),
            Barcode = request.Barcode!,
            Description = NormalizeOptional(request.Description),
            CategoryId = category.Id,
            PriceUsd = priceResult.PriceUsd,
            PriceLbp = priceResult.PriceLbp,
            IsActive = true,
            IsPinned = request.IsPinned,
            Category = category
        };

        foreach (var barcode in barcodeResult.Barcodes)
        {
            product.AdditionalBarcodes.Add(new ProductBarcode
            {
                Code = barcode.Code,
                QuantityPerScan = barcode.Quantity,
                PriceUsdOverride = barcode.PriceUsd,
                PriceLbpOverride = barcode.PriceLbp
            });
        }

        var initialQuantity = request.QuantityOnHand.HasValue
            ? decimal.Round(request.QuantityOnHand.Value, 2, MidpointRounding.AwayFromZero)
            : 0m;

        var inventory = new PosBackend.Domain.Entities.Inventory
        {
            Product = product,
            QuantityOnHand = initialQuantity,
            ReorderPoint = request.ReorderPoint ?? 3m,
            ReorderQuantity = 0m,
            AverageCostUsd = costResult.HasValue ? costResult.CostUsd : 0m,
            AverageCostLbp = costResult.HasValue ? costResult.CostLbp : 0m,
            LastRestockedAt = initialQuantity > 0 ? DateTimeOffset.UtcNow : null,
            IsReorderAlarmEnabled = true
        };

        product.Inventory = inventory;

        _db.Products.Add(product);
        await _db.Inventories.AddAsync(inventory, cancellationToken);
        await _db.SaveChangesAsync(cancellationToken);

        var response = ToResponse(product);
        return CreatedAtAction(nameof(GetProductById), new { id = response.Id }, response);
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ProductResponse>> UpdateProduct(Guid id, [FromBody] UpdateProductRequest request, CancellationToken cancellationToken)
    {
        var product = await _db.Products.Include(p => p.Category)
            .Include(p => p.Inventory)
            .Include(p => p.AdditionalBarcodes)
            .FirstOrDefaultAsync(p => p.Id == id, cancellationToken);
        if (product is null)
        {
            return NotFound();
        }

        var (errors, category, categoryWasAdded) = await ValidateAsync(request, id, cancellationToken);
        if (errors.Count > 0)
        {
            return CreateValidationProblem(errors);
        }

        var priceResult = await TryResolvePricesAsync(request, cancellationToken);
        if (!priceResult.Succeeded)
        {
            return CreateValidationProblem(priceResult.Errors);
        }

        var costResult = await TryResolveCostAsync(request, cancellationToken);
        if (!costResult.Succeeded)
        {
            return CreateValidationProblem(costResult.Errors);
        }

        if (category is null)
        {
            return CreateValidationProblem(new Dictionary<string, string[]>
            {
                [nameof(request.CategoryName)] = new[] { "Category could not be resolved." }
            });
        }

        if (categoryWasAdded)
        {
            await _db.SaveChangesAsync(cancellationToken);
        }

        BarcodeResolutionResult? barcodeResult = null;
        if (request.AdditionalBarcodes is not null)
        {
            barcodeResult = await ResolveAdditionalBarcodesAsync(request.AdditionalBarcodes, cancellationToken);
            if (!barcodeResult.Succeeded)
            {
                return CreateValidationProblem(barcodeResult.Errors);
            }
        }

        product.Name = request.Name!;
        product.Sku = NormalizeOptional(request.Sku);
        product.Barcode = request.Barcode!;
        product.Description = NormalizeOptional(request.Description);
        product.CategoryId = category.Id;
        product.PriceUsd = priceResult.PriceUsd;
        product.PriceLbp = priceResult.PriceLbp;
        product.IsPinned = request.IsPinned;
        product.Category = category;
        product.UpdatedAt = DateTime.UtcNow;

        var inventory = product.Inventory;
        var requiresInventory = inventory is null
            && (request.ReorderPoint.HasValue || request.QuantityOnHand.HasValue || costResult.HasValue);

        if (requiresInventory)
        {
            inventory = new PosBackend.Domain.Entities.Inventory
            {
                Product = product,
                ProductId = product.Id,
                QuantityOnHand = 0m,
                ReorderPoint = request.ReorderPoint ?? 3m,
                ReorderQuantity = 0m,
                AverageCostUsd = 0m,
                AverageCostLbp = 0m,
                IsReorderAlarmEnabled = true
            };

            await _db.Inventories.AddAsync(inventory, cancellationToken);
            product.Inventory = inventory;
        }

        if (inventory is not null)
        {
            if (request.ReorderPoint is decimal reorderPoint)
            {
                inventory.ReorderPoint = reorderPoint;
            }

            if (request.QuantityOnHand is decimal quantityOnHand)
            {
                var normalizedQuantity = decimal.Round(quantityOnHand, 2, MidpointRounding.AwayFromZero);
                inventory.QuantityOnHand = normalizedQuantity;
                inventory.LastRestockedAt = DateTimeOffset.UtcNow;
            }

            if (costResult.HasValue)
            {
                inventory.AverageCostUsd = costResult.CostUsd;
                inventory.AverageCostLbp = costResult.CostLbp;
            }
        }

        if (barcodeResult is not null)
        {
            ApplyAdditionalBarcodes(product, barcodeResult.Barcodes);
        }

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
        var query = _db.Products
            .Include(p => p.Category)
            .Include(p => p.Inventory)
            .Include(p => p.AdditionalBarcodes)
            .AsQueryable();
        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = q.ToLower();
            query = query.Where(p =>
                p.Name.ToLower().Contains(term) ||
                (p.Sku != null && p.Sku.ToLower().Contains(term)) ||
                p.Barcode.ToLower().Contains(term) ||
                p.AdditionalBarcodes.Any(b => b.Code.ToLower().Contains(term)));
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

        var results = products.Select(product => ToResponse(product)).ToList();

        return Ok(results);
    }

    [HttpPost("scan")]
    public async Task<ActionResult<ProductResponse>> Scan([FromBody] ScanRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Barcode))
        {
            return BadRequest(new { message = "Barcode is required." });
        }

        var normalizedBarcode = request.Barcode.Trim();

        var product = await _db.Products
            .Include(p => p.Category)
            .Include(p => p.Inventory)
            .Include(p => p.AdditionalBarcodes)
            .FirstOrDefaultAsync(p => p.Barcode == normalizedBarcode, cancellationToken);

        ProductBarcode? matchedBarcode = null;

        if (product is null)
        {
            matchedBarcode = await _db.ProductBarcodes
                .Include(b => b.Product!)
                    .ThenInclude(p => p.Category)
                .Include(b => b.Product!)
                    .ThenInclude(p => p.Inventory)
                .Include(b => b.Product!)
                    .ThenInclude(p => p.AdditionalBarcodes)
                .FirstOrDefaultAsync(b => b.Code == normalizedBarcode, cancellationToken);

            product = matchedBarcode?.Product;
        }

        if (product is null)
        {
            return NotFound();
        }

        var userId = User.FindFirst("sub")?.Value ?? "anonymous";
        var productIdentifier = BuildProductIdentifier(product);
        var rapid = _watchdog.IsRapidRepeat(userId, productIdentifier);
        var anomaly = await _mlClient.PredictAnomalyAsync(new MlClient.AnomalyRequest(productIdentifier, product.PriceUsd, 1), cancellationToken);

        var flagged = rapid || (anomaly?.IsAnomaly ?? false);
        var reason = rapid ? "rapid_repeat_scan" : anomaly?.Reason;

        var response = ToResponse(product, matchedBarcode, normalizedBarcode);
        response.IsFlagged = flagged;
        response.FlagReason = reason;
        return response;
    }

    private ProductResponse ToResponse(Product product, ProductBarcode? scannedBarcode = null, string? requestedBarcode = null)
    {
        var inventory = product.Inventory;
        var additional = product.AdditionalBarcodes
            .OrderBy(b => b.Code, StringComparer.Ordinal)
            .Select(b => new ProductBarcodeResponse
            {
                Id = b.Id,
                Code = b.Code,
                QuantityPerScan = b.QuantityPerScan,
                PriceUsdOverride = b.PriceUsdOverride,
                PriceLbpOverride = b.PriceLbpOverride
            })
            .ToList();

        var scannedQuantity = Math.Max(1, scannedBarcode?.QuantityPerScan ?? 1);
        var totalUsdOverride = scannedBarcode?.PriceUsdOverride;
        var totalLbpOverride = scannedBarcode?.PriceLbpOverride;
        var rawUnitUsd = totalUsdOverride.HasValue && scannedQuantity > 0
            ? totalUsdOverride.Value / scannedQuantity
            : product.PriceUsd;
        var rawUnitLbp = totalLbpOverride.HasValue && scannedQuantity > 0
            ? totalLbpOverride.Value / scannedQuantity
            : product.PriceLbp;

        if (!totalLbpOverride.HasValue && totalUsdOverride.HasValue)
        {
            rawUnitLbp = product.PriceUsd == 0m
                ? product.PriceLbp
                : product.PriceLbp * (rawUnitUsd / product.PriceUsd);
        }

        var scannedUnitUsd = decimal.Round(rawUnitUsd, 2, MidpointRounding.AwayFromZero);
        var scannedUnitLbp = decimal.Round(rawUnitLbp, 0, MidpointRounding.AwayFromZero);
        var scannedTotalUsd = totalUsdOverride.HasValue
            ? decimal.Round(totalUsdOverride.Value, 2, MidpointRounding.AwayFromZero)
            : decimal.Round(scannedUnitUsd * scannedQuantity, 2, MidpointRounding.AwayFromZero);
        var scannedTotalLbp = totalLbpOverride.HasValue
            ? decimal.Round(totalLbpOverride.Value, 0, MidpointRounding.AwayFromZero)
            : decimal.Round(scannedUnitLbp * scannedQuantity, 0, MidpointRounding.AwayFromZero);
        var scannedCode = scannedBarcode?.Code ?? requestedBarcode ?? product.Barcode;
        var mergesWithPrimary = scannedBarcode is null || (scannedQuantity == 1 && !totalUsdOverride.HasValue && !totalLbpOverride.HasValue);

        return new ProductResponse
        {
            Id = product.Id,
            Sku = product.Sku,
            Name = product.Name,
            Barcode = product.Barcode,
            PriceUsd = product.PriceUsd,
            PriceLbp = product.PriceLbp,
            Description = product.Description,
            CategoryName = product.Category?.Name ?? string.Empty,
            IsPinned = product.IsPinned,
            QuantityOnHand = inventory?.QuantityOnHand ?? 0,
            AverageCostUsd = inventory?.AverageCostUsd ?? 0,
            ReorderPoint = inventory?.ReorderPoint ?? 3m,
            IsReorderAlarmEnabled = inventory?.IsReorderAlarmEnabled ?? true,
            AdditionalBarcodes = additional,
            ScannedBarcode = scannedCode,
            ScannedQuantity = scannedQuantity,
            ScannedUnitPriceUsd = scannedUnitUsd,
            ScannedUnitPriceLbp = scannedUnitLbp,
            ScannedTotalUsd = scannedTotalUsd,
            ScannedTotalLbp = scannedTotalLbp,
            ScannedMergesWithPrimary = mergesWithPrimary
        };
    }

    private async Task<(Dictionary<string, string[]>, Category?, bool)> ValidateAsync(
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

        request.Sku = NormalizeOptional(request.Sku);

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

        if (request.Cost is decimal costValue && costValue < 0)
        {
            AddError(errors, nameof(request.Cost), "Cost cannot be negative.");
        }

        if (request.Cost.HasValue || !string.IsNullOrWhiteSpace(request.CostCurrency))
        {
            var normalizedCostCurrency = NormalizeCurrency(request.CostCurrency ?? request.Currency);
            if (normalizedCostCurrency is null)
            {
                AddError(errors, nameof(request.CostCurrency), "Currency must be either USD or LBP.");
            }
            else
            {
                request.CostCurrency = normalizedCostCurrency;
            }
        }

        if (string.IsNullOrWhiteSpace(request.CategoryName))
        {
            AddError(errors, nameof(request.CategoryName), "Category name is required.");
        }
        else
        {
            request.CategoryName = request.CategoryName.Trim();
        }

        if (request.ReorderPoint is decimal reorderPoint && reorderPoint < 0)
        {
            AddError(errors, nameof(request.ReorderPoint), "Reorder point cannot be negative.");
        }

        if (request.QuantityOnHand is decimal quantityOnHand && quantityOnHand < 0)
        {
            AddError(errors, nameof(request.QuantityOnHand), "Quantity on hand cannot be negative.");
        }

        if (request.Sku is not null)
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
            else
            {
                var barcodeConflictsWithAdditional = await _db.ProductBarcodes
                    .AnyAsync(b => b.Code == request.Barcode && (!existingProductId.HasValue || b.ProductId != existingProductId.Value), cancellationToken);
                if (barcodeConflictsWithAdditional)
                {
                    AddError(errors, nameof(request.Barcode), "Barcode must be unique.");
                }
            }
        }

        await NormalizeAdditionalBarcodesAsync(request, existingProductId, errors, cancellationToken);

        Category? category = null;
        var categoryWasAdded = false;
        if (!errors.ContainsKey(nameof(request.CategoryName)) && errors.Count == 0)
        {
            var normalizedName = request.CategoryName;
            var normalizedLower = normalizedName.ToLower();

            category = await _db.Categories
                .FirstOrDefaultAsync(c => c.Name.ToLower() == normalizedLower, cancellationToken);

            if (category is null)
            {
                category = new Category
                {
                    Name = normalizedName
                };

                await _db.Categories.AddAsync(category, cancellationToken);
                categoryWasAdded = true;
            }
        }

        if (category is null && errors.Count == 0)
        {
            AddError(errors, nameof(request.CategoryName), "Category could not be resolved.");
        }

        var materialized = errors.ToDictionary(
            pair => pair.Key,
            pair => pair.Value.ToArray(),
            StringComparer.Ordinal);

        return (materialized, category, categoryWasAdded);
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

    private async Task<CostComputationResult> TryResolveCostAsync(ProductMutationRequestBase request, CancellationToken cancellationToken)
    {
        if (!request.Cost.HasValue)
        {
            return CostComputationResult.None();
        }

        var currency = NormalizeCurrency(request.CostCurrency ?? request.Currency);
        if (currency is null)
        {
            return CostComputationResult.Failure(new Dictionary<string, string[]>
            {
                [nameof(request.CostCurrency)] = new[] { "Currency must be either USD or LBP." }
            });
        }

        request.CostCurrency = currency;

        try
        {
            var rate = await _currencyService.GetCurrentRateAsync(cancellationToken);

            if (currency == "LBP")
            {
                var costLbp = _currencyService.RoundLbp(request.Cost.Value);
                var costUsd = _currencyService.ConvertLbpToUsd(costLbp, rate.Rate);
                return CostComputationResult.Success(costUsd, costLbp);
            }

            var roundedUsd = _currencyService.RoundUsd(request.Cost.Value);
            var convertedLbp = _currencyService.ConvertUsdToLbp(roundedUsd, rate.Rate);
            return CostComputationResult.Success(roundedUsd, convertedLbp);
        }
        catch (InvalidOperationException)
        {
            return CostComputationResult.Failure(new Dictionary<string, string[]>
            {
                [nameof(request.CostCurrency)] = new[] { "Exchange rate is not configured." }
            });
        }
    }

    private async Task NormalizeAdditionalBarcodesAsync(
        ProductMutationRequestBase request,
        Guid? existingProductId,
        Dictionary<string, List<string>> errors,
        CancellationToken cancellationToken)
    {
        if (request.AdditionalBarcodes is null)
        {
            if (existingProductId.HasValue)
            {
                return;
            }

            request.AdditionalBarcodes = new List<ProductBarcodeInput>();
        }

        var barcodes = request.AdditionalBarcodes;
        if (barcodes is null)
        {
            return;
        }

        var normalized = new List<ProductBarcodeInput>(barcodes.Count);
        var seenCodes = new HashSet<string>(StringComparer.Ordinal);

        if (!string.IsNullOrWhiteSpace(request.Barcode))
        {
            seenCodes.Add(request.Barcode);
        }

        for (var index = 0; index < barcodes.Count; index++)
        {
            var current = barcodes[index];
            var pathPrefix = $"{nameof(request.AdditionalBarcodes)}[{index}]";

            if (current is null)
            {
                continue;
            }

            var code = NormalizeOptional(current.Code);
            if (code is null)
            {
                AddError(errors, $"{pathPrefix}.Code", "Barcode is required.");
                continue;
            }

            if (!seenCodes.Add(code))
            {
                AddError(errors, $"{pathPrefix}.Code", "Barcode must be unique.");
                continue;
            }

            if (current.Quantity <= 0)
            {
                AddError(errors, $"{pathPrefix}.Quantity", "Quantity must be at least 1.");
                continue;
            }

            if (current.Price is decimal price && price < 0)
            {
                AddError(errors, $"{pathPrefix}.Price", "Price cannot be negative.");
                continue;
            }

            string? normalizedCurrency = null;
            if (!string.IsNullOrWhiteSpace(current.Currency) || current.Price.HasValue)
            {
                normalizedCurrency = NormalizeCurrency(current.Currency);
                if (normalizedCurrency is null)
                {
                    AddError(errors, $"{pathPrefix}.Currency", "Currency must be either USD or LBP.");
                    continue;
                }
            }

            normalized.Add(new ProductBarcodeInput
            {
                Code = code,
                Quantity = current.Quantity,
                Price = current.Price,
                Currency = normalizedCurrency ?? current.Currency
            });
        }

        request.AdditionalBarcodes = normalized;

        if (normalized.Count == 0)
        {
            return;
        }

        var codes = normalized.Select(b => b.Code).ToList();

        var conflictingPrimary = await _db.Products
            .AsNoTracking()
            .Where(p => codes.Contains(p.Barcode))
            .Where(p => !existingProductId.HasValue || p.Id != existingProductId.Value)
            .Select(p => p.Barcode)
            .ToListAsync(cancellationToken);

        foreach (var conflict in conflictingPrimary)
        {
            AddError(errors, nameof(ProductMutationRequestBase.AdditionalBarcodes), $"Barcode {conflict} is already assigned to another product.");
        }

        var conflictingSecondary = await _db.ProductBarcodes
            .AsNoTracking()
            .Where(b => codes.Contains(b.Code))
            .Where(b => !existingProductId.HasValue || b.ProductId != existingProductId.Value)
            .Select(b => b.Code)
            .ToListAsync(cancellationToken);

        foreach (var conflict in conflictingSecondary)
        {
            AddError(errors, nameof(ProductMutationRequestBase.AdditionalBarcodes), $"Barcode {conflict} is already assigned to another product.");
        }
    }

    private async Task<BarcodeResolutionResult> ResolveAdditionalBarcodesAsync(
        List<ProductBarcodeInput> barcodes,
        CancellationToken cancellationToken)
    {
        if (barcodes.Count == 0)
        {
            return BarcodeResolutionResult.Success(Array.Empty<ResolvedProductBarcode>());
        }

        var resolved = new List<ResolvedProductBarcode>(barcodes.Count);
        CurrencyRate? rate = null;

        foreach (var barcode in barcodes)
        {
            decimal? priceUsd = null;
            decimal? priceLbp = null;

            if (barcode.Price.HasValue)
            {
                try
                {
                    rate ??= await _currencyService.GetCurrentRateAsync(cancellationToken);
                }
                catch (InvalidOperationException)
                {
                    return BarcodeResolutionResult.Failure(new Dictionary<string, string[]>
                    {
                        [nameof(ProductMutationRequestBase.AdditionalBarcodes)] = new[] { "Exchange rate is not configured." }
                    });
                }

                if ((barcode.Currency ?? "USD") == "LBP")
                {
                    priceLbp = _currencyService.RoundLbp(barcode.Price.Value);
                    priceUsd = _currencyService.ConvertLbpToUsd(priceLbp.Value, rate.Rate);
                }
                else
                {
                    priceUsd = _currencyService.RoundUsd(barcode.Price.Value);
                    priceLbp = _currencyService.ConvertUsdToLbp(priceUsd.Value, rate.Rate);
                }
            }

            resolved.Add(new ResolvedProductBarcode(barcode.Code, barcode.Quantity, priceUsd, priceLbp));
        }

        return BarcodeResolutionResult.Success(resolved);
    }

    private static void ApplyAdditionalBarcodes(Product product, IReadOnlyList<ResolvedProductBarcode> barcodes)
    {
        var existing = product.AdditionalBarcodes.ToDictionary(b => b.Code, StringComparer.Ordinal);
        var targetCodes = new HashSet<string>(barcodes.Select(b => b.Code), StringComparer.Ordinal);

        foreach (var barcode in product.AdditionalBarcodes.ToList())
        {
            if (!targetCodes.Contains(barcode.Code))
            {
                product.AdditionalBarcodes.Remove(barcode);
            }
        }

        foreach (var barcode in barcodes)
        {
            if (existing.TryGetValue(barcode.Code, out var entity))
            {
                entity.QuantityPerScan = barcode.Quantity;
                entity.PriceUsdOverride = barcode.PriceUsd;
                entity.PriceLbpOverride = barcode.PriceLbp;
                entity.UpdatedAt = DateTime.UtcNow;
                entity.ProductId = product.Id;
                entity.Product = product;
            }
            else
            {
                product.AdditionalBarcodes.Add(new ProductBarcode
                {
                    Product = product,
                    ProductId = product.Id,
                    Code = barcode.Code,
                    QuantityPerScan = barcode.Quantity,
                    PriceUsdOverride = barcode.PriceUsd,
                    PriceLbpOverride = barcode.PriceLbp
                });
            }
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

    private static string BuildProductIdentifier(Product product)
    {
        if (!string.IsNullOrWhiteSpace(product.Sku))
        {
            return product.Sku;
        }

        if (!string.IsNullOrWhiteSpace(product.Barcode))
        {
            return $"BAR:{product.Barcode}";
        }

        return $"ID:{product.Id}";
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

    private sealed record CostComputationResult(bool Succeeded, bool HasValue, decimal CostUsd, decimal CostLbp, IDictionary<string, string[]> Errors)
    {
        public static CostComputationResult Success(decimal costUsd, decimal costLbp) =>
            new(true, true, costUsd, costLbp, new Dictionary<string, string[]>(StringComparer.Ordinal));

        public static CostComputationResult None() =>
            new(true, false, 0m, 0m, new Dictionary<string, string[]>(StringComparer.Ordinal));

        public static CostComputationResult Failure(IDictionary<string, string[]> errors) =>
            new(false, false, 0m, 0m, errors);
    }

    private sealed record ResolvedProductBarcode(string Code, int Quantity, decimal? PriceUsd, decimal? PriceLbp);

    private sealed record BarcodeResolutionResult(bool Succeeded, IReadOnlyList<ResolvedProductBarcode> Barcodes, IDictionary<string, string[]> Errors)
    {
        public static BarcodeResolutionResult Success(IReadOnlyList<ResolvedProductBarcode> barcodes) =>
            new(true, barcodes, new Dictionary<string, string[]>(StringComparer.Ordinal));

        public static BarcodeResolutionResult Failure(IDictionary<string, string[]> errors) =>
            new(false, Array.Empty<ResolvedProductBarcode>(), errors);
    }
}

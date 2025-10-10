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
using PosBackend.Domain.Entities;
using PosBackend.Infrastructure.Data;

namespace PosBackend.Features.Offers;

[ApiController]
[Route("api/offers")]
[Authorize(Roles = "Admin")]
public class OffersController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly CurrencyService _currencyService;

    public OffersController(ApplicationDbContext db, CurrencyService currencyService)
    {
        _db = db;
        _currencyService = currencyService;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<OfferResponse>>> GetOffers(CancellationToken cancellationToken)
    {
        var offers = await _db.Offers
            .AsNoTracking()
            .Include(o => o.Items)
                .ThenInclude(i => i.Product)
            .OrderBy(o => o.Name)
            .ToListAsync(cancellationToken);

        var responses = offers.Select(ToResponse).ToList();
        return Ok(responses);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<OfferResponse>> GetOfferById(Guid id, CancellationToken cancellationToken)
    {
        var offer = await _db.Offers
            .AsNoTracking()
            .Include(o => o.Items)
                .ThenInclude(i => i.Product)
            .FirstOrDefaultAsync(o => o.Id == id, cancellationToken);

        if (offer is null)
        {
            return NotFound();
        }

        return Ok(ToResponse(offer));
    }

    [HttpPost]
    public async Task<ActionResult<OfferResponse>> CreateOffer([FromBody] CreateOfferRequest request, CancellationToken cancellationToken)
    {
        var validation = await ValidateAsync(request, cancellationToken);
        if (!validation.IsValid)
        {
            return CreateValidationProblem(validation.Errors);
        }

        var offer = new Offer
        {
            Name = request.Name!,
            Description = NormalizeOptional(request.Description),
            PriceUsd = validation.PriceUsd,
            PriceLbp = validation.PriceLbp,
            IsActive = request.IsActive
        };

        foreach (var item in validation.Items)
        {
            var product = validation.Products[item.ProductId];
            var quantity = decimal.Round(item.Quantity, 3, MidpointRounding.AwayFromZero);
            offer.Items.Add(new OfferItem
            {
                ProductId = item.ProductId,
                Quantity = quantity,
                Product = product
            });
        }

        await _db.Offers.AddAsync(offer, cancellationToken);
        await _db.SaveChangesAsync(cancellationToken);

        return CreatedAtAction(nameof(GetOfferById), new { id = offer.Id }, ToResponse(offer));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<OfferResponse>> UpdateOffer(Guid id, [FromBody] UpdateOfferRequest request, CancellationToken cancellationToken)
    {
        var offer = await _db.Offers
            .Include(o => o.Items)
            .FirstOrDefaultAsync(o => o.Id == id, cancellationToken);

        if (offer is null)
        {
            return NotFound();
        }

        var validation = await ValidateAsync(request, cancellationToken);
        if (!validation.IsValid)
        {
            return CreateValidationProblem(validation.Errors);
        }

        offer.Name = request.Name!;
        offer.Description = NormalizeOptional(request.Description);
        offer.PriceUsd = validation.PriceUsd;
        offer.PriceLbp = validation.PriceLbp;
        offer.IsActive = request.IsActive;
        offer.UpdatedAt = DateTime.UtcNow;

        var existingItems = offer.Items.ToDictionary(i => i.ProductId);
        var processedProducts = new HashSet<Guid>();

        foreach (var item in validation.Items)
        {
            var product = validation.Products[item.ProductId];
            var quantity = decimal.Round(item.Quantity, 3, MidpointRounding.AwayFromZero);

            if (existingItems.TryGetValue(item.ProductId, out var existing))
            {
                existing.Quantity = quantity;
                existing.Product = product;
                existing.UpdatedAt = DateTime.UtcNow;
            }
            else
            {
                offer.Items.Add(new OfferItem
                {
                    OfferId = offer.Id,
                    ProductId = item.ProductId,
                    Quantity = quantity,
                    Product = product
                });
            }

            processedProducts.Add(item.ProductId);
        }

        var itemsToRemove = offer.Items
            .Where(i => !processedProducts.Contains(i.ProductId))
            .ToList();

        if (itemsToRemove.Count > 0)
        {
            _db.OfferItems.RemoveRange(itemsToRemove);
            foreach (var item in itemsToRemove)
            {
                offer.Items.Remove(item);
            }
        }

        await _db.SaveChangesAsync(cancellationToken);

        await _db.Entry(offer)
            .Collection(o => o.Items)
            .Query()
            .Include(i => i.Product)
            .LoadAsync(cancellationToken);

        return Ok(ToResponse(offer));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteOffer(Guid id, CancellationToken cancellationToken)
    {
        var offer = await _db.Offers.FirstOrDefaultAsync(o => o.Id == id, cancellationToken);
        if (offer is null)
        {
            return NotFound();
        }

        var hasUsage = await _db.TransactionLines.AnyAsync(l => l.OfferId == id, cancellationToken);
        if (hasUsage)
        {
            return Conflict(new { message = "Offer is referenced by existing transactions and cannot be deleted." });
        }

        _db.Offers.Remove(offer);
        await _db.SaveChangesAsync(cancellationToken);

        return NoContent();
    }

    private async Task<OfferValidationResult> ValidateAsync(OfferMutationRequestBase request, CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, List<string>>(StringComparer.Ordinal);

        request.Name = NormalizeRequired(request.Name, errors, nameof(request.Name));
        request.Description = NormalizeOptional(request.Description);

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

        var items = request.Items ?? new List<OfferItemRequest>();
        if (items.Count == 0)
        {
            AddError(errors, nameof(request.Items), "At least one item is required.");
        }

        var normalizedItems = new List<(Guid ProductId, decimal Quantity)>();
        var productIds = new HashSet<Guid>();
        foreach (var item in items)
        {
            if (item.ProductId == Guid.Empty)
            {
                AddError(errors, nameof(item.ProductId), "Product is required.");
                continue;
            }

            if (!productIds.Add(item.ProductId))
            {
                AddError(errors, nameof(request.Items), "Duplicate products are not allowed in an offer.");
                continue;
            }

            if (item.Quantity <= 0)
            {
                AddError(errors, nameof(item.Quantity), "Quantity must be greater than zero.");
                continue;
            }

            normalizedItems.Add((item.ProductId, item.Quantity));
        }

        Dictionary<Guid, Product> products = new();
        if (productIds.Count > 0 && errors.Count == 0)
        {
            products = await _db.Products
                .Where(p => productIds.Contains(p.Id))
                .ToDictionaryAsync(p => p.Id, cancellationToken);

            var missing = productIds.Except(products.Keys).ToList();
            if (missing.Count > 0)
            {
                AddError(errors, nameof(request.Items), "One or more products could not be found.");
            }
        }

        decimal priceUsd = 0m;
        decimal priceLbp = 0m;
        if (errors.Count == 0 && request.Price is decimal priceValue && currency is not null)
        {
            var priceResult = await TryResolvePricesAsync(priceValue, currency, cancellationToken);
            if (!priceResult.Success)
            {
                foreach (var error in priceResult.Errors)
                {
                    foreach (var message in error.Value)
                    {
                        AddError(errors, error.Key, message);
                    }
                }
            }
            else
            {
                priceUsd = priceResult.PriceUsd;
                priceLbp = priceResult.PriceLbp;
            }
        }

        if (errors.Count > 0)
        {
            var materialized = errors.ToDictionary(
                pair => pair.Key,
                pair => pair.Value.ToArray(),
                StringComparer.Ordinal);
            return OfferValidationResult.Invalid(materialized);
        }

        return OfferValidationResult.Valid(products, normalizedItems, priceUsd, priceLbp);
    }

    private static OfferResponse ToResponse(Offer offer)
    {
        return new OfferResponse
        {
            Id = offer.Id,
            Name = offer.Name,
            Description = offer.Description,
            PriceUsd = offer.PriceUsd,
            PriceLbp = offer.PriceLbp,
            IsActive = offer.IsActive,
            Items = offer.Items
                .OrderBy(i => i.Product?.Name ?? string.Empty)
                .Select(i => new OfferItemResponse
                {
                    ProductId = i.ProductId,
                    ProductName = i.Product?.Name ?? string.Empty,
                    ProductSku = i.Product?.Sku,
                    ProductBarcode = i.Product?.Barcode,
                    Quantity = i.Quantity
                })
                .ToList()
        };
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

    private static string NormalizeRequired(string? value, Dictionary<string, List<string>> errors, string key)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            AddError(errors, key, "Field is required.");
            return string.Empty;
        }

        return value.Trim();
    }

    private static string? NormalizeOptional(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        return value.Trim();
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

    private static string? NormalizeCurrency(string? currency)
    {
        if (string.IsNullOrWhiteSpace(currency))
        {
            return null;
        }

        var normalized = currency.Trim().ToUpperInvariant();
        return normalized is "USD" or "LBP" ? normalized : null;
    }

    private async Task<(bool Success, decimal PriceUsd, decimal PriceLbp, Dictionary<string, string[]> Errors)> TryResolvePricesAsync(decimal priceValue, string currency, CancellationToken cancellationToken)
    {
        try
        {
            var rate = await _currencyService.GetCurrentRateAsync(cancellationToken);
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

            return (true, priceUsd, priceLbp, new Dictionary<string, string[]>());
        }
        catch (InvalidOperationException)
        {
            return (false, 0m, 0m, new Dictionary<string, string[]>
            {
                [nameof(OfferMutationRequestBase.Currency)] = new[] { "Exchange rate is not configured." }
            });
        }
    }

    private sealed record OfferItemNormalized(Guid ProductId, decimal Quantity);

    private sealed record OfferValidationResult(bool IsValid, Dictionary<string, string[]> Errors, Dictionary<Guid, Product> Products, List<OfferItemNormalized> Items, decimal PriceUsd, decimal PriceLbp)
    {
        public static OfferValidationResult Invalid(Dictionary<string, string[]> errors) => new(false, errors, new Dictionary<Guid, Product>(), new List<OfferItemNormalized>(), 0m, 0m);

        public static OfferValidationResult Valid(Dictionary<Guid, Product> products, List<(Guid ProductId, decimal Quantity)> items, decimal priceUsd, decimal priceLbp)
        {
            var normalized = items.Select(i => new OfferItemNormalized(i.ProductId, i.Quantity)).ToList();
            return new OfferValidationResult(true, new Dictionary<string, string[]>(), products, normalized, priceUsd, priceLbp);
        }
    }
}

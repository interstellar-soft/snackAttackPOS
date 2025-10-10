using System;
using System.Collections.Generic;
using System.Linq;
using Microsoft.EntityFrameworkCore;
using PosBackend.Domain.Entities;
using PosBackend.Infrastructure.Data;

namespace PosBackend.Application.Services;

public record CartItemRequest(
    Guid ProductId,
    decimal Quantity,
    Guid? PriceRuleId,
    decimal? ManualDiscountPercent,
    bool IsWaste = false,
    decimal? ManualUnitPriceUsd = null,
    decimal? ManualUnitPriceLbp = null,
    decimal? ManualTotalUsd = null,
    decimal? ManualTotalLbp = null);

public class CartPricingService
{
    private readonly ApplicationDbContext _db;
    private readonly CurrencyService _currencyService;

    public CartPricingService(ApplicationDbContext db, CurrencyService currencyService)
    {
        _db = db;
        _currencyService = currencyService;
    }

    public async Task<(decimal totalUsd, decimal totalLbp, List<TransactionLine> lines)> PriceCartAsync(
        IEnumerable<CartItemRequest> items,
        decimal exchangeRate,
        bool allowManualPricing = false,
        bool priceAtCostOnly = false,
        CancellationToken cancellationToken = default)
    {
        var itemList = items.ToList();
        var productIds = itemList.Select(i => i.ProductId).Distinct().ToList();
        var products = await _db.Products
            .Include(p => p.PriceRules)
            .Include(p => p.Inventory)
            .Where(p => productIds.Contains(p.Id))
            .ToListAsync(cancellationToken);

        var productMap = products.ToDictionary(p => p.Id);

        var offerLines = new List<TransactionLine>();
        var itemsToPrice = itemList;

        if (!priceAtCostOnly && productMap.Count > 0)
        {
            var offerResult = await ApplyOffersAsync(itemsToPrice, productMap, exchangeRate, cancellationToken);
            offerLines = offerResult.offerLines;
            itemsToPrice = offerResult.remainingItems;
        }

        var lines = new List<TransactionLine>();
        decimal totalUsd = 0m;
        decimal totalLbp = 0m;

        foreach (var offerLine in offerLines)
        {
            lines.Add(offerLine);
            totalUsd += offerLine.TotalUsd;
            totalLbp += offerLine.TotalLbp;
        }

        foreach (var item in itemsToPrice)
        {
            if (!productMap.TryGetValue(item.ProductId, out var product))
            {
                continue;
            }

            var priceRule = product.PriceRules.FirstOrDefault(r => r.Id == item.PriceRuleId && r.IsActive);
            var isWaste = item.IsWaste;
            var discountPercent = 0m;
            var baseUnitPriceUsd = product.PriceUsd;
            var baseUnitPriceLbp = _currencyService.ConvertUsdToLbp(baseUnitPriceUsd, exchangeRate);
            var inventoryCostUsd = product.Inventory?.AverageCostUsd ?? decimal.Round(baseUnitPriceUsd * 0.6m, 2, MidpointRounding.AwayFromZero);
            var unitPriceUsd = priceAtCostOnly ? inventoryCostUsd : baseUnitPriceUsd;
            var unitPriceLbp = _currencyService.ConvertUsdToLbp(unitPriceUsd, exchangeRate);
            var lineTotalUsd = unitPriceUsd * item.Quantity;
            var lineTotalLbp = unitPriceLbp * item.Quantity;

            if (!isWaste && !priceAtCostOnly)
            {
                if (priceRule is not null)
                {
                    discountPercent = decimal.Clamp(priceRule.DiscountPercent, 0m, 100m);
                }

                if (allowManualPricing && item.ManualDiscountPercent.HasValue)
                {
                    discountPercent = decimal.Clamp(item.ManualDiscountPercent.Value, 0m, 100m);
                }

                if (discountPercent > 0m)
                {
                    var discountMultiplier = (100m - discountPercent) / 100m;
                    unitPriceUsd = baseUnitPriceUsd * discountMultiplier;
                    unitPriceLbp = _currencyService.ConvertUsdToLbp(unitPriceUsd, exchangeRate);
                    lineTotalUsd = unitPriceUsd * item.Quantity;
                    lineTotalLbp = unitPriceLbp * item.Quantity;
                }
            }

            var manualOverrideApplied = false;
            var manualUsdOverride = false;
            var manualLbpOverride = false;

            if (allowManualPricing && !isWaste && !priceAtCostOnly)
            {
                if (item.ManualUnitPriceUsd.HasValue)
                {
                    unitPriceUsd = item.ManualUnitPriceUsd.Value;
                    lineTotalUsd = unitPriceUsd * item.Quantity;
                    manualOverrideApplied = true;
                    manualUsdOverride = true;
                }

                if (item.ManualTotalUsd.HasValue)
                {
                    lineTotalUsd = item.ManualTotalUsd.Value;
                    unitPriceUsd = item.Quantity == 0 ? 0m : lineTotalUsd / item.Quantity;
                    manualOverrideApplied = true;
                    manualUsdOverride = true;
                }

                if (item.ManualUnitPriceLbp.HasValue)
                {
                    unitPriceLbp = item.ManualUnitPriceLbp.Value;
                    lineTotalLbp = unitPriceLbp * item.Quantity;
                    manualOverrideApplied = true;
                    manualLbpOverride = true;
                }

                if (item.ManualTotalLbp.HasValue)
                {
                    lineTotalLbp = item.ManualTotalLbp.Value;
                    unitPriceLbp = item.Quantity == 0 ? 0m : lineTotalLbp / item.Quantity;
                    manualOverrideApplied = true;
                    manualLbpOverride = true;
                }

                if (manualUsdOverride && !manualLbpOverride)
                {
                    unitPriceLbp = _currencyService.ConvertUsdToLbp(unitPriceUsd, exchangeRate);
                    lineTotalLbp = _currencyService.ConvertUsdToLbp(lineTotalUsd, exchangeRate);
                }
                else if (manualLbpOverride && !manualUsdOverride)
                {
                    unitPriceUsd = _currencyService.ConvertLbpToUsd(unitPriceLbp, exchangeRate);
                    lineTotalUsd = _currencyService.ConvertLbpToUsd(lineTotalLbp, exchangeRate);
                }
            }

            var lineCostUsd = inventoryCostUsd * item.Quantity;
            var lineCostLbp = _currencyService.ConvertUsdToLbp(lineCostUsd, exchangeRate);
            decimal profitUsd;
            decimal profitLbp;

            if (isWaste)
            {
                unitPriceUsd = 0m;
                unitPriceLbp = 0m;
                lineTotalUsd = 0m;
                lineTotalLbp = 0m;
                manualOverrideApplied = false;
                discountPercent = 0m;
                profitUsd = -lineCostUsd;
                profitLbp = -lineCostLbp;
            }
            else if (priceAtCostOnly)
            {
                unitPriceUsd = inventoryCostUsd;
                unitPriceLbp = _currencyService.ConvertUsdToLbp(unitPriceUsd, exchangeRate);
                lineTotalUsd = unitPriceUsd * item.Quantity;
                lineTotalLbp = unitPriceLbp * item.Quantity;
                manualOverrideApplied = false;
                discountPercent = 0m;
                profitUsd = 0m;
                profitLbp = 0m;
            }
            else
            {
                profitUsd = lineTotalUsd - lineCostUsd;
                profitLbp = _currencyService.ConvertUsdToLbp(profitUsd, exchangeRate);
            }

            var line = new TransactionLine
            {
                ProductId = product.Id,
                PriceRuleId = priceRule?.Id,
                Quantity = item.Quantity,
                BaseUnitPriceUsd = _currencyService.RoundUsd(baseUnitPriceUsd),
                BaseUnitPriceLbp = _currencyService.RoundLbp(baseUnitPriceLbp),
                UnitPriceUsd = _currencyService.RoundUsd(unitPriceUsd),
                UnitPriceLbp = _currencyService.RoundLbp(unitPriceLbp),
                DiscountPercent = discountPercent,
                TotalUsd = _currencyService.RoundUsd(lineTotalUsd),
                TotalLbp = _currencyService.RoundLbp(lineTotalLbp),
                CostUsd = _currencyService.RoundUsd(lineCostUsd),
                CostLbp = _currencyService.RoundLbp(lineCostLbp),
                ProfitUsd = _currencyService.RoundUsd(profitUsd),
                ProfitLbp = _currencyService.RoundLbp(profitLbp),
                IsWaste = isWaste,
                HasManualPriceOverride = allowManualPricing && manualOverrideApplied
            };
            line.Product = product;
            line.PriceRule = priceRule;
            lines.Add(line);
            totalUsd += line.TotalUsd;
            totalLbp += line.TotalLbp;
        }

        return (
            decimal.Round(totalUsd, 2, MidpointRounding.AwayFromZero),
            decimal.Round(totalLbp, 2, MidpointRounding.AwayFromZero),
            lines);
    }

    private async Task<(List<TransactionLine> offerLines, List<CartItemRequest> remainingItems)> ApplyOffersAsync(
        List<CartItemRequest> items,
        Dictionary<Guid, Product> productMap,
        decimal exchangeRate,
        CancellationToken cancellationToken)
    {
        var offerLines = new List<TransactionLine>();
        var remainingItems = items;

        if (items.Count == 0)
        {
            return (offerLines, remainingItems);
        }

        var productIds = productMap.Keys.ToList();
        var offers = await _db.Offers
            .AsNoTracking()
            .Include(o => o.Items)
            .Where(o => o.IsActive)
            .Where(o => o.Items.Any())
            .Where(o => o.Items.All(i => productIds.Contains(i.ProductId)))
            .ToListAsync(cancellationToken);

        if (offers.Count == 0)
        {
            return (offerLines, remainingItems);
        }

        var eligibleQuantities = new Dictionary<Guid, decimal>();
        foreach (var item in items)
        {
            if (!IsOfferEligibleItem(item))
            {
                continue;
            }

            if (!eligibleQuantities.TryGetValue(item.ProductId, out var current))
            {
                current = 0m;
            }

            eligibleQuantities[item.ProductId] = current + item.Quantity;
        }

        if (eligibleQuantities.Count == 0)
        {
            return (offerLines, remainingItems);
        }

        var candidates = offers
            .Select(o =>
            {
                var baseTotalUsd = o.Items.Sum(i =>
                {
                    if (!productMap.TryGetValue(i.ProductId, out var product))
                    {
                        return 0m;
                    }

                    return product.PriceUsd * i.Quantity;
                });
                var savings = baseTotalUsd - o.PriceUsd;
                return new OfferCandidate(o, baseTotalUsd, savings);
            })
            .Where(c => c.BaseTotalUsd > 0m && c.Savings > 0m && c.Offer.Items.All(i => i.Quantity > 0m))
            .OrderByDescending(c => c.Savings)
            .ToList();

        if (candidates.Count == 0)
        {
            return (offerLines, remainingItems);
        }

        var usageByProduct = new Dictionary<Guid, decimal>();
        var applications = new List<OfferApplication>();

        foreach (var candidate in candidates)
        {
            var possible = candidate.Offer.Items
                .Select(i =>
                {
                    if (i.Quantity <= 0m)
                    {
                        return 0;
                    }

                    eligibleQuantities.TryGetValue(i.ProductId, out var available);
                    if (available <= 0m)
                    {
                        return 0;
                    }

                    return (int)Math.Floor(available / i.Quantity);
                })
                .DefaultIfEmpty(0)
                .Min();

            if (possible <= 0)
            {
                continue;
            }

            var multiplier = candidate.BaseTotalUsd <= 0m
                ? 0m
                : candidate.Offer.PriceUsd <= 0m
                    ? 0m
                    : candidate.Offer.PriceUsd / candidate.BaseTotalUsd;

            if (multiplier < 0m)
            {
                multiplier = 0m;
            }

            applications.Add(new OfferApplication(candidate.Offer, possible, multiplier));

            foreach (var offerItem in candidate.Offer.Items)
            {
                var usedQuantity = offerItem.Quantity * possible;
                if (!eligibleQuantities.TryGetValue(offerItem.ProductId, out var available))
                {
                    continue;
                }

                eligibleQuantities[offerItem.ProductId] = Math.Max(0m, available - usedQuantity);
                usageByProduct[offerItem.ProductId] = usageByProduct.GetValueOrDefault(offerItem.ProductId) + usedQuantity;
            }
        }

        if (applications.Count == 0)
        {
            return (offerLines, remainingItems);
        }

        foreach (var application in applications)
        {
            foreach (var offerItem in application.Offer.Items)
            {
                if (!productMap.TryGetValue(offerItem.ProductId, out var product))
                {
                    continue;
                }

                var quantity = decimal.Round(offerItem.Quantity * application.Count, 2, MidpointRounding.AwayFromZero);
                if (quantity <= 0m)
                {
                    continue;
                }

                var baseUnitPriceUsd = product.PriceUsd;
                var baseUnitPriceLbp = _currencyService.ConvertUsdToLbp(baseUnitPriceUsd, exchangeRate);
                var inventoryCostUsd = product.Inventory?.AverageCostUsd ?? decimal.Round(baseUnitPriceUsd * 0.6m, 2, MidpointRounding.AwayFromZero);
                var multiplier = application.Multiplier;
                if (multiplier < 0m)
                {
                    multiplier = 0m;
                }

                var unitPriceUsd = decimal.Round(baseUnitPriceUsd * multiplier, 4, MidpointRounding.AwayFromZero);
                var unitPriceLbp = _currencyService.ConvertUsdToLbp(unitPriceUsd, exchangeRate);
                var lineTotalUsd = unitPriceUsd * quantity;
                var lineTotalLbp = unitPriceLbp * quantity;
                var lineCostUsd = inventoryCostUsd * quantity;
                var lineCostLbp = _currencyService.ConvertUsdToLbp(lineCostUsd, exchangeRate);
                var profitUsd = lineTotalUsd - lineCostUsd;
                var profitLbp = _currencyService.ConvertUsdToLbp(profitUsd, exchangeRate);
                var discountPercent = decimal.Round((1m - multiplier) * 100m, 2, MidpointRounding.AwayFromZero);
                discountPercent = decimal.Clamp(discountPercent, -100m, 100m);

                var line = new TransactionLine
                {
                    ProductId = product.Id,
                    OfferId = application.Offer.Id,
                    Quantity = quantity,
                    BaseUnitPriceUsd = _currencyService.RoundUsd(baseUnitPriceUsd),
                    BaseUnitPriceLbp = _currencyService.RoundLbp(baseUnitPriceLbp),
                    UnitPriceUsd = _currencyService.RoundUsd(unitPriceUsd),
                    UnitPriceLbp = _currencyService.RoundLbp(unitPriceLbp),
                    DiscountPercent = discountPercent,
                    TotalUsd = _currencyService.RoundUsd(lineTotalUsd),
                    TotalLbp = _currencyService.RoundLbp(lineTotalLbp),
                    CostUsd = _currencyService.RoundUsd(lineCostUsd),
                    CostLbp = _currencyService.RoundLbp(lineCostLbp),
                    ProfitUsd = _currencyService.RoundUsd(profitUsd),
                    ProfitLbp = _currencyService.RoundLbp(profitLbp),
                    IsWaste = false,
                    HasManualPriceOverride = false
                };
                line.Product = product;
                line.Offer = application.Offer;
                offerLines.Add(line);
            }
        }

        var remainingQuantities = usageByProduct.ToDictionary(k => k.Key, v => v.Value);
        var adjustedItems = new List<CartItemRequest>();

        foreach (var item in items)
        {
            var remainingQuantity = item.Quantity;

            if (remainingQuantity > 0m && IsOfferEligibleItem(item) && remainingQuantities.TryGetValue(item.ProductId, out var offerQuantity) && offerQuantity > 0m)
            {
                var allocated = Math.Min(remainingQuantity, offerQuantity);
                if (allocated > 0m)
                {
                    remainingQuantity -= allocated;
                    remainingQuantities[item.ProductId] = offerQuantity - allocated;
                }
            }

            if (remainingQuantity <= 0m)
            {
                continue;
            }

            var remainder = new CartItemRequest(
                item.ProductId,
                remainingQuantity,
                item.PriceRuleId,
                item.ManualDiscountPercent,
                item.IsWaste,
                item.ManualUnitPriceUsd,
                item.ManualUnitPriceLbp,
                item.ManualTotalUsd,
                item.ManualTotalLbp);

            adjustedItems.Add(remainder);
        }

        return (offerLines, adjustedItems);
    }

    private static bool HasManualPricing(CartItemRequest item)
    {
        return item.ManualDiscountPercent.HasValue ||
               item.ManualUnitPriceUsd.HasValue ||
               item.ManualUnitPriceLbp.HasValue ||
               item.ManualTotalUsd.HasValue ||
               item.ManualTotalLbp.HasValue;
    }

    private static bool IsOfferEligibleItem(CartItemRequest item)
    {
        if (item.IsWaste)
        {
            return false;
        }

        if (item.PriceRuleId.HasValue)
        {
            return false;
        }

        return !HasManualPricing(item);
    }

    private sealed record OfferCandidate(Offer Offer, decimal BaseTotalUsd, decimal Savings);

    private sealed record OfferApplication(Offer Offer, int Count, decimal Multiplier);
}

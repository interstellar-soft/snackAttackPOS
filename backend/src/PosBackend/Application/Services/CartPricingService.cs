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
        var productIds = items.Select(i => i.ProductId).ToList();
        var products = await _db.Products
            .Include(p => p.PriceRules)
            .Include(p => p.Inventory)
            .Where(p => productIds.Contains(p.Id)).ToListAsync(cancellationToken);

        var lines = new List<TransactionLine>();
        decimal totalUsd = 0m;
        decimal totalLbp = 0m;
        foreach (var item in items)
        {
            var product = products.First(p => p.Id == item.ProductId);
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
}

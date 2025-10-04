using Microsoft.EntityFrameworkCore;
using PosBackend.Domain.Entities;
using PosBackend.Infrastructure.Data;

namespace PosBackend.Application.Services;

public record CartItemRequest(Guid ProductId, decimal Quantity, Guid? PriceRuleId, decimal? ManualDiscountPercent);

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
            var discountPercent = priceRule?.DiscountPercent ?? item.ManualDiscountPercent ?? 0m;
            var baseUnitPriceUsd = product.PriceUsd;
            var baseUnitPriceLbp = _currencyService.ConvertUsdToLbp(baseUnitPriceUsd, exchangeRate);
            var unitPriceUsd = baseUnitPriceUsd * (1 - discountPercent / 100m);
            var unitPriceLbp = _currencyService.ConvertUsdToLbp(unitPriceUsd, exchangeRate);
            var lineTotalUsd = unitPriceUsd * item.Quantity;
            var lineTotalLbp = unitPriceLbp * item.Quantity;

            var inventoryCost = product.Inventory?.AverageCostUsd ?? baseUnitPriceUsd * 0.6m;
            var lineCostUsd = inventoryCost * item.Quantity;
            var lineCostLbp = _currencyService.ConvertUsdToLbp(lineCostUsd, exchangeRate);
            var profitUsd = lineTotalUsd - lineCostUsd;
            var profitLbp = lineTotalLbp - lineCostLbp;

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
                ProfitLbp = _currencyService.RoundLbp(profitLbp)
            };
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

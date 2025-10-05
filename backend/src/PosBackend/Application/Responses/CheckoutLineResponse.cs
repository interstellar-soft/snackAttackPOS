using PosBackend.Domain.Entities;

namespace PosBackend.Application.Responses;

public class CheckoutLineResponse
{
    public Guid Id { get; set; }
    public Guid ProductId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public string? ProductSku { get; set; }
    public string? ProductBarcode { get; set; }
    public Guid? PriceRuleId { get; set; }
    public PriceRuleType? PriceRuleType { get; set; }
    public string? PriceRuleDescription { get; set; }
    public decimal Quantity { get; set; }
    public decimal BaseUnitPriceUsd { get; set; }
    public decimal BaseUnitPriceLbp { get; set; }
    public decimal UnitPriceUsd { get; set; }
    public decimal UnitPriceLbp { get; set; }
    public decimal DiscountPercent { get; set; }
    public decimal TotalUsd { get; set; }
    public decimal TotalLbp { get; set; }
    public decimal CostUsd { get; set; }
    public decimal CostLbp { get; set; }
    public decimal ProfitUsd { get; set; }
    public decimal ProfitLbp { get; set; }
    public decimal QuantityOnHand { get; set; }

    public static CheckoutLineResponse FromEntity(TransactionLine line)
    {
        return new CheckoutLineResponse
        {
            Id = line.Id,
            ProductId = line.ProductId,
            ProductName = line.Product?.Name ?? string.Empty,
            ProductSku = line.Product?.Sku,
            ProductBarcode = line.Product?.Barcode,
            PriceRuleId = line.PriceRuleId,
            PriceRuleType = line.PriceRule?.RuleType,
            PriceRuleDescription = line.PriceRule?.Description,
            Quantity = line.Quantity,
            BaseUnitPriceUsd = line.BaseUnitPriceUsd,
            BaseUnitPriceLbp = line.BaseUnitPriceLbp,
            UnitPriceUsd = line.UnitPriceUsd,
            UnitPriceLbp = line.UnitPriceLbp,
            DiscountPercent = line.DiscountPercent,
            TotalUsd = line.TotalUsd,
            TotalLbp = line.TotalLbp,
            CostUsd = line.CostUsd,
            CostLbp = line.CostLbp,
            ProfitUsd = line.ProfitUsd,
            ProfitLbp = line.ProfitLbp,
            QuantityOnHand = line.Product?.Inventory?.QuantityOnHand ?? 0
        };
    }
}

using System.Text.Json.Serialization;

namespace PosBackend.Domain.Entities;

public class TransactionLine : BaseEntity
{
    public Guid TransactionId { get; set; }
    [JsonIgnore]
    public PosTransaction? Transaction { get; set; }
    public Guid ProductId { get; set; }
    [JsonIgnore]
    public Product? Product { get; set; }
    public Guid? PriceRuleId { get; set; }
    [JsonIgnore]
    public PriceRule? PriceRule { get; set; }
    public Guid? OfferId { get; set; }
    [JsonIgnore]
    public Offer? Offer { get; set; }
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
    public bool IsWaste { get; set; }
    public bool HasManualPriceOverride { get; set; }
}

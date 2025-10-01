namespace PosBackend.Domain.Entities;

public class TransactionLine : BaseEntity
{
    public Guid TransactionId { get; set; }
    public PosTransaction? Transaction { get; set; }
    public Guid ProductId { get; set; }
    public Product? Product { get; set; }
    public Guid? PriceRuleId { get; set; }
    public PriceRule? PriceRule { get; set; }
    public decimal Quantity { get; set; }
    public decimal UnitPriceUsd { get; set; }
    public decimal UnitPriceLbp { get; set; }
    public decimal DiscountPercent { get; set; }
    public decimal TotalUsd { get; set; }
    public decimal TotalLbp { get; set; }
}

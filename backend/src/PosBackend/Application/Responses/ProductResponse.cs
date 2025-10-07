namespace PosBackend.Application.Responses;

public class ProductResponse
{
    public Guid Id { get; set; }
    public string? Sku { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Barcode { get; set; } = string.Empty;
    public decimal PriceUsd { get; set; }
    public decimal PriceLbp { get; set; }
    public string? Description { get; set; }
    public string CategoryName { get; set; } = string.Empty;
    public bool IsPinned { get; set; }
    public bool? IsFlagged { get; set; }
    public string? FlagReason { get; set; }
    public decimal QuantityOnHand { get; set; }
    public decimal AverageCostUsd { get; set; }
    public decimal ReorderPoint { get; set; }
    public bool IsReorderAlarmEnabled { get; set; }
}

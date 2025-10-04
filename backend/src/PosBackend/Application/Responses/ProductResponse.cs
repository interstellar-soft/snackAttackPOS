namespace PosBackend.Application.Responses;

public class ProductResponse
{
    public Guid Id { get; set; }
    public string Sku { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Barcode { get; set; } = string.Empty;
    public decimal PriceUsd { get; set; }
    public decimal PriceLbp { get; set; }
    public string? Description { get; set; }
    public string Category { get; set; } = string.Empty;
    public bool IsPinned { get; set; }
    public bool? IsFlagged { get; set; }
    public string? FlagReason { get; set; }
}

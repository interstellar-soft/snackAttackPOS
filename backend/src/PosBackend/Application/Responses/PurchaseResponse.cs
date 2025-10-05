namespace PosBackend.Application.Responses;

public class PurchaseResponse
{
    public Guid Id { get; set; }
    public string SupplierName { get; set; } = string.Empty;
    public string? Reference { get; set; }
    public DateTimeOffset OrderedAt { get; set; }
    public DateTimeOffset? ReceivedAt { get; set; }
    public decimal TotalCostUsd { get; set; }
    public decimal TotalCostLbp { get; set; }
    public decimal ExchangeRateUsed { get; set; }
    public List<PurchaseLineResponse> Lines { get; set; } = new();
}

public class PurchaseLineResponse
{
    public Guid Id { get; set; }
    public Guid ProductId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public string? ProductSku { get; set; }
    public string? CategoryName { get; set; }
    public string Barcode { get; set; } = string.Empty;
    public decimal Quantity { get; set; }
    public decimal UnitCostUsd { get; set; }
    public decimal UnitCostLbp { get; set; }
    public decimal TotalCostUsd { get; set; }
    public decimal TotalCostLbp { get; set; }
    public decimal QuantityOnHand { get; set; }
    public decimal? CurrentSalePriceUsd { get; set; }
}

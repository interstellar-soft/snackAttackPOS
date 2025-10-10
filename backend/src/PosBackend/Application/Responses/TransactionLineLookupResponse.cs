namespace PosBackend.Application.Responses;

public class TransactionLineLookupResponse
{
    public Guid TransactionId { get; set; }
    public Guid LineId { get; set; }
    public Guid ProductId { get; set; }
    public string TransactionNumber { get; set; } = string.Empty;
    public string ProductName { get; set; } = string.Empty;
    public string? ProductSku { get; set; }
    public string? ProductBarcode { get; set; }
    public decimal Quantity { get; set; }
    public decimal TotalUsd { get; set; }
    public decimal TotalLbp { get; set; }
    public decimal UnitPriceUsd { get; set; }
    public decimal UnitPriceLbp { get; set; }
    public decimal CostUsd { get; set; }
    public decimal CostLbp { get; set; }
    public decimal ProfitUsd { get; set; }
    public decimal ProfitLbp { get; set; }
    public DateTime CreatedAt { get; set; }
    public bool IsWaste { get; set; }
    public string TransactionType { get; set; } = string.Empty;

}

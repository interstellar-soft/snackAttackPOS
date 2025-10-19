namespace PosBackend.Application.Responses;

public class CheckoutResponse
{
    public Guid TransactionId { get; set; }
    public string TransactionNumber { get; set; } = string.Empty;
    public decimal TotalUsd { get; set; }
    public decimal TotalLbp { get; set; }
    public decimal PaidUsd { get; set; }
    public decimal PaidLbp { get; set; }
    public decimal BalanceUsd { get; set; }
    public decimal BalanceLbp { get; set; }
    public decimal ExchangeRate { get; set; }
    public IEnumerable<CheckoutLineResponse> Lines { get; set; } = new List<CheckoutLineResponse>();
    public string ReceiptPdfBase64 { get; set; } = string.Empty;
    public bool RequiresOverride { get; set; }
    public string? OverrideReason { get; set; }
    public bool HasManualTotalOverride { get; set; }
    public string? DebtCardName { get; set; }
    public DateTime? DebtSettledAt { get; set; }
}

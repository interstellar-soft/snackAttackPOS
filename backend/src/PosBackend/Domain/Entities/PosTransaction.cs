namespace PosBackend.Domain.Entities;

public enum TransactionType
{
    Sale = 1,
    Return = 2
}

public class PosTransaction : BaseEntity
{
    public string TransactionNumber { get; set; } = string.Empty;
    public TransactionType Type { get; set; } = TransactionType.Sale;
    public Guid UserId { get; set; }
    public User? User { get; set; }
    public decimal ExchangeRateUsed { get; set; }
    public decimal TotalUsd { get; set; }
    public decimal TotalLbp { get; set; }
    public decimal PaidUsd { get; set; }
    public decimal PaidLbp { get; set; }
    public decimal BalanceUsd { get; set; }
    public decimal BalanceLbp { get; set; }
    public bool HasManualTotalOverride { get; set; }
    public string? ReceiptHtml { get; set; }
    public string? DebtCardName { get; set; }
    public DateTime? DebtSettledAt { get; set; }
    public ICollection<TransactionLine> Lines { get; set; } = new List<TransactionLine>();
}

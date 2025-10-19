namespace PosBackend.Application.Responses;

public class DebtCardResponse
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public decimal TotalUsd { get; set; }
    public decimal TotalLbp { get; set; }
    public decimal PaidUsd { get; set; }
    public decimal PaidLbp { get; set; }
    public decimal BalanceUsd { get; set; }
    public decimal BalanceLbp { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime LastTransactionAt { get; set; }
    public List<DebtCardTransactionResponse> Transactions { get; set; } = new();
}

public class DebtCardTransactionResponse
{
    public Guid Id { get; set; }
    public string TransactionNumber { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public decimal TotalUsd { get; set; }
    public decimal TotalLbp { get; set; }
    public decimal PaidUsd { get; set; }
    public decimal PaidLbp { get; set; }
    public decimal BalanceUsd { get; set; }
    public decimal BalanceLbp { get; set; }
    public List<CheckoutLineResponse> Lines { get; set; } = new();
}

using PosBackend.Domain.Entities;

namespace PosBackend.Application.Responses;

public class TransactionResponse
{
    public Guid Id { get; set; }
    public string TransactionNumber { get; set; } = string.Empty;
    public string Type { get; set; } = TransactionType.Sale.ToString();
    public string CashierName { get; set; } = string.Empty;
    public decimal ExchangeRateUsed { get; set; }
    public decimal TotalUsd { get; set; }
    public decimal TotalLbp { get; set; }
    public decimal PaidUsd { get; set; }
    public decimal PaidLbp { get; set; }
    public decimal BalanceUsd { get; set; }
    public decimal BalanceLbp { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public List<CheckoutLineResponse> Lines { get; set; } = new();
}

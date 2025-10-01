namespace PosBackend.Application.Responses;

public class BalanceResponse
{
    public decimal ExchangeRate { get; set; }
    public decimal TotalUsd { get; set; }
    public decimal TotalLbp { get; set; }
    public decimal PaidUsd { get; set; }
    public decimal PaidLbp { get; set; }
    public decimal BalanceUsd { get; set; }
    public decimal BalanceLbp { get; set; }
}

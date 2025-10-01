namespace PosBackend.Application.Requests;

public class ComputeBalanceRequest
{
    public decimal TotalUsd { get; set; }
    public decimal PaidUsd { get; set; }
    public decimal PaidLbp { get; set; }
    public decimal? ExchangeRate { get; set; }
}

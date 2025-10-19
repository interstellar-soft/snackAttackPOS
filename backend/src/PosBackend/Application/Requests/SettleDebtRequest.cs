using System.ComponentModel.DataAnnotations;

namespace PosBackend.Application.Requests;

public class SettleDebtRequest
{
    [Range(0, double.MaxValue)]
    public decimal PaidUsd { get; set; }

    [Range(0, double.MaxValue)]
    public decimal PaidLbp { get; set; }
}

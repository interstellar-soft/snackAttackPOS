using System.ComponentModel.DataAnnotations;
using PosBackend.Application.Services;

namespace PosBackend.Application.Requests;

public class UpdateTransactionRequest
{
    [Range(0, double.MaxValue)]
    public decimal ExchangeRate { get; set; }

    public decimal PaidUsd { get; set; }

    public decimal PaidLbp { get; set; }

    public decimal? ManualTotalUsd { get; set; }

    public decimal? ManualTotalLbp { get; set; }

    public bool SaveToMyCart { get; set; }

    [MinLength(1)]
    public List<CartItemRequest> Items { get; set; } = new();
}

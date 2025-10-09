using PosBackend.Application.Services;

namespace PosBackend.Application.Requests;

public class CheckoutRequest
{
    public decimal ExchangeRate { get; set; } = 90000m;
    public decimal PaidUsd { get; set; }
    public decimal PaidLbp { get; set; }
    public decimal? ManualTotalUsd { get; set; }
    public decimal? ManualTotalLbp { get; set; }
    public bool SaveToMyCart { get; set; }
    public IEnumerable<CartItemRequest> Items { get; set; } = new List<CartItemRequest>();
}

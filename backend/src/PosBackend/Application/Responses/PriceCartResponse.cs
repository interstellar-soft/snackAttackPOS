using System.Collections.Generic;

namespace PosBackend.Application.Responses;

public class PriceCartResponse
{
    public decimal TotalUsd { get; set; }
    public decimal TotalLbp { get; set; }
    public List<CheckoutLineResponse> Lines { get; set; } = new();
}

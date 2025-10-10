using System.Collections.Generic;
using PosBackend.Application.Services;

namespace PosBackend.Application.Requests;

public class PriceCartRequest
{
    public decimal ExchangeRate { get; set; } = 90000m;
    public bool SaveToMyCart { get; set; }
    public IEnumerable<CartItemRequest> Items { get; set; } = new List<CartItemRequest>();
}

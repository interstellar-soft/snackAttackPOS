using System;
using System.Collections.Generic;

namespace PosBackend.Application.Responses;

public class OfferResponse
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public decimal PriceUsd { get; set; }
    public decimal PriceLbp { get; set; }
    public bool IsActive { get; set; }
    public List<OfferItemResponse> Items { get; set; } = new();
}

public class OfferItemResponse
{
    public Guid ProductId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public string? ProductSku { get; set; }
    public string? ProductBarcode { get; set; }
    public decimal Quantity { get; set; }
}

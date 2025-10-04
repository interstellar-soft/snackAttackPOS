using System.ComponentModel.DataAnnotations;

namespace PosBackend.Application.Requests;

public class CreatePurchaseRequest
{
    [MaxLength(180)]
    public string? SupplierName { get; set; }

    [MaxLength(120)]
    public string? Reference { get; set; }

    public DateTimeOffset? PurchasedAt { get; set; }

    [Range(0, double.MaxValue)]
    public decimal ExchangeRate { get; set; }

    [Required]
    public List<CreatePurchaseItemRequest> Items { get; set; } = new();
}

public class CreatePurchaseItemRequest
{
    public Guid? ProductId { get; set; }

    [MaxLength(128)]
    public string Barcode { get; set; } = string.Empty;

    [MaxLength(180)]
    public string? Name { get; set; }

    [MaxLength(120)]
    public string? Sku { get; set; }

    [MaxLength(180)]
    public string? CategoryName { get; set; }

    [Range(0.01, double.MaxValue)]
    public decimal Quantity { get; set; }

    [Range(0.0, double.MaxValue)]
    public decimal UnitCost { get; set; }

    [MaxLength(3)]
    public string Currency { get; set; } = "USD";

    public decimal? SalePriceUsd { get; set; }
}

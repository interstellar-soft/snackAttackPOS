using System.ComponentModel.DataAnnotations;

namespace LitePOS.Api.Entities;

public class Product
{
    public Guid Id { get; set; }

    [MaxLength(160)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(64)]
    public string Sku { get; set; } = string.Empty;

    [MaxLength(64)]
    public string? Barcode { get; set; }

    [MaxLength(500)]
    public string? Description { get; set; }

    public decimal Price { get; set; }
    public decimal Cost { get; set; }

    [MaxLength(50)]
    public string TaxClass { get; set; } = "Standard";

    public bool IsActive { get; set; } = true;

    public Guid CategoryId { get; set; }
    public Category? Category { get; set; }

    public decimal StockQuantity { get; set; }
    public decimal LowStockThreshold { get; set; } = 0;

    public decimal TaxRate { get; set; }

    public string? ImageUrl { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public List<ProductVariant> Variants { get; set; } = new();
    public List<ProductModifier> Modifiers { get; set; } = new();
    public List<InventoryAdjustment> Adjustments { get; set; } = new();
}

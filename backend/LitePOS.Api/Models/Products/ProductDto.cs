namespace LitePOS.Api.Models.Products;

public class ProductDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Sku { get; set; } = string.Empty;
    public string? Barcode { get; set; }
    public string? Description { get; set; }
    public decimal Price { get; set; }
    public decimal Cost { get; set; }
    public string TaxClass { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public Guid CategoryId { get; set; }
    public string CategoryName { get; set; } = string.Empty;
    public decimal StockQuantity { get; set; }
    public decimal LowStockThreshold { get; set; }
    public decimal TaxRate { get; set; }
    public string? ImageUrl { get; set; }
    public List<ProductVariantDto> Variants { get; set; } = new();
    public List<ProductModifierDto> Modifiers { get; set; } = new();
}

public class ProductVariantDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Sku { get; set; }
    public string? Barcode { get; set; }
    public decimal Price { get; set; }
}

public class ProductModifierDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public decimal PriceDelta { get; set; }
}

namespace LitePOS.Api.Models.Products;

public class CreateProductRequest
{
    public string Name { get; set; } = string.Empty;
    public string Sku { get; set; } = string.Empty;
    public string? Barcode { get; set; }
    public string? Description { get; set; }
    public decimal Price { get; set; }
    public decimal Cost { get; set; }
    public string TaxClass { get; set; } = "Standard";
    public bool IsActive { get; set; } = true;
    public Guid CategoryId { get; set; }
    public decimal StockQuantity { get; set; }
    public decimal LowStockThreshold { get; set; }
    public decimal TaxRate { get; set; }
    public string? ImageUrl { get; set; }
    public List<ProductVariantRequest> Variants { get; set; } = new();
    public List<ProductModifierRequest> Modifiers { get; set; } = new();
}

public class ProductVariantRequest
{
    public Guid? Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Sku { get; set; }
    public string? Barcode { get; set; }
    public decimal Price { get; set; }
}

public class ProductModifierRequest
{
    public Guid? Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public decimal PriceDelta { get; set; }
}

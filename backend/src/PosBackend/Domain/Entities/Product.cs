namespace PosBackend.Domain.Entities;

public class Product : BaseEntity
{
    public string? Sku { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Barcode { get; set; } = string.Empty;
    public Guid CategoryId { get; set; }
    public Category? Category { get; set; }
    public decimal PriceUsd { get; set; }
    public decimal PriceLbp { get; set; }
    public bool IsActive { get; set; } = true;
    public bool IsPinned { get; set; }
    public ICollection<ExpirationBatch> ExpirationBatches { get; set; } = new List<ExpirationBatch>();
    public Inventory? Inventory { get; set; }
    public ICollection<PriceRule> PriceRules { get; set; } = new List<PriceRule>();
    public ICollection<ProductBarcode> AdditionalBarcodes { get; set; } = new List<ProductBarcode>();
}

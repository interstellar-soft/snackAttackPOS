namespace LitePOS.Api.Entities;

public class SaleItem
{
    public Guid Id { get; set; }
    public Guid SaleId { get; set; }
    public Sale? Sale { get; set; }
    public Guid ProductId { get; set; }
    public Product? Product { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public string? Sku { get; set; }
    public string? Barcode { get; set; }
    public decimal Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal DiscountPercent { get; set; }
    public decimal TaxAmount { get; set; }
    public decimal LineTotal { get; set; }
    public string? Note { get; set; }
    public string? VariantName { get; set; }
    public string? ModifierName { get; set; }
}

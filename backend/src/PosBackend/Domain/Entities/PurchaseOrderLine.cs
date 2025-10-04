namespace PosBackend.Domain.Entities;

public class PurchaseOrderLine : BaseEntity
{
    public Guid PurchaseOrderId { get; set; }
    public PurchaseOrder? PurchaseOrder { get; set; }
    public Guid ProductId { get; set; }
    public Product? Product { get; set; }
    public string Barcode { get; set; } = string.Empty;
    public decimal Quantity { get; set; }
    public decimal UnitCostUsd { get; set; }
    public decimal UnitCostLbp { get; set; }
    public decimal TotalCostUsd { get; set; }
    public decimal TotalCostLbp { get; set; }
}

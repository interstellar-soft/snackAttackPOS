namespace PosBackend.Domain.Entities;

public enum PurchaseOrderStatus
{
    Draft = 1,
    Submitted = 2,
    Received = 3,
    Cancelled = 4
}

public class PurchaseOrder : BaseEntity
{
    public Guid SupplierId { get; set; }
    public Supplier? Supplier { get; set; }
    public DateTimeOffset OrderedAt { get; set; }
    public DateTimeOffset? ExpectedAt { get; set; }
    public PurchaseOrderStatus Status { get; set; } = PurchaseOrderStatus.Draft;
    public decimal TotalCost { get; set; }
    public string Currency { get; set; } = "USD";
}

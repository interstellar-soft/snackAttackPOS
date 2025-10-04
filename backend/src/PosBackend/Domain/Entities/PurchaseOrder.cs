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
    public string? Reference { get; set; }
    public decimal TotalCostUsd { get; set; }
    public decimal TotalCostLbp { get; set; }
    public decimal ExchangeRateUsed { get; set; }
    public DateTimeOffset? ReceivedAt { get; set; }
    public Guid? CreatedByUserId { get; set; }
    public User? CreatedByUser { get; set; }
    public ICollection<PurchaseOrderLine> Lines { get; set; } = new List<PurchaseOrderLine>();
}

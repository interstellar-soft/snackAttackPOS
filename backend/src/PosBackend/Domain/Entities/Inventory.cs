namespace PosBackend.Domain.Entities;

public class Inventory : BaseEntity
{
    public Guid ProductId { get; set; }
    public Product? Product { get; set; }
    public decimal QuantityOnHand { get; set; }
    public decimal ReorderPoint { get; set; } = 3;
    public decimal ReorderQuantity { get; set; }
    public decimal AverageCostUsd { get; set; }
    public decimal AverageCostLbp { get; set; }
    public DateTimeOffset? LastRestockedAt { get; set; }
    public bool IsReorderAlarmEnabled { get; set; } = true;
}

namespace PosBackend.Domain.Entities;

public class Inventory : BaseEntity
{
    public Guid ProductId { get; set; }
    public Product? Product { get; set; }
    public decimal QuantityOnHand { get; set; }
    public decimal ReorderPoint { get; set; }
    public decimal ReorderQuantity { get; set; }
}

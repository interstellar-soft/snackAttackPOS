namespace LitePOS.Api.Entities;

public class InventoryAdjustment
{
    public Guid Id { get; set; }
    public Guid ProductId { get; set; }
    public Product? Product { get; set; }
    public decimal QuantityChange { get; set; }
    public string Reason { get; set; } = string.Empty;
    public string? Note { get; set; }
    public DateTime CreatedAt { get; set; }
    public Guid? CreatedById { get; set; }
    public AppUser? CreatedBy { get; set; }
}

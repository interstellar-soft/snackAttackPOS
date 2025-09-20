namespace LitePOS.Api.Models.Inventory;

public class InventoryAdjustmentRequest
{
    public Guid ProductId { get; set; }
    public decimal QuantityChange { get; set; }
    public string Reason { get; set; } = string.Empty;
    public string? Note { get; set; }
}

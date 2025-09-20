namespace LitePOS.Api.Models.Sales;

public class CreateSaleItemRequest
{
    public Guid ProductId { get; set; }
    public Guid? VariantId { get; set; }
    public Guid? ModifierId { get; set; }
    public decimal Quantity { get; set; }
    public decimal DiscountPercent { get; set; }
    public string? Note { get; set; }
}

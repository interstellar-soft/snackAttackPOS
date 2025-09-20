namespace LitePOS.Api.Models.Sales;

public class CreateSaleRequest
{
    public Guid? CustomerId { get; set; }
    public List<CreateSaleItemRequest> Items { get; set; } = new();
    public decimal CashPayment { get; set; }
    public decimal CardPayment { get; set; }
    public string? Notes { get; set; }
}

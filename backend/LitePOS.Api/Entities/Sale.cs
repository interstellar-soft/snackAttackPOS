namespace LitePOS.Api.Entities;

public class Sale
{
    public Guid Id { get; set; }
    public string SaleNumber { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public Guid? CustomerId { get; set; }
    public Customer? Customer { get; set; }
    public Guid CreatedById { get; set; }
    public AppUser? CreatedBy { get; set; }
    public decimal Subtotal { get; set; }
    public decimal DiscountTotal { get; set; }
    public decimal TaxTotal { get; set; }
    public decimal Total { get; set; }
    public decimal CashPayment { get; set; }
    public decimal CardPayment { get; set; }
    public decimal ChangeDue { get; set; }
    public string? Notes { get; set; }
    public List<SaleItem> Items { get; set; } = new();
}

namespace LitePOS.Api.Entities;

public class StoreSetting
{
    public int Id { get; set; }
    public string StoreName { get; set; } = "LitePOS";
    public string Currency { get; set; } = "USD";
    public decimal DefaultTaxRate { get; set; } = 0.07m;
    public string ReceiptHeader { get; set; } = "Welcome to LitePOS";
    public string ReceiptFooter { get; set; } = "Thank you for your business!";
    public string? Address { get; set; }
    public string? Phone { get; set; }
}

namespace LitePOS.Api.Models.Settings;

public class StoreSettingDto
{
    public int Id { get; set; }
    public string StoreName { get; set; } = string.Empty;
    public string Currency { get; set; } = string.Empty;
    public decimal DefaultTaxRate { get; set; }
    public string ReceiptHeader { get; set; } = string.Empty;
    public string ReceiptFooter { get; set; } = string.Empty;
    public string? Address { get; set; }
    public string? Phone { get; set; }
}

public class UpdateStoreSettingRequest
{
    public string StoreName { get; set; } = string.Empty;
    public string Currency { get; set; } = "USD";
    public decimal DefaultTaxRate { get; set; }
    public string ReceiptHeader { get; set; } = string.Empty;
    public string ReceiptFooter { get; set; } = string.Empty;
    public string? Address { get; set; }
    public string? Phone { get; set; }
}

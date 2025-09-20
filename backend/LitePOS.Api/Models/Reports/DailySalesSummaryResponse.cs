namespace LitePOS.Api.Models.Reports;

public class DailySalesSummaryResponse
{
    public DateTime Date { get; set; }
    public decimal GrossSales { get; set; }
    public decimal DiscountTotal { get; set; }
    public decimal TaxTotal { get; set; }
    public decimal NetSales { get; set; }
    public List<TopProductResponse> TopProducts { get; set; } = new();
}

public class TopProductResponse
{
    public Guid ProductId { get; set; }
    public string Name { get; set; } = string.Empty;
    public decimal QuantitySold { get; set; }
    public decimal TotalSales { get; set; }
}

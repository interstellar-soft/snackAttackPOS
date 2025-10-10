namespace PosBackend.Domain.Entities;

public class ProductBarcode : BaseEntity
{
    public Guid ProductId { get; set; }
    public Product? Product { get; set; }
    public string Code { get; set; } = string.Empty;
    public int QuantityPerScan { get; set; } = 1;
    public decimal? PriceUsdOverride { get; set; }
    public decimal? PriceLbpOverride { get; set; }
}

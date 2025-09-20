namespace LitePOS.Api.Entities;

public class ProductModifier
{
    public Guid Id { get; set; }
    public Guid ProductId { get; set; }
    public Product? Product { get; set; }
    public string Name { get; set; } = string.Empty;
    public decimal PriceDelta { get; set; }
}

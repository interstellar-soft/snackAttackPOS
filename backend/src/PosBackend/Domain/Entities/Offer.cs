namespace PosBackend.Domain.Entities;

public class Offer : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public decimal PriceUsd { get; set; }
    public decimal PriceLbp { get; set; }
    public bool IsActive { get; set; } = true;
    public ICollection<OfferItem> Items { get; set; } = new List<OfferItem>();
}

public class OfferItem : BaseEntity
{
    public Guid OfferId { get; set; }
    public Offer? Offer { get; set; }
    public Guid ProductId { get; set; }
    public Product? Product { get; set; }
    public decimal Quantity { get; set; }
}

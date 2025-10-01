namespace PosBackend.Domain.Entities;

public class ExpirationBatch : BaseEntity
{
    public Guid ProductId { get; set; }
    public Product? Product { get; set; }
    public string BatchCode { get; set; } = string.Empty;
    public DateOnly ExpirationDate { get; set; }
    public decimal Quantity { get; set; }
}

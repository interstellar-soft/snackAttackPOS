namespace PosBackend.Domain.Entities;

public class PersonalPurchase : BaseEntity
{
    public Guid UserId { get; set; }
    public User? User { get; set; }
    public Guid TransactionId { get; set; }
    public PosTransaction? Transaction { get; set; }
    public decimal TotalUsd { get; set; }
    public decimal TotalLbp { get; set; }
    public DateTime PurchaseDate { get; set; }
}

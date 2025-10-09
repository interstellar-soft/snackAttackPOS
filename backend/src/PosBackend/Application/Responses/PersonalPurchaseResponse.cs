namespace PosBackend.Application.Responses;

public class PersonalPurchaseResponse
{
    public Guid Id { get; set; }
    public Guid TransactionId { get; set; }
    public string TransactionNumber { get; set; } = string.Empty;
    public decimal TotalUsd { get; set; }
    public decimal TotalLbp { get; set; }
    public DateTime PurchaseDate { get; set; }
}

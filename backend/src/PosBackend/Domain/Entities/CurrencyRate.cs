namespace PosBackend.Domain.Entities;

public class CurrencyRate : BaseEntity
{
    public string BaseCurrency { get; set; } = "USD";
    public string QuoteCurrency { get; set; } = "LBP";
    public decimal Rate { get; set; }
    public string? Notes { get; set; }
    public Guid? UserId { get; set; }
    public User? User { get; set; }
}

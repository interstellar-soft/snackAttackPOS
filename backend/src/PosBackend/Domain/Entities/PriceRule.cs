namespace PosBackend.Domain.Entities;

public enum PriceRuleType
{
    Manual = 1,
    Markdown = 2,
    Promotion = 3
}

public class PriceRule : BaseEntity
{
    public Guid ProductId { get; set; }
    public Product? Product { get; set; }
    public PriceRuleType RuleType { get; set; } = PriceRuleType.Manual;
    public decimal DiscountPercent { get; set; }
    public DateTimeOffset StartDate { get; set; }
    public DateTimeOffset? EndDate { get; set; }
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
}

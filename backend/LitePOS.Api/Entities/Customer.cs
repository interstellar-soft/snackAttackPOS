using System.ComponentModel.DataAnnotations;

namespace LitePOS.Api.Entities;

public class Customer
{
    public Guid Id { get; set; }

    [MaxLength(160)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(80)]
    public string? Phone { get; set; }

    [MaxLength(160)]
    public string? Email { get; set; }

    [MaxLength(500)]
    public string? Notes { get; set; }

    public List<Sale> Sales { get; set; } = new();
}

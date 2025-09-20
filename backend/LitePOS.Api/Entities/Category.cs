using System.ComponentModel.DataAnnotations;

namespace LitePOS.Api.Entities;

public class Category
{
    public Guid Id { get; set; }

    [MaxLength(120)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(240)]
    public string? Description { get; set; }

    public bool IsActive { get; set; } = true;

    public List<Product> Products { get; set; } = new();
}

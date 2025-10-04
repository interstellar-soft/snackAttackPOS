using System;
using System.ComponentModel.DataAnnotations;

namespace PosBackend.Application.Requests;

public abstract class ProductMutationRequestBase
{
    [Required]
    public string Name { get; set; } = string.Empty;

    [Required]
    public string Sku { get; set; } = string.Empty;

    [Required]
    public string Barcode { get; set; } = string.Empty;

    public string? Description { get; set; }

    [Required]
    public decimal? Price { get; set; }

    public string? Currency { get; set; }

    [Required]
    public Guid CategoryId { get; set; }
}

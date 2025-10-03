using System;
using System.ComponentModel.DataAnnotations;

namespace PosBackend.Application.Requests;

public class CreateProductRequest
{
    [Required]
    public string Name { get; set; } = string.Empty;

    [Required]
    public string Sku { get; set; } = string.Empty;

    [Required]
    public string Barcode { get; set; } = string.Empty;

    public string? Description { get; set; }

    public decimal PriceUsd { get; set; }

    public decimal PriceLbp { get; set; }

    [Required]
    public Guid CategoryId { get; set; }
}

using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Text.RegularExpressions;

namespace PosBackend.Application.Requests;

public abstract class ProductMutationRequestBase
{
    [Required]
    public string Name { get; set; } = string.Empty;

    public string? Sku { get; set; }

    [Required]
    public string Barcode { get; set; } = string.Empty;

    public string? Description { get; set; }

    [Required]
    public decimal? Price { get; set; }

    public string? Currency { get; set; }

    [Required]
    public string CategoryName
    {
        get => _categoryName;
        set => _categoryName = NormalizeCategoryName(value);
    }

    public bool IsPinned { get; set; }

    public decimal? ReorderPoint { get; set; }

    public List<ProductBarcodeInput>? AdditionalBarcodes { get; set; }

    private static readonly Regex CategoryWhitespaceRegex = new("\\s+", RegexOptions.Compiled);
    private string _categoryName = string.Empty;

    private static string NormalizeCategoryName(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return string.Empty;
        }

        var trimmed = value.Trim();
        return CategoryWhitespaceRegex.Replace(trimmed, " ");
    }
}

public class ProductBarcodeInput
{
    public string Code { get; set; } = string.Empty;
    public int Quantity { get; set; } = 1;
    public decimal? Price { get; set; }
    public string? Currency { get; set; }
}

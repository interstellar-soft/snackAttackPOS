using System;

namespace PosBackend.Application.Responses;

public class ProductResponse
{
    public Guid Id { get; set; }
    public string? Sku { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Barcode { get; set; } = string.Empty;
    public decimal PriceUsd { get; set; }
    public decimal PriceLbp { get; set; }
    public string? Description { get; set; }
    public string CategoryName { get; set; } = string.Empty;
    public bool IsPinned { get; set; }
    public bool? IsFlagged { get; set; }
    public string? FlagReason { get; set; }
    public decimal QuantityOnHand { get; set; }
    public decimal AverageCostUsd { get; set; }
    public decimal ReorderPoint { get; set; }
    public bool IsReorderAlarmEnabled { get; set; }
    public IReadOnlyList<ProductBarcodeResponse> AdditionalBarcodes { get; set; } = Array.Empty<ProductBarcodeResponse>();
    public string ScannedBarcode { get; set; } = string.Empty;
    public int ScannedQuantity { get; set; } = 1;
    public decimal ScannedUnitPriceUsd { get; set; }
    public decimal ScannedUnitPriceLbp { get; set; }
    public decimal ScannedTotalUsd { get; set; }
    public decimal ScannedTotalLbp { get; set; }
    public bool ScannedMergesWithPrimary { get; set; }
}

public class ProductBarcodeResponse
{
    public Guid Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public int QuantityPerScan { get; set; } = 1;
    public decimal? PriceUsdOverride { get; set; }
    public decimal? PriceLbpOverride { get; set; }
}

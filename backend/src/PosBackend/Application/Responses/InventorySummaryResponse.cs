namespace PosBackend.Application.Responses;

public class InventorySummaryResponse
{
    public decimal TotalCostUsd { get; set; }
    public decimal TotalCostLbp { get; set; }
    public IReadOnlyList<InventoryCategorySummary> Categories { get; set; } = Array.Empty<InventoryCategorySummary>();
    public IReadOnlyList<InventoryItemSummary> Items { get; set; } = Array.Empty<InventoryItemSummary>();
}

public class InventoryCategorySummary
{
    public Guid CategoryId { get; set; }
    public string CategoryName { get; set; } = string.Empty;
    public decimal QuantityOnHand { get; set; }
    public decimal TotalCostUsd { get; set; }
    public decimal TotalCostLbp { get; set; }
}

public class InventoryItemSummary
{
    public Guid ProductId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public string? Sku { get; set; }
    public string Barcode { get; set; } = string.Empty;
    public Guid? CategoryId { get; set; }
    public string CategoryName { get; set; } = string.Empty;
    public decimal QuantityOnHand { get; set; }
    public decimal AverageCostUsd { get; set; }
    public decimal AverageCostLbp { get; set; }
    public decimal TotalCostUsd { get; set; }
    public decimal TotalCostLbp { get; set; }
    public decimal ReorderPoint { get; set; }
    public decimal ReorderQuantity { get; set; }
    public bool IsReorderAlarmEnabled { get; set; }
    public bool NeedsReorder { get; set; }
}

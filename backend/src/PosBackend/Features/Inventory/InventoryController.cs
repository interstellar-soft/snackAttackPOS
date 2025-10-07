using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PosBackend.Application.Responses;
using PosBackend.Infrastructure.Data;

namespace PosBackend.Features.Inventory;

[ApiController]
[Route("api/inventory")]
[Authorize(Roles = "Admin,Manager")]
public class InventoryController : ControllerBase
{
    private readonly ApplicationDbContext _db;

    public InventoryController(ApplicationDbContext db)
    {
        _db = db;
    }

    [HttpGet("summary")]
    public async Task<ActionResult<InventorySummaryResponse>> GetInventorySummary(CancellationToken cancellationToken)
    {
        var inventories = await _db.Inventories
            .AsNoTracking()
            .Include(i => i.Product)
            .ThenInclude(p => p!.Category)
            .ToListAsync(cancellationToken);

        if (inventories.Count == 0)
        {
            return new InventorySummaryResponse();
        }

        static decimal Round(decimal value, int decimals = 2) => decimal.Round(value, decimals, MidpointRounding.AwayFromZero);

        var itemSummaries = inventories
            .GroupBy(inventory => inventory.ProductId)
            .Select(group =>
            {
                var sample = group.First();
                var product = sample.Product;
                var category = product?.Category;
                var totalQuantity = group.Sum(item => item.QuantityOnHand);
                var totalCostUsdRaw = group.Sum(item => item.QuantityOnHand * item.AverageCostUsd);
                var totalCostLbpRaw = group.Sum(item => item.QuantityOnHand * item.AverageCostLbp);
                var totalCostUsd = Round(totalCostUsdRaw);
                var totalCostLbp = Round(totalCostLbpRaw);
                var averageCostUsd = totalQuantity > 0
                    ? Round(totalCostUsdRaw / totalQuantity, 4)
                    : Round(sample.AverageCostUsd, 4);
                var averageCostLbp = totalQuantity > 0
                    ? Round(totalCostLbpRaw / totalQuantity)
                    : Round(sample.AverageCostLbp);
                var isAlarmEnabled = sample.IsReorderAlarmEnabled;
                var needsReorder = isAlarmEnabled && totalQuantity <= sample.ReorderPoint;

                return new InventoryItemSummary
                {
                    ProductId = sample.ProductId,
                    ProductName = product?.Name ?? "Unknown",
                    Sku = product?.Sku,
                    Barcode = product?.Barcode ?? string.Empty,
                    CategoryId = category?.Id,
                    CategoryName = category?.Name ?? "Uncategorized",
                    QuantityOnHand = totalQuantity,
                    AverageCostUsd = averageCostUsd,
                    AverageCostLbp = averageCostLbp,
                    TotalCostUsd = totalCostUsd,
                    TotalCostLbp = totalCostLbp,
                    ReorderPoint = sample.ReorderPoint,
                    ReorderQuantity = sample.ReorderQuantity,
                    IsReorderAlarmEnabled = isAlarmEnabled,
                    NeedsReorder = needsReorder
                };
            })
            .OrderByDescending(item => item.TotalCostUsd)
            .ThenBy(item => item.ProductName)
            .ToList();

        var categorySummaries = inventories
            .GroupBy(inventory =>
            {
                var category = inventory.Product?.Category;
                return new
                {
                    Id = category?.Id ?? Guid.Empty,
                    Name = category?.Name ?? "Uncategorized"
                };
            })
            .Select(group =>
            {
                var totalQuantity = group.Sum(item => item.QuantityOnHand);
                var totalCostUsd = Round(group.Sum(item => item.QuantityOnHand * item.AverageCostUsd));
                var totalCostLbp = Round(group.Sum(item => item.QuantityOnHand * item.AverageCostLbp));

                return new InventoryCategorySummary
                {
                    CategoryId = group.Key.Id,
                    CategoryName = group.Key.Name,
                    QuantityOnHand = totalQuantity,
                    TotalCostUsd = totalCostUsd,
                    TotalCostLbp = totalCostLbp
                };
            })
            .OrderByDescending(category => category.TotalCostUsd)
            .ThenBy(category => category.CategoryName)
            .ToList();

        var totalInventoryCostUsd = Round(inventories.Sum(item => item.QuantityOnHand * item.AverageCostUsd));
        var totalInventoryCostLbp = Round(inventories.Sum(item => item.QuantityOnHand * item.AverageCostLbp));

        return new InventorySummaryResponse
        {
            TotalCostUsd = totalInventoryCostUsd,
            TotalCostLbp = totalInventoryCostLbp,
            Categories = categorySummaries,
            Items = itemSummaries
        };
    }
}

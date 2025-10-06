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

        static decimal Round(decimal value) => decimal.Round(value, 2, MidpointRounding.AwayFromZero);

        var itemSummaries = inventories
            .Select(inventory =>
            {
                var product = inventory.Product;
                var category = product?.Category;
                var totalCostUsd = Round(inventory.QuantityOnHand * inventory.AverageCostUsd);
                var totalCostLbp = Round(inventory.QuantityOnHand * inventory.AverageCostLbp);

                return new InventoryItemSummary
                {
                    ProductId = inventory.ProductId,
                    ProductName = product?.Name ?? "Unknown",
                    Sku = product?.Sku,
                    Barcode = product?.Barcode ?? string.Empty,
                    CategoryId = category?.Id,
                    CategoryName = category?.Name ?? "Uncategorized",
                    QuantityOnHand = inventory.QuantityOnHand,
                    AverageCostUsd = inventory.AverageCostUsd,
                    AverageCostLbp = inventory.AverageCostLbp,
                    TotalCostUsd = totalCostUsd,
                    TotalCostLbp = totalCostLbp
                };
            })
            .OrderBy(item => item.CategoryName)
            .ThenBy(item => item.ProductName)
            .ToList();

        var categorySummaries = inventories
            .GroupBy(i => i.Product?.Category)
            .Select(group =>
            {
                var category = group.Key;
                var totalQuantity = group.Sum(item => item.QuantityOnHand);
                var totalCostUsd = Round(group.Sum(item => item.QuantityOnHand * item.AverageCostUsd));
                var totalCostLbp = Round(group.Sum(item => item.QuantityOnHand * item.AverageCostLbp));

                return new InventoryCategorySummary
                {
                    CategoryId = category?.Id ?? Guid.Empty,
                    CategoryName = category?.Name ?? "Uncategorized",
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

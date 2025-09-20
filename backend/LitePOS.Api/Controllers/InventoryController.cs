using System.Linq;
using LitePOS.Api.Data;
using LitePOS.Api.Models.Inventory;
using LitePOS.Api.Responses;
using LitePOS.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LitePOS.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class InventoryController : ControllerBase
{
    private readonly LitePosDbContext _dbContext;
    private readonly InventoryService _inventoryService;

    public InventoryController(LitePosDbContext dbContext, InventoryService inventoryService)
    {
        _dbContext = dbContext;
        _inventoryService = inventoryService;
    }

    [HttpGet("adjustments")]
    public async Task<ActionResult<PagedResponse<object>>> GetAdjustments([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var query = _dbContext.InventoryAdjustments
            .Include(a => a.Product)
            .OrderByDescending(a => a.CreatedAt)
            .AsNoTracking();

        var total = await query.CountAsync();
        var adjustments = await query.Skip((page - 1) * pageSize).Take(pageSize)
            .Select(a => new
            {
                a.Id,
                a.ProductId,
                ProductName = a.Product!.Name,
                a.QuantityChange,
                a.Reason,
                a.Note,
                a.CreatedAt
            }).ToListAsync();

        return new PagedResponse<object>
        {
            Items = adjustments.Cast<object>().ToList(),
            Page = page,
            PageSize = pageSize,
            TotalItems = total
        };
    }

    [HttpPost("adjust")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> AdjustInventory([FromBody] InventoryAdjustmentRequest request)
    {
        var userId = User.Identity?.IsAuthenticated == true ? Guid.Parse(User.FindFirst("sub")!.Value) : (Guid?)null;
        var adjustment = await _inventoryService.AdjustStockAsync(request.ProductId, request.QuantityChange, request.Reason, request.Note, userId);
        if (adjustment == null)
        {
            return NotFound("Product not found");
        }

        return Ok(adjustment);
    }

    [HttpGet("low-stock")]
    public async Task<IActionResult> GetLowStock()
    {
        var items = await _dbContext.Products.AsNoTracking()
            .Where(p => p.StockQuantity <= p.LowStockThreshold)
            .Select(p => new
            {
                p.Id,
                p.Name,
                p.StockQuantity,
                p.LowStockThreshold
            }).ToListAsync();

        return Ok(items);
    }
}

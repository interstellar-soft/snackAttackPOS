using LitePOS.Api.Data;
using LitePOS.Api.Entities;
using Microsoft.EntityFrameworkCore;

namespace LitePOS.Api.Services;

public class InventoryService
{
    private readonly LitePosDbContext _dbContext;

    public InventoryService(LitePosDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<InventoryAdjustment?> AdjustStockAsync(Guid productId, decimal quantityChange, string reason, string? note, Guid? userId)
    {
        var product = await _dbContext.Products.FirstOrDefaultAsync(p => p.Id == productId);
        if (product == null)
        {
            return null;
        }

        product.StockQuantity += quantityChange;
        product.UpdatedAt = DateTime.UtcNow;

        var adjustment = new InventoryAdjustment
        {
            Id = Guid.NewGuid(),
            ProductId = productId,
            QuantityChange = quantityChange,
            Reason = reason,
            Note = note,
            CreatedAt = DateTime.UtcNow,
            CreatedById = userId
        };

        _dbContext.InventoryAdjustments.Add(adjustment);
        await _dbContext.SaveChangesAsync();
        return adjustment;
    }
}

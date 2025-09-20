using LitePOS.Api.Data;
using LitePOS.Api.Entities;
using LitePOS.Api.Models.Sales;
using Microsoft.EntityFrameworkCore;

namespace LitePOS.Api.Services;

public class SaleService
{
    private readonly LitePosDbContext _dbContext;
    private readonly InventoryService _inventoryService;

    public SaleService(LitePosDbContext dbContext, InventoryService inventoryService)
    {
        _dbContext = dbContext;
        _inventoryService = inventoryService;
    }

    public async Task<Sale?> CreateSaleAsync(CreateSaleRequest request, Guid userId)
    {
        if (!request.Items.Any())
        {
            return null;
        }

        var settings = await _dbContext.StoreSettings.FirstAsync();
        var sale = new Sale
        {
            Id = Guid.NewGuid(),
            CreatedAt = DateTime.UtcNow,
            CreatedById = userId,
            CustomerId = request.CustomerId,
            SaleNumber = $"POS-{DateTime.UtcNow:yyyyMMddHHmmss}",
            Notes = request.Notes
        };

        decimal subtotal = 0m;
        decimal discount = 0m;
        decimal tax = 0m;

        foreach (var item in request.Items)
        {
            var product = await _dbContext.Products
                .Include(p => p.Variants)
                .Include(p => p.Modifiers)
                .FirstOrDefaultAsync(p => p.Id == item.ProductId);
            if (product == null)
            {
                return null;
            }

            var variant = item.VariantId.HasValue
                ? product.Variants.FirstOrDefault(v => v.Id == item.VariantId)
                : null;
            var modifier = item.ModifierId.HasValue
                ? product.Modifiers.FirstOrDefault(m => m.Id == item.ModifierId)
                : null;

            var basePrice = variant?.Price ?? product.Price;
            var modifierDelta = modifier?.PriceDelta ?? 0m;
            var unitPrice = basePrice + modifierDelta;
            var lineSubtotal = unitPrice * item.Quantity;
            var lineDiscount = lineSubtotal * (item.DiscountPercent / 100m);
            var taxableAmount = lineSubtotal - lineDiscount;
            var rate = product.TaxRate == 0 ? settings.DefaultTaxRate : product.TaxRate;
            var lineTax = Math.Round(taxableAmount * rate, 2, MidpointRounding.AwayFromZero);
            var lineTotal = taxableAmount + lineTax;

            subtotal += lineSubtotal;
            discount += lineDiscount;
            tax += lineTax;

            sale.Items.Add(new SaleItem
            {
                Id = Guid.NewGuid(),
                ProductId = product.Id,
                ProductName = product.Name,
                Sku = product.Sku,
                Barcode = product.Barcode,
                Quantity = item.Quantity,
                UnitPrice = unitPrice,
                DiscountPercent = item.DiscountPercent,
                TaxAmount = lineTax,
                LineTotal = lineTotal,
                Note = item.Note,
                VariantName = variant?.Name,
                ModifierName = modifier?.Name
            });

            await _inventoryService.AdjustStockAsync(product.Id, -item.Quantity, "Sale", sale.SaleNumber, userId);
        }

        sale.Subtotal = decimal.Round(subtotal, 2);
        sale.DiscountTotal = decimal.Round(discount, 2);
        sale.TaxTotal = decimal.Round(tax, 2);
        sale.Total = decimal.Round(subtotal - discount + tax, 2);
        sale.CashPayment = request.CashPayment;
        sale.CardPayment = request.CardPayment;
        sale.ChangeDue = decimal.Round(request.CashPayment + request.CardPayment - sale.Total, 2);

        if (sale.ChangeDue < 0)
        {
            sale.ChangeDue = 0;
        }

        _dbContext.Sales.Add(sale);
        await _dbContext.SaveChangesAsync();
        return sale;
    }
}

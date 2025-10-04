using System;
using System.Collections.Generic;
using System.Linq;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PosBackend.Application.Requests;
using PosBackend.Application.Responses;
using PosBackend.Application.Services;
using PosBackend.Domain.Entities;
using PosBackend.Features.Common;
using PosBackend.Infrastructure.Data;

namespace PosBackend.Features.Purchases;

[ApiController]
[Route("api/purchases")]
[Authorize(Roles = "Admin,Manager")]
public class PurchasesController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly CurrencyService _currencyService;
    private readonly AuditLogger _auditLogger;

    public PurchasesController(ApplicationDbContext db, CurrencyService currencyService, AuditLogger auditLogger)
    {
        _db = db;
        _currencyService = currencyService;
        _auditLogger = auditLogger;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<PurchaseResponse>>> GetAll(CancellationToken cancellationToken)
    {
        var purchases = await _db.PurchaseOrders
            .Include(p => p.Supplier)
            .Include(p => p.Lines)
                .ThenInclude(l => l.Product)
            .OrderByDescending(p => p.OrderedAt)
            .Take(100)
            .ToListAsync(cancellationToken);

        var responses = purchases.Select(ToResponse).ToList();
        return Ok(responses);
    }

    [HttpPost]
    public async Task<ActionResult<PurchaseResponse>> Create([FromBody] CreatePurchaseRequest request, CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return ValidationProblem(ModelState);
        }

        if (request.Items.Count == 0)
        {
            return BadRequest(new { message = "At least one item is required." });
        }

        var exchangeRate = request.ExchangeRate > 0
            ? request.ExchangeRate
            : (await _currencyService.GetCurrentRateAsync(cancellationToken)).Rate;

        var userId = User.GetCurrentUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        var supplier = await ResolveSupplierAsync(request.SupplierName, cancellationToken);

        var orderedAt = request.PurchasedAt ?? DateTimeOffset.UtcNow;

        var purchase = new PurchaseOrder
        {
            SupplierId = supplier.Id,
            Supplier = supplier,
            OrderedAt = orderedAt,
            ExpectedAt = request.PurchasedAt,
            ReceivedAt = orderedAt,
            Status = PurchaseOrderStatus.Received,
            ExchangeRateUsed = exchangeRate,
            CreatedByUserId = userId,
            Reference = string.IsNullOrWhiteSpace(request.Reference) ? null : request.Reference.Trim(),
            TotalCostUsd = 0m,
            TotalCostLbp = 0m
        };

        var errors = new Dictionary<string, string[]>();
        foreach (var (item, index) in request.Items.Select((value, index) => (value, index)))
        {
            if (item.Quantity <= 0)
            {
                errors[$"Items[{index}].Quantity"] = new[] { "Quantity must be greater than zero." };
                continue;
            }

            if (item.UnitCost < 0)
            {
                errors[$"Items[{index}].UnitCost"] = new[] { "Unit cost cannot be negative." };
                continue;
            }

            var product = await ResolveProductAsync(item, exchangeRate, cancellationToken);
            if (product is null)
            {
                errors[$"Items[{index}].Barcode"] = new[] { "Product details were incomplete." };
                continue;
            }

            var currency = string.IsNullOrWhiteSpace(item.Currency) ? "USD" : item.Currency.ToUpperInvariant();
            decimal unitCostUsd;
            decimal unitCostLbp;
            if (currency == "LBP")
            {
                unitCostUsd = _currencyService.ConvertLbpToUsd(item.UnitCost, exchangeRate);
                unitCostLbp = _currencyService.RoundLbp(item.UnitCost);
            }
            else
            {
                unitCostUsd = _currencyService.RoundUsd(item.UnitCost);
                unitCostLbp = _currencyService.ConvertUsdToLbp(unitCostUsd, exchangeRate);
            }

            var lineQuantity = decimal.Round(item.Quantity, 2, MidpointRounding.AwayFromZero);
            var lineCostUsd = _currencyService.RoundUsd(unitCostUsd * lineQuantity);
            var lineCostLbp = _currencyService.RoundLbp(unitCostLbp * lineQuantity);

            var line = new PurchaseOrderLine
            {
                ProductId = product.Id,
                Product = product,
                Barcode = string.IsNullOrWhiteSpace(item.Barcode) ? product.Barcode : item.Barcode!,
                Quantity = lineQuantity,
                UnitCostUsd = unitCostUsd,
                UnitCostLbp = unitCostLbp,
                TotalCostUsd = lineCostUsd,
                TotalCostLbp = lineCostLbp
            };

            purchase.Lines.Add(line);
            purchase.TotalCostUsd += lineCostUsd;
            purchase.TotalCostLbp += lineCostLbp;

            await UpdateInventoryAsync(product, lineQuantity, unitCostUsd, exchangeRate, cancellationToken);

            if (item.SalePriceUsd.HasValue && item.SalePriceUsd.Value > 0)
            {
                product.PriceUsd = _currencyService.RoundUsd(item.SalePriceUsd.Value);
                product.PriceLbp = _currencyService.ConvertUsdToLbp(product.PriceUsd, exchangeRate);
            }
        }

        if (errors.Count > 0)
        {
            var validationProblem = new ValidationProblemDetails(errors)
            {
                Status = StatusCodes.Status400BadRequest,
                Title = "One or more validation errors occurred."
            };

            return ValidationProblem(validationProblem);
        }

        await _db.PurchaseOrders.AddAsync(purchase, cancellationToken);
        await _db.SaveChangesAsync(cancellationToken);

        await _auditLogger.LogAsync(userId.Value, "Purchase", nameof(PurchaseOrder), purchase.Id, new
        {
            purchase.TotalCostUsd,
            purchase.TotalCostLbp,
            Items = purchase.Lines.Select(l => new { l.ProductId, l.Quantity, l.UnitCostUsd })
        }, cancellationToken);

        var response = ToResponse(purchase);
        return CreatedAtAction(nameof(GetAll), new { id = purchase.Id }, response);
    }

    private async Task<Supplier> ResolveSupplierAsync(string? supplierName, CancellationToken cancellationToken)
    {
        var name = string.IsNullOrWhiteSpace(supplierName) ? "Walk-in Supplier" : supplierName.Trim();
        var supplier = await _db.Suppliers.FirstOrDefaultAsync(s => s.Name.ToLower() == name.ToLower(), cancellationToken);
        if (supplier is not null)
        {
            return supplier;
        }

        supplier = new Supplier { Name = name };
        await _db.Suppliers.AddAsync(supplier, cancellationToken);
        await _db.SaveChangesAsync(cancellationToken);
        return supplier;
    }

    private async Task<Product?> ResolveProductAsync(CreatePurchaseItemRequest item, decimal exchangeRate, CancellationToken cancellationToken)
    {
        Product? product = null;
        if (item.ProductId.HasValue)
        {
            product = await _db.Products.Include(p => p.Category)
                .FirstOrDefaultAsync(p => p.Id == item.ProductId.Value, cancellationToken);
        }
        else if (!string.IsNullOrWhiteSpace(item.Barcode))
        {
            var barcode = item.Barcode.Trim();
            product = await _db.Products.Include(p => p.Category)
                .FirstOrDefaultAsync(p => p.Barcode == barcode, cancellationToken);
        }

        if (product is not null)
        {
            return product;
        }

        if (string.IsNullOrWhiteSpace(item.Name) || string.IsNullOrWhiteSpace(item.Sku) || string.IsNullOrWhiteSpace(item.CategoryName))
        {
            return null;
        }

        var category = await GetOrCreateCategoryAsync(item.CategoryName!, cancellationToken);
        var priceUsd = item.SalePriceUsd.HasValue && item.SalePriceUsd.Value > 0
            ? _currencyService.RoundUsd(item.SalePriceUsd.Value)
            : Math.Max(_currencyService.RoundUsd(item.UnitCost * 1.25m), 0.01m);

        var priceLbp = _currencyService.ConvertUsdToLbp(priceUsd, exchangeRate);

        product = new Product
        {
            Name = item.Name.Trim(),
            Sku = item.Sku.Trim(),
            Barcode = string.IsNullOrWhiteSpace(item.Barcode) ? Guid.NewGuid().ToString("N") : item.Barcode.Trim(),
            CategoryId = category.Id,
            Category = category,
            PriceUsd = priceUsd,
            PriceLbp = priceLbp,
            IsPinned = false,
            IsActive = true
        };

        await _db.Products.AddAsync(product, cancellationToken);
        await _db.SaveChangesAsync(cancellationToken);

        return product;
    }

    private async Task<Category> GetOrCreateCategoryAsync(string categoryName, CancellationToken cancellationToken)
    {
        var normalized = categoryName.Trim();
        var existing = await _db.Categories.FirstOrDefaultAsync(c => c.Name.ToLower() == normalized.ToLower(), cancellationToken);
        if (existing is not null)
        {
            return existing;
        }

        var category = new Category { Name = normalized };
        await _db.Categories.AddAsync(category, cancellationToken);
        await _db.SaveChangesAsync(cancellationToken);
        return category;
    }

    private async Task UpdateInventoryAsync(Product product, decimal quantity, decimal unitCostUsd, decimal exchangeRate, CancellationToken cancellationToken)
    {
        var inventory = await _db.Inventories.FirstOrDefaultAsync(i => i.ProductId == product.Id, cancellationToken);
        if (inventory is null)
        {
            inventory = new Inventory
            {
                ProductId = product.Id,
                QuantityOnHand = 0,
                ReorderPoint = 0,
                ReorderQuantity = 0,
                AverageCostUsd = unitCostUsd,
                AverageCostLbp = _currencyService.ConvertUsdToLbp(unitCostUsd, exchangeRate),
                LastRestockedAt = DateTimeOffset.UtcNow
            };
            await _db.Inventories.AddAsync(inventory, cancellationToken);
        }

        var existingQty = inventory.QuantityOnHand;
        var existingCost = inventory.AverageCostUsd;
        var newQty = existingQty + quantity;
        if (newQty <= 0)
        {
            inventory.QuantityOnHand = 0;
            inventory.AverageCostUsd = unitCostUsd;
            inventory.AverageCostLbp = _currencyService.ConvertUsdToLbp(unitCostUsd, exchangeRate);
        }
        else
        {
            var weightedCost = (existingQty * existingCost) + (quantity * unitCostUsd);
            var newAverage = weightedCost / newQty;
            inventory.QuantityOnHand = newQty;
            inventory.AverageCostUsd = _currencyService.RoundUsd(newAverage);
            inventory.AverageCostLbp = _currencyService.ConvertUsdToLbp(inventory.AverageCostUsd, exchangeRate);
        }

        inventory.LastRestockedAt = DateTimeOffset.UtcNow;
    }

    private PurchaseResponse ToResponse(PurchaseOrder purchase)
    {
        return new PurchaseResponse
        {
            Id = purchase.Id,
            SupplierName = purchase.Supplier?.Name ?? string.Empty,
            Reference = purchase.Reference,
            OrderedAt = purchase.OrderedAt,
            ReceivedAt = purchase.ReceivedAt,
            TotalCostUsd = _currencyService.RoundUsd(purchase.TotalCostUsd),
            TotalCostLbp = _currencyService.RoundLbp(purchase.TotalCostLbp),
            ExchangeRateUsed = purchase.ExchangeRateUsed,
            Lines = purchase.Lines.Select(line => new PurchaseLineResponse
            {
                Id = line.Id,
                ProductId = line.ProductId,
                ProductName = line.Product?.Name ?? string.Empty,
                Barcode = line.Barcode,
                Quantity = line.Quantity,
                UnitCostUsd = line.UnitCostUsd,
                UnitCostLbp = line.UnitCostLbp,
                TotalCostUsd = line.TotalCostUsd,
                TotalCostLbp = line.TotalCostLbp
            }).ToList()
        };
    }
}

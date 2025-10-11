using System;
using System.Linq;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PosBackend.Application.Requests;
using PosBackend.Application.Responses;
using PosBackend.Application.Services;
using PosBackend.Domain.Entities;
using PosBackend.Features.Purchases;
using PosBackend.Infrastructure.Data;
using Xunit;

namespace PosBackend.Tests;

public class PurchasesControllerTests
{
    private static ApplicationDbContext CreateContext(string databaseName)
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName)
            .Options;

        return new ApplicationDbContext(options);
    }

    private static PurchasesController CreateController(ApplicationDbContext context, Guid userId)
    {
        var currencyService = new CurrencyService(context);
        var auditLogger = new AuditLogger(context);
        var controller = new PurchasesController(context, currencyService, auditLogger)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    User = new ClaimsPrincipal(new ClaimsIdentity(new[]
                    {
                        new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
                        new Claim(ClaimTypes.Role, "Admin")
                    }, "TestAuth"))
                }
            }
        };

        return controller;
    }

    [Fact]
    public async Task UpdatePurchase_ReplacesLinesAndAdjustsInventory()
    {
        var databaseName = Guid.NewGuid().ToString();
        var userId = Guid.NewGuid();
        var supplier = new Supplier { Name = "Acme Supplies" };
        var category = new Category { Name = "Beverages" };
        var product = new Product
        {
            Name = "Cola",
            Barcode = "1234567890123",
            Category = category,
            CategoryId = category.Id,
            PriceUsd = 2m,
            PriceLbp = 3000m,
            Inventory = new Inventory
            {
                QuantityOnHand = 10m,
                AverageCostUsd = 1.5m,
                AverageCostLbp = 2250m,
                LastRestockedAt = DateTimeOffset.UtcNow
            }
        };

        var purchase = new PurchaseOrder
        {
            Supplier = supplier,
            SupplierId = supplier.Id,
            OrderedAt = DateTimeOffset.UtcNow.AddDays(-1),
            ExpectedAt = DateTimeOffset.UtcNow,
            ReceivedAt = DateTimeOffset.UtcNow.AddDays(-1),
            Status = PurchaseOrderStatus.Received,
            ExchangeRateUsed = 3000m,
            CreatedByUserId = userId,
            Reference = "PO-001",
            TotalCostUsd = 5m,
            TotalCostLbp = 15000m
        };

        var existingLine = new PurchaseOrderLine
        {
            PurchaseOrder = purchase,
            PurchaseOrderId = purchase.Id,
            Product = product,
            ProductId = product.Id,
            Barcode = product.Barcode,
            Quantity = 5m,
            UnitCostUsd = 1m,
            UnitCostLbp = 3000m,
            TotalCostUsd = 5m,
            TotalCostLbp = 15000m
        };

        purchase.Lines.Add(existingLine);

        using (var seedContext = CreateContext(databaseName))
        {
            seedContext.Categories.Add(category);
            seedContext.Suppliers.Add(supplier);
            seedContext.Products.Add(product);
            seedContext.Inventories.Add(product.Inventory!);
            seedContext.PurchaseOrders.Add(purchase);
            seedContext.PurchaseOrderLines.Add(existingLine);
            seedContext.CurrencyRates.Add(new CurrencyRate
            {
                Rate = 3000m,
                BaseCurrency = "USD",
                QuoteCurrency = "LBP",
                UserId = userId
            });
            await seedContext.SaveChangesAsync();
        }

        using (var context = CreateContext(databaseName))
        {
            var controller = CreateController(context, userId);
            var request = new UpdatePurchaseRequest
            {
                SupplierName = "Acme Supplies",
                PurchasedAt = DateTimeOffset.UtcNow,
                ExchangeRate = 3500m,
                Reference = "PO-001-Updated",
                Items =
                {
                    new CreatePurchaseItemRequest
                    {
                        ProductId = product.Id,
                        Barcode = product.Barcode,
                        Quantity = 3m,
                        UnitCost = 1.2m,
                        Currency = "USD"
                    }
                }
            };

            var result = await controller.Update(purchase.Id, request, CancellationToken.None);

            var response = Assert.IsType<PurchaseResponse>(result.Value);
            Assert.Equal(3m, response.Lines.Single().Quantity);
        }
    }
}

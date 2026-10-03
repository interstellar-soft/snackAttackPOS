using Microsoft.EntityFrameworkCore;
using PosBackend.Application.Services;
using PosBackend.Domain.Entities;
using PosBackend.Infrastructure.Data;
using Xunit;

namespace PosBackend.Tests;

public class BackupServiceTests
{
    [Fact]
    public async Task Export_PreservesWeightBarcodesDebtAndPersonalPurchases()
    {
        await using var db = new ApplicationDbContext(new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        var product = new Product { Name = "Coffee", IsSoldByWeight = true, WeightUnit = "kg" };
        var barcode = new ProductBarcode { ProductId = product.Id, Code = "COFFEE-PACK", QuantityPerScan = 3,
            PriceUsdOverride = 7.5m, PriceLbpOverride = 675000m };
        var sale = new PosTransaction { DebtCardName = "Customer", DebtSettledAt = DateTime.UtcNow,
            HasManualTotalOverride = true };
        var purchase = new PersonalPurchase { TransactionId = sale.Id, TotalUsd = 7.5m,
            PurchaseDate = DateTime.UtcNow };
        db.AddRange(product, barcode, sale, purchase);
        await db.SaveChangesAsync();
        var backup = await new BackupService(db).ExportAsync();
        Assert.Equal(2, backup.SchemaVersion);
        Assert.True(Assert.Single(backup.Products).IsSoldByWeight);
        Assert.Equal("kg", backup.Products[0].WeightUnit);
        var exportedBarcode = Assert.Single(backup.ProductBarcodes);
        Assert.Equal(3, exportedBarcode.QuantityPerScan);
        Assert.Equal(7.5m, exportedBarcode.PriceUsdOverride);
        Assert.Equal(675000m, exportedBarcode.PriceLbpOverride);
        var exportedSale = Assert.Single(backup.Transactions);
        Assert.Equal("Customer", exportedSale.DebtCardName);
        Assert.Equal(sale.DebtSettledAt, exportedSale.DebtSettledAt);
        Assert.True(exportedSale.HasManualTotalOverride);
        Assert.Equal(purchase.Id, Assert.Single(backup.PersonalPurchases).Id);
    }

    [Fact]
    public async Task NewStore_HasOnlyOwnerAndNoDemoProducts()
    {
        await using var db = new ApplicationDbContext(new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        await SeedData.InitializeAsync(db, demoData: false, initialAdminPassword: "A-new-store-password");
        var owner = Assert.Single(await db.Users.ToListAsync());
        Assert.Equal("admin", owner.Username);
        Assert.True(BCrypt.Net.BCrypt.Verify("A-new-store-password", owner.PasswordHash));
        Assert.Empty(await db.Products.ToListAsync());
        await SeedData.InitializeAsync(db, demoData: false);
        Assert.Single(await db.Users.ToListAsync());
    }
}

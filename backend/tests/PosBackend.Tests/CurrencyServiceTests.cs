using Microsoft.EntityFrameworkCore;
using PosBackend.Application.Services;
using PosBackend.Domain.Entities;
using PosBackend.Infrastructure.Data;
using Xunit;

namespace PosBackend.Tests;

public class CurrencyServiceTests
{
    private static ApplicationDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var db = new ApplicationDbContext(options);
        db.CurrencyRates.Add(new CurrencyRate { Rate = 90000m, BaseCurrency = "USD", QuoteCurrency = "LBP" });
        db.SaveChanges();
        return db;
    }

    [Fact]
    public async Task ComputeBalance_MixedTender_ReturnsExpectedChange()
    {
        await using var context = CreateContext();
        var service = new CurrencyService(context);

        var rate = (await service.GetCurrentRateAsync()).Rate;
        var result = service.ComputeBalance(35m, 31m, 0m, rate);

        Assert.Equal(35m, result.totalUsd);
        Assert.Equal(3150000m, result.totalLbp);
        Assert.Equal(4m, result.balanceUsd);
        Assert.Equal(360000m, result.balanceLbp);
    }

    [Fact]
    public async Task ComputeBalance_LbpOnly_ReturnsUsdChange()
    {
        await using var context = CreateContext();
        var service = new CurrencyService(context);
        var rate = (await service.GetCurrentRateAsync()).Rate;

        var result = service.ComputeBalance(36.67m, 0m, 3300000m, rate);

        Assert.Equal(36.67m, result.totalUsd);
        Assert.Equal(3300000m, result.totalLbp);
        Assert.Equal(-1.67m, result.balanceUsd);
        Assert.Equal(-150000m, result.balanceLbp);
    }
}

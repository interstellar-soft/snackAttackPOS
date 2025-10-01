using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using PosBackend.Application.Responses;
using PosBackend.Domain.Entities;
using PosBackend.Features.Analytics;
using PosBackend.Infrastructure.Data;
using Xunit;

namespace PosBackend.Tests;

public class AnalyticsControllerTests
{
    private static ApplicationDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var context = new ApplicationDbContext(options);
        context.Database.EnsureCreated();

        var category = new Category { Name = "Produce" };
        var product = new Product
        {
            Category = category,
            Name = "Seed Apple",
            Sku = "APP-001",
            Barcode = "1234567890123",
            PriceUsd = 2.50m,
            PriceLbp = 225000m
        };

        var user = new User
        {
            Username = "tester",
            DisplayName = "QA",
            Role = UserRole.Manager,
            PasswordHash = "hash"
        };

        var transaction = new PosTransaction
        {
            TransactionNumber = "T0001",
            User = user,
            ExchangeRateUsed = 90000m,
            TotalUsd = 50m,
            TotalLbp = 4500000m,
            PaidUsd = 50m,
            PaidLbp = 0m,
            BalanceUsd = 0m,
            BalanceLbp = 0m,
            CreatedAt = DateTime.UtcNow.AddDays(-2)
        };

        transaction.Lines.Add(new TransactionLine
        {
            Product = product,
            Quantity = 10,
            UnitPriceUsd = 5m,
            UnitPriceLbp = 450000m,
            TotalUsd = 50m,
            TotalLbp = 4500000m
        });

        context.Categories.Add(category);
        context.Products.Add(product);
        context.Users.Add(user);
        context.Transactions.Add(transaction);
        context.TransactionLines.AddRange(transaction.Lines);

        context.SaveChanges();

        return context;
    }

    [Fact]
    public async Task Dashboard_ComputesKeyMetrics()
    {
        await using var context = CreateContext();
        var controller = new AnalyticsController(context);

        var result = await controller.GetDashboard(CancellationToken.None);

        var response = Assert.IsType<AnalyticsDashboardResponse>(result.Value);
        Assert.Contains(response.ProfitLeaders, metric => metric.Label == "Seed Apple");
        Assert.NotEmpty(response.ProfitMargins);
        Assert.NotEmpty(response.SeasonalForecast);
        Assert.All(response.CurrencyMixTrend, point =>
        {
            Assert.True(point.Usd >= 0);
            Assert.True(point.Lbp >= 0);
        });
    }
}

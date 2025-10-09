using System;
using System.Linq;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PosBackend.Application.Responses;
using PosBackend.Application.Services;
using PosBackend.Domain.Entities;
using PosBackend.Infrastructure.Data;
using Xunit;

namespace PosBackend.Tests;

public class InventoryControllerApiTests : IClassFixture<InventoryApiFactory>
{
    private readonly InventoryApiFactory _factory;

    public InventoryControllerApiTests(InventoryApiFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task GetInventorySummary_WithManagerRole_ReturnsAggregatedInventory()
    {
        var client = _factory.CreateClient();

        using var scope = _factory.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var tokenService = scope.ServiceProvider.GetRequiredService<JwtTokenService>();
        var manager = await context.Users.FirstAsync(u => u.Username == "manager");
        var token = tokenService.CreateToken(manager);

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await client.GetAsync("/api/inventory/summary");

        response.EnsureSuccessStatusCode();

        var summary = await response.Content.ReadFromJsonAsync<InventorySummaryResponse>();
        Assert.NotNull(summary);
        Assert.NotEmpty(summary!.Items);
        Assert.NotEmpty(summary.Categories);
        Assert.True(summary.TotalCostUsd > 0);
        Assert.True(summary.TotalCostLbp > 0);
    }

    [Fact]
    public async Task GetInventorySummary_IncludesEmptyCategories_WhenNoInventory()
    {
        var client = _factory.CreateClient();

        using var scope = _factory.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var tokenService = scope.ServiceProvider.GetRequiredService<JwtTokenService>();
        var manager = await context.Users.FirstAsync(u => u.Username == "manager");
        var token = tokenService.CreateToken(manager);

        context.Inventories.RemoveRange(context.Inventories);
        context.Products.RemoveRange(context.Products);
        context.Categories.RemoveRange(context.Categories);
        await context.SaveChangesAsync();

        await context.Categories.AddRangeAsync(
            new Category { Name = "Beverages" },
            new Category { Name = "Snacks" });
        await context.SaveChangesAsync();

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await client.GetAsync("/api/inventory/summary");
        response.EnsureSuccessStatusCode();

        var summary = await response.Content.ReadFromJsonAsync<InventorySummaryResponse>();
        Assert.NotNull(summary);
        Assert.Empty(summary!.Items);
        Assert.Contains(summary.Categories, c => c.CategoryName == "Beverages" && c.TotalCostUsd == 0);
        Assert.Contains(summary.Categories, c => c.CategoryName == "Snacks" && c.QuantityOnHand == 0);
    }

    [Fact]
    public async Task GetInventorySummary_AggregatesByCategoryAndProduct()
    {
        var client = _factory.CreateClient();

        using var scope = _factory.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var tokenService = scope.ServiceProvider.GetRequiredService<JwtTokenService>();
        var manager = await context.Users.FirstAsync(u => u.Username == "manager");
        var token = tokenService.CreateToken(manager);

        var category = new Category { Name = "Test Confections" };

        var chocolateBar = new Product
        {
            Name = "Chocolate Bar",
            Sku = "CHO-001",
            Barcode = "1000000000001",
            Category = category,
            CategoryId = category.Id,
            PriceUsd = 4m,
            PriceLbp = 360000m
        };

        var softDrink = new Product
        {
            Name = "Soft Drink",
            Sku = "SOF-001",
            Barcode = "1000000000002",
            Category = category,
            CategoryId = category.Id,
            PriceUsd = 3m,
            PriceLbp = 270000m
        };

        await context.Categories.AddAsync(category);
        await context.Products.AddRangeAsync(chocolateBar, softDrink);

        await context.Inventories.AddRangeAsync(
            new Inventory
            {
                Product = chocolateBar,
                QuantityOnHand = 10m,
                AverageCostUsd = 1.50m,
                AverageCostLbp = 135000m,
                ReorderPoint = 12m,
                ReorderQuantity = 10m,
                IsReorderAlarmEnabled = true,
                LastRestockedAt = DateTimeOffset.UtcNow.AddDays(-2)
            },
            new Inventory
            {
                Product = chocolateBar,
                QuantityOnHand = 5m,
                AverageCostUsd = 1.60m,
                AverageCostLbp = 144000m,
                ReorderPoint = 12m,
                ReorderQuantity = 10m,
                IsReorderAlarmEnabled = true,
                LastRestockedAt = DateTimeOffset.UtcNow.AddDays(-1)
            },
            new Inventory
            {
                Product = softDrink,
                QuantityOnHand = 8m,
                AverageCostUsd = 2.00m,
                AverageCostLbp = 180000m,
                ReorderPoint = 5m,
                ReorderQuantity = 10m,
                IsReorderAlarmEnabled = false,
                LastRestockedAt = DateTimeOffset.UtcNow.AddDays(-3)
            });

        await context.SaveChangesAsync();

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await client.GetAsync("/api/inventory/summary");
        response.EnsureSuccessStatusCode();

        var summary = await response.Content.ReadFromJsonAsync<InventorySummaryResponse>();
        Assert.NotNull(summary);

        var categorySummary = summary!.Categories.Single(c => c.CategoryName == category.Name);
        Assert.Equal(39m, categorySummary.TotalCostUsd);
        Assert.Equal(23m, summary.Items.Single(i => i.ProductId == chocolateBar.Id).TotalCostUsd);
        Assert.Equal(1, summary.Categories.Count(c => c.CategoryName == category.Name));
        Assert.Equal(1, summary.Items.Count(i => i.ProductId == chocolateBar.Id));
        var chocolateItem = summary.Items.Single(i => i.ProductId == chocolateBar.Id);
        Assert.True(chocolateItem.IsReorderAlarmEnabled);
        Assert.Equal(12m, chocolateItem.ReorderPoint);
        Assert.False(chocolateItem.NeedsReorder);
        Assert.Equal(10m, chocolateItem.ReorderQuantity);
    }

    [Fact]
    public async Task GetInventorySummary_FlagsReorderAlarmWhenQuantityBelowThreshold()
    {
        var client = _factory.CreateClient();

        using var scope = _factory.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var tokenService = scope.ServiceProvider.GetRequiredService<JwtTokenService>();
        var manager = await context.Users.FirstAsync(u => u.Username == "manager");
        var token = tokenService.CreateToken(manager);

        var snacks = new Category { Name = "Trail Snacks" };
        var trailMix = new Product
        {
            Name = "Trail Mix",
            Sku = "SNK-001",
            Barcode = "9000000000001",
            Category = snacks,
            CategoryId = snacks.Id,
            PriceUsd = 5m,
            PriceLbp = 450000m
        };

        await context.Categories.AddAsync(snacks);
        await context.Products.AddAsync(trailMix);

        await context.Inventories.AddAsync(new Inventory
        {
            Product = trailMix,
            QuantityOnHand = 4m,
            AverageCostUsd = 3m,
            AverageCostLbp = 270000m,
            ReorderPoint = 6m,
            ReorderQuantity = 12m,
            IsReorderAlarmEnabled = true,
            LastRestockedAt = DateTimeOffset.UtcNow.AddDays(-5)
        });

        await context.SaveChangesAsync();

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await client.GetAsync("/api/inventory/summary");
        response.EnsureSuccessStatusCode();

        var summary = await response.Content.ReadFromJsonAsync<InventorySummaryResponse>();
        Assert.NotNull(summary);

        var trailMixSummary = summary!.Items.Single(i => i.ProductId == trailMix.Id);
        Assert.True(trailMixSummary.IsReorderAlarmEnabled);
        Assert.True(trailMixSummary.NeedsReorder);
        Assert.Equal(6m, trailMixSummary.ReorderPoint);
        Assert.Equal(4m, trailMixSummary.QuantityOnHand);
        Assert.Equal(12m, trailMixSummary.ReorderQuantity);
    }
}

public class InventoryApiFactory : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");

        builder.ConfigureServices(services =>
        {
            var descriptor = services.SingleOrDefault(
                d => d.ServiceType == typeof(DbContextOptions<ApplicationDbContext>));

            if (descriptor is not null)
            {
                services.Remove(descriptor);
            }

            services.AddDbContext<ApplicationDbContext>(options =>
                options.UseInMemoryDatabase($"InventoryTests-{Guid.NewGuid()}")
                       .EnableSensitiveDataLogging());
        });
    }
}

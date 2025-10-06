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

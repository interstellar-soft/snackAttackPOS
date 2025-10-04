using System;
using System.Linq;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PosBackend.Application.Requests;
using PosBackend.Application.Responses;
using PosBackend.Application.Services;
using PosBackend.Infrastructure.Data;
using Xunit;

namespace PosBackend.Tests;

public class SettingsControllerApiTests : IClassFixture<SettingsApiFactory>
{
    private readonly SettingsApiFactory _factory;

    public SettingsControllerApiTests(SettingsApiFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task UpdateStoreProfile_WithValidJwt_UpdatesProfileAndCreatesAuditLog()
    {
        var client = _factory.CreateClient();

        using var scope = _factory.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var tokenService = scope.ServiceProvider.GetRequiredService<JwtTokenService>();
        var user = await context.Users.FirstAsync(u => u.Username == "admin");
        var token = tokenService.CreateToken(user);

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var updateRequest = new UpdateStoreProfileRequest
        {
            Name = "Integration Test Market"
        };

        var response = await client.PutAsJsonAsync("/api/settings/store-profile", updateRequest);

        response.EnsureSuccessStatusCode();

        var body = await response.Content.ReadFromJsonAsync<StoreProfileResponse>();
        Assert.NotNull(body);
        Assert.Equal(updateRequest.Name, body!.Name);

        using var verificationScope = _factory.Services.CreateScope();
        var verificationContext = verificationScope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var storedProfile = await verificationContext.StoreProfiles.AsNoTracking().SingleAsync();
        Assert.Equal(updateRequest.Name, storedProfile.Name);

        var auditLog = await verificationContext.AuditLogs.AsNoTracking()
            .OrderByDescending(a => a.CreatedAt)
            .FirstOrDefaultAsync();
        Assert.NotNull(auditLog);
        Assert.Equal("UpdateStoreProfile", auditLog!.Action);
        Assert.Equal(storedProfile.Id, auditLog.EntityId);
        Assert.Equal(user.Id, auditLog.UserId);
    }
}

public class SettingsApiFactory : WebApplicationFactory<Program>
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
                options.UseInMemoryDatabase($"SettingsTests-{Guid.NewGuid()}")
                       .EnableSensitiveDataLogging());
        });
    }
}

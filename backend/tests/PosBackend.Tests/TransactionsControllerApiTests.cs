using System.Collections.Generic;
using System.IdentityModel.Tokens.Jwt;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using PosBackend.Application.Requests;
using PosBackend.Application.Responses;
using PosBackend.Application.Services;
using PosBackend.Infrastructure.Data;
using Xunit;

namespace PosBackend.Tests;

public class TransactionsControllerApiTests : IClassFixture<TransactionsApiFactory>
{
    private readonly TransactionsApiFactory _factory;

    public TransactionsControllerApiTests(TransactionsApiFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Checkout_WithValidRequest_PersistsTransaction()
    {
        var client = _factory.CreateClient();

        using var scope = _factory.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var tokenService = scope.ServiceProvider.GetRequiredService<JwtTokenService>();

        var user = await context.Users.FirstAsync(u => u.Username == "cashier");
        var product = await context.Products.AsNoTracking().FirstAsync();
        var token = tokenService.CreateToken(user);

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var request = new CheckoutRequest
        {
            ExchangeRate = 90000m,
            PaidUsd = product.PriceUsd * 2,
            Items = new[]
            {
                new CartItemRequest(product.Id, 2, null, null)
            }
        };

        var response = await client.PostAsJsonAsync("/api/transactions/checkout", request);

        response.EnsureSuccessStatusCode();

        var body = await response.Content.ReadFromJsonAsync<CheckoutResponse>();
        Assert.NotNull(body);
        Assert.NotEqual(Guid.Empty, body!.TransactionId);
        Assert.False(body.RequiresOverride);

        using var verificationScope = _factory.Services.CreateScope();
        var verificationContext = verificationScope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var persisted = await verificationContext.Transactions.Include(t => t.Lines)
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == body.TransactionId);

        Assert.NotNull(persisted);
        Assert.Equal(user.Id, persisted!.UserId);
        Assert.Single(persisted.Lines);
    }

    [Fact]
    public async Task Checkout_WithTokenContainingOnlySubClaim_Succeeds()
    {
        var client = _factory.CreateClient();

        using var scope = _factory.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var jwtOptions = scope.ServiceProvider.GetRequiredService<IOptions<JwtOptions>>().Value;

        var user = await context.Users.FirstAsync(u => u.Username == "cashier");
        var product = await context.Products.AsNoTracking().FirstAsync();

        var tokenHandler = new JwtSecurityTokenHandler();
        var securityToken = tokenHandler.CreateToken(new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(new[]
            {
                new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString())
            }),
            Expires = DateTime.UtcNow.AddMinutes(jwtOptions.ExpiryMinutes),
            Issuer = jwtOptions.Issuer,
            Audience = jwtOptions.Audience,
            SigningCredentials = new SigningCredentials(
                new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtOptions.Key)),
                SecurityAlgorithms.HmacSha256)
        });

        var token = tokenHandler.WriteToken(securityToken);

        var originalMapInboundClaims = JwtSecurityTokenHandler.DefaultMapInboundClaims;
        JwtSecurityTokenHandler.DefaultMapInboundClaims = false;

        try
        {
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

            var request = new CheckoutRequest
            {
                ExchangeRate = 90000m,
                PaidUsd = product.PriceUsd * 2,
                Items = new[]
                {
                    new CartItemRequest(product.Id, 2, null, null)
                }
            };

            var response = await client.PostAsJsonAsync("/api/transactions/checkout", request);

            response.EnsureSuccessStatusCode();

            var body = await response.Content.ReadFromJsonAsync<CheckoutResponse>();
            Assert.NotNull(body);
            Assert.NotEqual(Guid.Empty, body!.TransactionId);
        }
        finally
        {
            JwtSecurityTokenHandler.DefaultMapInboundClaims = originalMapInboundClaims;
        }
    }
}

public class TransactionsApiFactory : WebApplicationFactory<Program>
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
                options.UseInMemoryDatabase($"TransactionsTests-{Guid.NewGuid()}")
                       .EnableSensitiveDataLogging());
        });

        builder.ConfigureTestServices(services =>
        {
            services.AddSingleton<MlClient>(_ =>
            {
                var handler = new StubHttpMessageHandler();
                var configuration = new ConfigurationBuilder()
                    .AddInMemoryCollection(new Dictionary<string, string>
                    {
                        ["MlService:BaseUrl"] = "http://localhost"
                    })
                    .Build();
                return new MlClient(new HttpClient(handler), configuration);
            });
        });
    }

    private sealed class StubHttpMessageHandler : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            if (request.RequestUri is null)
            {
                return Task.FromResult(new HttpResponseMessage(HttpStatusCode.BadRequest));
            }

            if (request.RequestUri.AbsolutePath.Contains("vision", StringComparison.OrdinalIgnoreCase))
            {
                var visionResult = new MlClient.VisionResult("match", 0.95, true);
                return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
                {
                    Content = JsonContent.Create(visionResult)
                });
            }

            var anomalyResult = new MlClient.AnomalyResult(false, 0.1, null);
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = JsonContent.Create(anomalyResult)
            });
        }
    }
}

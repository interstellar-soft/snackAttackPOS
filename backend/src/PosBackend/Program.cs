using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using QuestPDF.Infrastructure;
using PosBackend;
using PosBackend.Application.Services;
using PosBackend.Infrastructure.Data;
using Npgsql;

var builder = WebApplication.CreateBuilder(args);

QuestPDF.Settings.License = LicenseType.Community;

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.Configure<JwtOptions>(builder.Configuration.GetSection("Jwt"));
builder.Services.Configure<FeatureFlags>(builder.Configuration.GetSection("FeatureFlags"));

builder.Services.AddSingleton<PosEventHub>();
builder.Services.AddSingleton<ScanWatchdog>();
builder.Services.AddScoped<JwtTokenService>();
builder.Services.AddScoped<CartPricingService>();
builder.Services.AddScoped<StoreProfileService>();
builder.Services.AddScoped<ReceiptRenderer>();
builder.Services.AddScoped<AuditLogger>();
builder.Services.AddScoped<CurrencyService>();
builder.Services.AddScoped<BackupService>();
builder.Services.AddHttpClient<MlClient>();

var rawConnectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? throw new InvalidOperationException("Connection string 'DefaultConnection' not found.");

var connectionString = rawConnectionString;
var connectionHostOverridden = false;

var isRunningInContainer = string.Equals(
    Environment.GetEnvironmentVariable("DOTNET_RUNNING_IN_CONTAINER"),
    "true",
    StringComparison.OrdinalIgnoreCase);

if (isRunningInContainer)
{
    var connectionBuilder = new NpgsqlConnectionStringBuilder(connectionString);
    if (string.IsNullOrWhiteSpace(connectionBuilder.Host) ||
        string.Equals(connectionBuilder.Host, "localhost", StringComparison.OrdinalIgnoreCase))
    {
        connectionBuilder.Host = "db";
        connectionString = connectionBuilder.ConnectionString;
        connectionHostOverridden = true;
    }
}

builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseNpgsql(connectionString));

var jwtOptions = builder.Configuration.GetSection("Jwt").Get<JwtOptions>() ?? new JwtOptions();

const int MinimumJwtKeyLengthBytes = 16;
if (string.IsNullOrWhiteSpace(jwtOptions.Key) ||
    Encoding.UTF8.GetByteCount(jwtOptions.Key) < MinimumJwtKeyLengthBytes)
{
    throw new InvalidOperationException(
        "JWT signing key is missing or invalid. Ensure ConnectionStrings__DefaultConnection and Jwt__Key are set to secure values.");
}

var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtOptions.Key));

builder.Services.AddAuthentication(options =>
    {
        options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
        options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
    })
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtOptions.Issuer,
            ValidAudience = jwtOptions.Audience,
            IssuerSigningKey = signingKey
        };
    });

builder.Services.AddAuthorization();
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
        policy.AllowAnyHeader().AllowAnyMethod().AllowCredentials().SetIsOriginAllowed(_ => true));
});

var app = builder.Build();

if (connectionHostOverridden)
{
    var logger = app.Services.GetRequiredService<ILogger<Program>>();
    logger.LogWarning(
        "Connection string host was overridden to '{Host}' because DOTNET_RUNNING_IN_CONTAINER was set.",
        "db");
}

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    await SeedData.InitializeAsync(db);
}

app.UseSwagger();
app.UseSwaggerUI();

app.UseRouting();
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapGet("/health", () => Results.Ok(new { status = "ok", service = "backend" }));

app.MapGet("/seed", async (ApplicationDbContext db, CancellationToken cancellationToken) =>
{
    await SeedData.InitializeAsync(db, cancellationToken);
    return Results.Ok(new { status = "seeded" });
});

app.Run();

public partial class Program;

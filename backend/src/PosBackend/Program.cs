using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using QuestPDF.Infrastructure;
using PosBackend;
using PosBackend.Application.Middleware;
using PosBackend.Application.Services;
using PosBackend.Infrastructure.Data;
using Npgsql;
using Microsoft.AspNetCore.DataProtection;

var builder = WebApplication.CreateBuilder(args);
// Desktop logs are captured by the launcher; do not require Windows Event Log access.
if (builder.Configuration.GetValue<bool>("Desktop:Enabled") || builder.Environment.IsEnvironment("Testing"))
{
    builder.Logging.ClearProviders();
    builder.Logging.AddConsole();
}

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
var syncProtection = builder.Services.AddDataProtection().SetApplicationName("Aurora.POS.MobileSync");
if (OperatingSystem.IsWindows()) syncProtection.ProtectKeysWithDpapi();
if (builder.Configuration["MobileSync:KeyDirectory"] is { Length: > 0 } keyDirectory)
    syncProtection.PersistKeysToFileSystem(new DirectoryInfo(keyDirectory));
builder.Services.AddHttpClient("mobile-sync", client => client.Timeout = TimeSpan.FromSeconds(60))
    .ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler { AllowAutoRedirect = false });
builder.Services.AddScoped<MobileSyncService>();
builder.Services.AddScoped<MobilePurchaseService>();
builder.Services.AddHostedService<MobileSyncWorker>();

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

if (string.IsNullOrWhiteSpace(builder.Configuration["Jwt:Key"]) &&
    (builder.Environment.IsDevelopment() || builder.Environment.IsEnvironment("Testing")))
    builder.Configuration["Jwt:Key"] = "development-only-signing-key-never-use-in-production";
var jwtOptions = builder.Configuration.GetSection("Jwt").Get<JwtOptions>() ?? new JwtOptions();

const int MinimumJwtKeyLengthBytes = 32;
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
    var origins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
        ?? new[] { "http://localhost:5173", "http://127.0.0.1:5173" };
    options.AddDefaultPolicy(policy => policy.WithOrigins(origins).AllowAnyHeader().AllowAnyMethod());
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
    await SeedData.InitializeAsync(db, demoData: builder.Configuration.GetValue("Seed:DemoData",
        builder.Environment.IsDevelopment() || builder.Environment.IsEnvironment("Testing")),
        initialAdminPassword: builder.Configuration["Seed:AdminPassword"]);
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

if (app.Configuration.GetValue<bool>("Desktop:Enabled"))
{
    app.UseDefaultFiles();
    app.UseStaticFiles();
}

app.UseMiddleware<ExceptionHandlingMiddleware>();

app.UseRouting();
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapGet("/health", () => Results.Ok(new { status = "ok", service = "backend" }));

app.Run();

public partial class Program;

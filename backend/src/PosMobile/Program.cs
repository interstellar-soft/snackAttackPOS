using System.Text.Json;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;
using Npgsql;
using PosMobile;
using PosSync;

var builder = WebApplication.CreateBuilder(args);
var hosting = HostingSettings.Read(builder.Configuration);
builder.WebHost.ConfigureKestrel(options => options.Limits.MaxRequestBodySize = 50 * 1024 * 1024);
builder.Services.AddSingleton(NpgsqlDataSource.Create(HostingSettings.DatabaseConnection(builder.Configuration)));
builder.Services.AddSingleton<MobileDatabase>();
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = 429;
    options.AddPolicy("credentials", context => RateLimitPartition.GetFixedWindowLimiter(
        context.Connection.RemoteIpAddress?.ToString() ?? "unknown", _ => new FixedWindowRateLimiterOptions
        { PermitLimit = 10, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
});
var app = builder.Build();
await app.Services.GetRequiredService<MobileDatabase>().Initialize(builder.Configuration);
app.Use(async (context, next) =>
{
    if (hosting.PublicOrigin != null)
    {
        context.Response.Headers["Strict-Transport-Security"] = "max-age=31536000";
        if (!context.Request.Path.StartsWithSegments("/health") &&
            !string.Equals(context.Request.Host.Host, hosting.PublicOrigin.Host, StringComparison.OrdinalIgnoreCase))
        { context.Response.StatusCode = 400; return; }
        var origin = context.Request.Headers.Origin.ToString();
        if (context.Request.Method != "GET" && origin.Length > 0 &&
            !string.Equals(origin, hosting.PublicOrigin.GetLeftPart(UriPartial.Authority), StringComparison.OrdinalIgnoreCase))
        { context.Response.StatusCode = 403; return; }
    }
    context.Response.Headers["X-Content-Type-Options"] = "nosniff";
    context.Response.Headers["Referrer-Policy"] = "no-referrer";
    context.Response.Headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'; style-src 'self'; img-src 'self' blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'";
    if (context.Request.Path.StartsWithSegments("/api")) context.Response.Headers.CacheControl = "no-store";
    try { await next(); }
    catch (SyncConflictException) { context.Response.StatusCode = 409; await context.Response.WriteAsJsonAsync(new { message = "Sync cursor changed. Refresh the checkpoint and retry." }); }
    catch (Exception ex) when (ex is ArgumentException or InvalidOperationException or JsonException)
    { context.Response.StatusCode = 400; await context.Response.WriteAsJsonAsync(new { message = "Invalid request. Check the input and try again." }); }
    catch (Exception ex)
    { app.Logger.LogError("Mobile request failed: {Type}", ex.GetType().Name); context.Response.StatusCode = 500; await context.Response.WriteAsJsonAsync(new { message = "The mobile service could not complete the request." }); }
});
app.UseDefaultFiles();
app.UseStaticFiles(new StaticFileOptions { OnPrepareResponse = c => c.Context.Response.Headers.CacheControl = "no-cache" });
app.UseRouting();
app.UseRateLimiter();
app.Use(async (context, next) =>
{
    var path = context.Request.Path;
    // Custom header + JSON endpoints + no CORS: cross-origin forms and scripts cannot mutate cookie-authenticated state.
    if ((path.StartsWithSegments("/api/admin") || path.StartsWithSegments("/api/auth")) &&
        context.Request.Method != "GET" && context.Request.Headers["X-Aurora-Request"] != "1")
    { context.Response.StatusCode = 403; return; }
    if (path.StartsWithSegments("/api/admin") || path == "/api/auth/session")
    {
        var cookie = context.Request.Cookies["aurora_mobile_session"];
        if (cookie == null) { context.Response.StatusCode = 401; return; }
        await using var connection = await context.RequestServices.GetRequiredService<NpgsqlDataSource>().OpenConnectionAsync(context.RequestAborted);
        await using var cmd = new NpgsqlCommand("SELECT a.id,a.store_id FROM mobile_sessions s JOIN mobile_admins a ON a.id=s.admin_id WHERE s.token_hash=@hash AND s.expires>now()", connection);
        cmd.Parameters.AddWithValue("hash", MobileDatabase.Hash(cookie));
        await using var reader = await cmd.ExecuteReaderAsync(context.RequestAborted);
        if (!await reader.ReadAsync(context.RequestAborted)) { context.Response.StatusCode = 401; return; }
        context.Items["admin"] = reader.GetGuid(0); context.Items["store"] = reader.GetGuid(1);
    }
    if (path.StartsWithSegments("/api/device") && path != "/api/device/pair")
    {
        var header = context.Request.Headers.Authorization.ToString();
        if (!header.StartsWith("Bearer ", StringComparison.Ordinal)) { context.Response.StatusCode = 401; return; }
        await using var connection = await context.RequestServices.GetRequiredService<NpgsqlDataSource>().OpenConnectionAsync(context.RequestAborted);
        await using var cmd = new NpgsqlCommand("SELECT store_id FROM mobile_devices WHERE token_hash=@hash", connection);
        cmd.Parameters.AddWithValue("hash", MobileDatabase.Hash(header[7..]));
        if (await cmd.ExecuteScalarAsync(context.RequestAborted) is not Guid store) { context.Response.StatusCode = 401; return; }
        context.Items["store"] = store;
    }
    await next();
});

app.MapGet("/health", () => Results.Ok(new { status = "ok", service = "mobile" }));
app.MapGet("/health/ready", async (NpgsqlDataSource source, CancellationToken ct) =>
{
    try { await using var command = source.CreateCommand("SELECT 1"); await command.ExecuteScalarAsync(ct); return Results.Ok(new { status = "ready" }); }
    catch (NpgsqlException) { return Results.Json(new { status = "unavailable" }, statusCode: 503); }
});
app.MapPost("/api/auth/login", async (LoginRequest request, HttpContext context, NpgsqlDataSource source, CancellationToken ct) =>
{
    if (string.IsNullOrWhiteSpace(request.Username) || request.Password == null || request.Password.Length > 100 || System.Text.Encoding.UTF8.GetByteCount(request.Password) > 72) return Results.Unauthorized();
    await using var connection = await source.OpenConnectionAsync(ct);
    Guid? id = null; string? hash = null;
    await using (var cmd = new NpgsqlCommand("SELECT id,password_hash FROM mobile_admins WHERE username=@username", connection))
    {
        cmd.Parameters.AddWithValue("username", request.Username.Trim().ToLowerInvariant());
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (await reader.ReadAsync(ct)) { id = reader.GetGuid(0); hash = reader.GetString(1); }
    }
    // Unknown accounts still perform bcrypt work, keeping errors and response timing similar.
    var valid = BCrypt.Net.BCrypt.Verify(request.Password, hash ?? DummyPassword.Hash);
    if (!valid || id == null) return Results.Unauthorized();
    var token = MobileDatabase.Token();
    await using var session = new NpgsqlCommand("DELETE FROM mobile_sessions WHERE expires<now(); INSERT INTO mobile_sessions(token_hash,admin_id,expires) VALUES (@hash,@id,now()+interval '8 hours')", connection);
    session.Parameters.AddWithValue("hash", MobileDatabase.Hash(token)); session.Parameters.AddWithValue("id", id.Value);
    await session.ExecuteNonQueryAsync(ct);
    context.Response.Cookies.Append("aurora_mobile_session", token, new CookieOptions { HttpOnly = true,
        Secure = !hosting.AllowLocalHttp || context.Request.IsHttps, SameSite = SameSiteMode.Strict, Path = "/", MaxAge = TimeSpan.FromHours(8) });
    return Results.Ok(new { authenticated = true });
}).RequireRateLimiting("credentials");
app.MapGet("/api/auth/session", () => Results.Ok(new { authenticated = true }));
app.MapPost("/api/auth/logout", async (HttpContext context, NpgsqlDataSource source, CancellationToken ct) =>
{
    await using var connection = await source.OpenConnectionAsync(ct);
    await using var cmd = new NpgsqlCommand("DELETE FROM mobile_sessions WHERE token_hash=@hash", connection);
    cmd.Parameters.AddWithValue("hash", MobileDatabase.Hash(context.Request.Cookies["aurora_mobile_session"] ?? ""));
    await cmd.ExecuteNonQueryAsync(ct); context.Response.Cookies.Delete("aurora_mobile_session"); return Results.NoContent();
});
app.MapPost("/api/admin/pairing", async (HttpContext context, NpgsqlDataSource source, CancellationToken ct) =>
{
    var code = Convert.ToHexString(System.Security.Cryptography.RandomNumberGenerator.GetBytes(8));
    await using var connection = await source.OpenConnectionAsync(ct);
    await using var cmd = new NpgsqlCommand("UPDATE mobile_devices SET pairing_hash=@hash,pairing_expires=now()+interval '10 minutes' WHERE store_id=@store", connection);
    cmd.Parameters.AddWithValue("hash", MobileDatabase.Hash(code)); cmd.Parameters.AddWithValue("store", Store(context));
    await cmd.ExecuteNonQueryAsync(ct); return Results.Ok(new { code, expiresAt = DateTime.UtcNow.AddMinutes(10) });
});
app.MapDelete("/api/admin/device", async (HttpContext context, NpgsqlDataSource source, CancellationToken ct) =>
{
    await using var connection = await source.OpenConnectionAsync(ct);
    await using var cmd = new NpgsqlCommand("UPDATE mobile_devices SET token_hash=NULL,pairing_hash=NULL,pairing_expires=NULL WHERE store_id=@store", connection);
    cmd.Parameters.AddWithValue("store", Store(context)); await cmd.ExecuteNonQueryAsync(ct); return Results.NoContent();
});
app.MapPost("/api/device/pair", async (PairRequest request, NpgsqlDataSource source, CancellationToken ct) =>
{
    if (string.IsNullOrWhiteSpace(request.Code)) return Results.BadRequest();
    var token = MobileDatabase.Token();
    await using var connection = await source.OpenConnectionAsync(ct);
    await using var cmd = new NpgsqlCommand("""
        UPDATE mobile_devices SET token_hash=@token,pairing_hash=NULL,pairing_expires=NULL
        WHERE pairing_hash=@code AND pairing_expires>now() RETURNING store_id
        """, connection);
    cmd.Parameters.AddWithValue("token", MobileDatabase.Hash(token)); cmd.Parameters.AddWithValue("code", MobileDatabase.Hash(request.Code.Trim().ToUpperInvariant()));
    return await cmd.ExecuteScalarAsync(ct) is Guid store ? Results.Ok(new PairResponse(store, token)) : Results.BadRequest(new { message = "Code is invalid or expired." });
}).RequireRateLimiting("credentials");
app.MapGet("/api/device/cursor", async (HttpContext context, NpgsqlDataSource source, CancellationToken ct) =>
{
    await using var connection = await source.OpenConnectionAsync(ct);
    await using var cmd = new NpgsqlCommand("SELECT generation,sequence FROM mobile_stores WHERE id=@store", connection);
    cmd.Parameters.AddWithValue("store", Store(context));
    await using var reader = await cmd.ExecuteReaderAsync(ct); await reader.ReadAsync(ct);
    return Results.Ok(new SyncCursor(reader.IsDBNull(0) ? null : reader.GetGuid(0), reader.GetInt64(1)));
});
app.MapPost("/api/device/sync", async (SyncBatch batch, HttpContext context, MobileDatabase database, CancellationToken ct)
    => Results.Ok(await database.Apply(Store(context), batch, ct)));

app.MapGet("/api/admin/overview", async (HttpContext context, NpgsqlDataSource source, CancellationToken ct) =>
{
    await using var connection = await source.OpenConnectionAsync(ct);
    await using var tx = await connection.BeginTransactionAsync(System.Data.IsolationLevel.RepeatableRead, ct);
    string name; Guid? generation; long sequence; DateTime? seen; bool paired;
    await using (var cmd = new NpgsqlCommand("SELECT COALESCE((SELECT data->>'Name' FROM mobile_records r WHERE r.store_id=s.id AND r.table_name='store_profiles' ORDER BY r.record_id LIMIT 1),s.name),s.generation,s.sequence,s.last_seen,d.token_hash IS NOT NULL FROM mobile_stores s JOIN mobile_devices d ON d.store_id=s.id WHERE s.id=@store", connection, tx))
    {
        cmd.Parameters.AddWithValue("store", Store(context));
        await using var r = await cmd.ExecuteReaderAsync(ct); await r.ReadAsync(ct);
        name = r.GetString(0); generation = r.IsDBNull(1) ? null : r.GetGuid(1); sequence = r.GetInt64(2); seen = r.IsDBNull(3) ? null : r.GetDateTime(3); paired = r.GetBoolean(4);
    }
    Dictionary<string, long> counts = SyncCatalog.Tables.ToDictionary(t => t, _ => 0L);
    await using (var cmd = new NpgsqlCommand("SELECT table_name,count(*) FROM mobile_records WHERE store_id=@store GROUP BY table_name", connection, tx))
    {
        cmd.Parameters.AddWithValue("store", Store(context)); await using var r = await cmd.ExecuteReaderAsync(ct);
        while (await r.ReadAsync(ct)) counts[r.GetString(0)] = r.GetInt64(1);
    }
    await tx.CommitAsync(ct);
    return Results.Ok(new { name, generation, sequence, lastSeen = seen, paired, counts, serverTime = DateTime.UtcNow });
});

app.MapGet("/api/admin/records/{table}", async (string table, string? q, int? offset, bool? debts, HttpContext context, NpgsqlDataSource source, CancellationToken ct) =>
{
    if (!SyncCatalog.Tables.Contains(table)) return Results.NotFound();
    var skip = Math.Max(0, offset ?? 0);
    var query = (q ?? "").Trim(); if (query.Length > 200) return Results.BadRequest();
    await using var connection = await source.OpenConnectionAsync(ct);
    // Parameterized search also handles Arabic. Fetch one extra record for an honest next-page indicator.
    await using var cmd = new NpgsqlCommand("""
        SELECT (r.data || jsonb_build_object('_productName',p.data->>'Name','_supplierName',s.data->>'Name'))::text
        FROM mobile_records r
        LEFT JOIN mobile_records p ON p.store_id=r.store_id AND p.table_name='products' AND p.record_id::text=r.data->>'ProductId'
        LEFT JOIN mobile_records s ON s.store_id=r.store_id AND s.table_name='suppliers' AND s.record_id::text=r.data->>'SupplierId'
        WHERE r.store_id=@store AND r.table_name=@table
        AND (@query='' OR strpos(lower(r.data::text),lower(@query))>0 OR strpos(lower(p.data->>'Name'),lower(@query))>0 OR strpos(lower(s.data->>'Name'),lower(@query))>0)
        AND (NOT @debts OR r.data->>'DebtCardName' IS NOT NULL)
        ORDER BY r.data->>'CreatedAt' DESC NULLS LAST,r.record_id LIMIT 51 OFFSET @offset
        """, connection);
    cmd.Parameters.AddWithValue("store", Store(context)); cmd.Parameters.AddWithValue("table", table);
    cmd.Parameters.AddWithValue("debts", debts ?? false); cmd.Parameters.AddWithValue("query", query); cmd.Parameters.AddWithValue("offset", skip);
    await using var reader = await cmd.ExecuteReaderAsync(ct); List<JsonElement> records = [];
    while (await reader.ReadAsync(ct)) records.Add(JsonSerializer.Deserialize<JsonElement>(reader.GetString(0)));
    return Results.Ok(new { records = records.Take(50), hasMore = records.Count > 50, offset = skip });
});
app.MapGet("/api/admin/records/{table}/{id:guid}", async (string table, Guid id, HttpContext context, NpgsqlDataSource source, CancellationToken ct) =>
{
    if (!SyncCatalog.Tables.Contains(table)) return Results.NotFound();
    await using var connection = await source.OpenConnectionAsync(ct);
    await using var cmd = new NpgsqlCommand("SELECT data::text FROM mobile_records WHERE store_id=@store AND table_name=@table AND record_id=@id", connection);
    cmd.Parameters.AddWithValue("store", Store(context)); cmd.Parameters.AddWithValue("table", table); cmd.Parameters.AddWithValue("id", id);
    if (await cmd.ExecuteScalarAsync(ct) is not string data) return Results.NotFound();
    var relatedKey = table switch { "products" => "ProductId", "transactions" => "TransactionId", "purchase_orders" => "PurchaseOrderId", "offers" => "OfferId", "suppliers" => "SupplierId", "categories" => "CategoryId", _ => null };
    Dictionary<string, List<JsonElement>> related = [];
    if (relatedKey != null)
    {
        await using var child = new NpgsqlCommand("SELECT table_name,data::text FROM mobile_records WHERE store_id=@store AND data->>@key=@id ORDER BY table_name,record_id LIMIT 501", connection);
        child.Parameters.AddWithValue("store", Store(context)); child.Parameters.AddWithValue("key", relatedKey); child.Parameters.AddWithValue("id", id.ToString());
        await using var r = await child.ExecuteReaderAsync(ct);
        while (await r.ReadAsync(ct)) { var key = r.GetString(0); if (!related.ContainsKey(key)) related[key] = []; related[key].Add(JsonSerializer.Deserialize<JsonElement>(r.GetString(1))); }
    }
    return Results.Ok(new { record = JsonSerializer.Deserialize<JsonElement>(data), related,
        relatedTruncated = related.Values.Sum(v => v.Count) > 500 });
});
app.MapGet("/api/admin/report", async (DateOnly? start, DateOnly? end, HttpContext context, NpgsqlDataSource source, IConfiguration config, CancellationToken ct) =>
{
    var zoneName = config["StoreTimezone"] ?? "Asia/Beirut";
    var zone = TimeZoneInfo.FindSystemTimeZoneById(zoneName);
    var today = DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, zone));
    var first = start ?? today; var last = end ?? today;
    if (first > last || last.DayNumber - first.DayNumber > 366) return Results.BadRequest(new { message = "Choose a date range of up to one year." });
    var from = TimeZoneInfo.ConvertTimeToUtc(first.ToDateTime(TimeOnly.MinValue), zone);
    var until = TimeZoneInfo.ConvertTimeToUtc(last.AddDays(1).ToDateTime(TimeOnly.MinValue), zone);
    await using var connection = await source.OpenConnectionAsync(ct);
    await using var cmd = new NpgsqlCommand("""
        WITH receipts AS (
            SELECT record_id,data FROM mobile_records t WHERE store_id=@store AND table_name='transactions'
            AND (data->>'CreatedAt')::timestamptz >= @from AND (data->>'CreatedAt')::timestamptz < @until
            AND NOT EXISTS (SELECT 1 FROM mobile_records p WHERE p.store_id=@store AND p.table_name='personal_purchases'
                AND p.data->>'TransactionId'=t.record_id::text)
        ), lines AS (
            SELECT l.data FROM mobile_records l JOIN receipts t ON l.data->>'TransactionId'=t.record_id::text
            WHERE l.store_id=@store AND l.table_name='transaction_lines'
        ) SELECT jsonb_build_object(
            'netSalesUsd', (SELECT COALESCE(sum((data->>'TotalUsd')::numeric),0) FROM receipts),
            'netSalesLbp', (SELECT COALESCE(sum((data->>'TotalLbp')::numeric),0) FROM receipts),
            'profitUsd', (SELECT COALESCE(sum((data->>'ProfitUsd')::numeric),0) FROM lines),
            'receipts', (SELECT count(*) FROM receipts),
            'returns', (SELECT count(*) FROM receipts WHERE (data->>'Type')::int=2),
            'outstandingUsd', (SELECT COALESCE(sum(GREATEST((data->>'BalanceUsd')::numeric,0)),0) FROM mobile_records
                WHERE store_id=@store AND table_name='transactions' AND data->>'DebtCardName' IS NOT NULL
                AND data->>'DebtSettledAt' IS NULL),
            'lowStock', (SELECT count(*) FROM mobile_records WHERE store_id=@store AND table_name='inventories'
                AND (data->>'QuantityOnHand')::numeric <= (data->>'ReorderPoint')::numeric)
        )::text
        """, connection);
    cmd.Parameters.AddWithValue("store", Store(context)); cmd.Parameters.AddWithValue("from", from); cmd.Parameters.AddWithValue("until", until);
    var metrics = JsonSerializer.Deserialize<JsonElement>((string)(await cmd.ExecuteScalarAsync(ct))!);
    return Results.Ok(new { start = first, end = last, timezone = zoneName, metrics });
});
app.MapMobilePurchases();
app.Run();
static Guid Store(HttpContext context) => (Guid)context.Items["store"]!;
public record LoginRequest(string Username, string Password);
public static class DummyPassword { public static readonly string Hash = BCrypt.Net.BCrypt.HashPassword("not-an-account-password", 12); }

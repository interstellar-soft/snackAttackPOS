using System.Data;
using System.Net.Http.Headers;
using System.Text.Json;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using PosBackend.Infrastructure.Data;
using PosSync;

namespace PosBackend.Application.Services;

public record MobileLink(string Url, Guid StoreId, string DeviceToken, Guid? AdminId = null);

public sealed class MobileSyncService(ApplicationDbContext db, IDataProtectionProvider protection, IHttpClientFactory clients,
    IConfiguration configuration, MobilePurchaseService purchases)
{
    private readonly IDataProtector protector = protection.CreateProtector("Aurora.MobileLink.v1");
    private async Task<NpgsqlConnection> Open(CancellationToken ct)
    {
        var connection = new NpgsqlConnection(db.Database.GetConnectionString());
        await connection.OpenAsync(ct);
        return connection;
    }

    public async Task<object> Status(CancellationToken ct)
    {
        await using var connection = await Open(ct);
        await using var cmd = new NpgsqlCommand("SELECT protected_link,last_success,last_error,revision,pruned_through FROM mobile_sync_state WHERE id=1", connection);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        await reader.ReadAsync(ct);
        var link = reader.IsDBNull(0) ? null : JsonSerializer.Deserialize<MobileLink>(protector.Unprotect(reader.GetString(0)));
        return new { connected = link != null, url = link?.Url, storeId = link?.StoreId,
            lastSuccess = reader.IsDBNull(1) ? (DateTime?)null : reader.GetDateTime(1),
            error = reader.IsDBNull(2) ? null : reader.GetString(2), revision = reader.GetInt64(3), acknowledged = reader.GetInt64(4) };
    }

    public async Task Pair(string url, string code, Guid? adminId, CancellationToken ct)
    {
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri) || !string.IsNullOrEmpty(uri.UserInfo) ||
            !string.IsNullOrEmpty(uri.Query) || !string.IsNullOrEmpty(uri.Fragment) || uri.AbsolutePath != "/" ||
            (uri.Scheme != "https" && !(uri.Scheme == "http" && uri.IsLoopback && configuration.GetValue<bool>("MobileSync:AllowLocalHttp"))))
            throw new ArgumentException("Enter an HTTPS dashboard origin. Local HTTP requires the local-development setting.");
        var root = uri.GetLeftPart(UriPartial.Authority);
        using var client = clients.CreateClient("mobile-sync");
        using var response = await client.PostAsJsonAsync(root + "/api/device/pair", new PairRequest(code.Trim()), ct);
        if (!response.IsSuccessStatusCode) throw new ArgumentException("Pairing failed. Generate a fresh code in the mobile dashboard.");
        var pair = await response.Content.ReadFromJsonAsync<PairResponse>(cancellationToken: ct) ?? throw new InvalidOperationException("Invalid pairing response.");
        var value = protector.Protect(JsonSerializer.Serialize(new MobileLink(root, pair.StoreId, pair.DeviceToken, adminId)));
        await using var connection = await Open(ct);
        await using var cmd = new NpgsqlCommand("UPDATE mobile_sync_state SET protected_link=@link,last_error=NULL,last_success=NULL WHERE id=1", connection);
        cmd.Parameters.AddWithValue("link", value);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    public async Task Disconnect(CancellationToken ct)
    {
        await using var connection = await Open(ct);
        await using var cmd = new NpgsqlCommand("BEGIN; SELECT pg_advisory_xact_lock(194071,1); UPDATE mobile_sync_state SET protected_link=NULL,last_error=NULL,pruned_through=revision WHERE id=1; DELETE FROM mobile_sync_outbox; COMMIT;", connection);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    public async Task RunOnce(CancellationToken ct)
    {
        if (!db.Database.IsNpgsql()) return;
        await using var connection = await Open(ct);
        await using var read = new NpgsqlCommand("SELECT protected_link FROM mobile_sync_state WHERE id=1", connection);
        var encrypted = await read.ExecuteScalarAsync(ct) as string;
        if (encrypted == null) return;
        var link = JsonSerializer.Deserialize<MobileLink>(protector.Unprotect(encrypted))!;
        using var client = clients.CreateClient("mobile-sync");
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", link.DeviceToken);
        using var cursorResponse = await client.GetAsync(link.Url + "/api/device/cursor", ct);
        cursorResponse.EnsureSuccessStatusCode();
        var cursor = (await cursorResponse.Content.ReadFromJsonAsync<SyncCursor>(cancellationToken: ct))!;
        var batch = await BuildBatch(connection, cursor, ct);
        using var response = await client.PostAsJsonAsync(link.Url + "/api/device/sync", batch, ct);
        response.EnsureSuccessStatusCode();
        var receipt = (await response.Content.ReadFromJsonAsync<SyncCursor>(cancellationToken: ct))!;
        if (receipt.Generation != batch.Generation || receipt.Sequence != batch.ToSequence) throw new InvalidOperationException("Invalid sync acknowledgement.");
        // Only prune after the cloud has durably acknowledged this exact generation, while still paired to it.
        await using var tx = await connection.BeginTransactionAsync(ct);
        await using var ack = new NpgsqlCommand("""
            UPDATE mobile_sync_state SET last_success=now(),last_error=NULL,pruned_through=@sequence
            WHERE id=1 AND generation=@generation AND protected_link=@link;
            DELETE FROM mobile_sync_outbox WHERE sequence<=@sequence AND EXISTS
            (SELECT 1 FROM mobile_sync_state WHERE generation=@generation AND protected_link=@link);
            """, connection, tx);
        ack.Parameters.AddWithValue("sequence", batch.ToSequence);
        ack.Parameters.AddWithValue("generation", batch.Generation);
        ack.Parameters.AddWithValue("link", encrypted);
        await ack.ExecuteNonQueryAsync(ct);
        await tx.CommitAsync(ct);
        var commands = await client.GetFromJsonAsync<List<PurchaseCommand>>(link.Url + "/api/device/purchases", ct) ?? [];
        foreach (var command in commands)
        {
            var result = await purchases.Apply(command, link.AdminId, ct);
            using var completed = await client.PostAsJsonAsync(link.Url + $"/api/device/purchases/{command.Id}/result", result, ct);
            completed.EnsureSuccessStatusCode();
        }
    }

    private static async Task<SyncBatch> BuildBatch(NpgsqlConnection connection, SyncCursor cursor, CancellationToken ct)
    {
        await using var tx = await connection.BeginTransactionAsync(IsolationLevel.RepeatableRead, ct);
        Guid generation; long revision; long pruned;
        await using (var state = new NpgsqlCommand("SELECT generation,revision,pruned_through FROM mobile_sync_state WHERE id=1", connection, tx))
        await using (var reader = await state.ExecuteReaderAsync(ct))
        { await reader.ReadAsync(ct); generation = reader.GetGuid(0); revision = reader.GetInt64(1); pruned = reader.GetInt64(2); }
        Dictionary<string, JsonElement[]>? snapshot = null;
        List<SyncChange> changes = [];
        if (cursor.Generation != generation || cursor.Sequence < pruned || cursor.Sequence > revision)
        {
            snapshot = [];
            foreach (var table in SyncCatalog.Tables)
            {
                await using var cmd = new NpgsqlCommand($"SELECT {SyncCatalog.Projection(table, "r")}::text FROM {table} r ORDER BY r.\"Id\"", connection, tx);
                await using var reader = await cmd.ExecuteReaderAsync(ct);
                List<JsonElement> rows = [];
                while (await reader.ReadAsync(ct)) rows.Add(JsonSerializer.Deserialize<JsonElement>(reader.GetString(0)));
                snapshot[table] = rows.ToArray();
            }
        }
        else
        {
            // Take complete committed transactions so a receipt and its stock effects arrive atomically.
            await using var cmd = new NpgsqlCommand("""
                SELECT sequence,table_name,record_id,deleted,row_data::text FROM mobile_sync_outbox
                WHERE sequence>@sequence AND transaction_id IN
                (SELECT transaction_id FROM mobile_sync_outbox WHERE sequence>@sequence
                    GROUP BY transaction_id ORDER BY min(sequence) LIMIT 50) ORDER BY sequence
                """, connection, tx);
            cmd.Parameters.AddWithValue("sequence", cursor.Sequence);
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct)) changes.Add(new(reader.GetInt64(0), reader.GetString(1), reader.GetGuid(2), reader.GetBoolean(3),
                reader.IsDBNull(4) ? null : JsonSerializer.Deserialize<JsonElement>(reader.GetString(4))));
            revision = changes.Count == 0 ? cursor.Sequence : changes[^1].Sequence;
        }
        await tx.CommitAsync(ct);
        return new(SyncCatalog.Version, generation, cursor.Sequence, revision, snapshot, changes);
    }

    public async Task RecordFailure(CancellationToken ct)
    {
        await using var connection = await Open(ct);
        await using var cmd = new NpgsqlCommand("UPDATE mobile_sync_state SET last_error='Dashboard unreachable or pairing expired. Changes remain queued; retrying automatically.' WHERE id=1 AND protected_link IS NOT NULL", connection);
        await cmd.ExecuteNonQueryAsync(ct);
    }
}

public sealed class MobileSyncWorker(IServiceScopeFactory scopes, ILogger<MobileSyncWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            using var scope = scopes.CreateScope();
            var sync = scope.ServiceProvider.GetRequiredService<MobileSyncService>();
            try { await sync.RunOnce(stoppingToken); }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception)
            {
                logger.LogWarning("Mobile sync is delayed; local checkout remains available.");
                try { await sync.RecordFailure(stoppingToken); } catch { /* Retry once the local DB is available. */ }
            }
            await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
        }
    }
}

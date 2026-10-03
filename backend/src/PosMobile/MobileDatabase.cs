using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Npgsql;
using PosSync;

namespace PosMobile;

public sealed class MobileDatabase(NpgsqlDataSource source)
{
    public static string Hash(string value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)));
    public static string Token() => Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
    public async Task Initialize(IConfiguration config)
    {
        await using var connection = await source.OpenConnectionAsync();
        await using var tx = await connection.BeginTransactionAsync();
        await using var schema = new NpgsqlCommand("""
            SELECT pg_advisory_xact_lock(194071, 2);
            CREATE TABLE IF NOT EXISTS mobile_stores (id uuid PRIMARY KEY, name text NOT NULL,
                generation uuid NULL, sequence bigint NOT NULL DEFAULT 0, last_seen timestamptz NULL);
            CREATE TABLE IF NOT EXISTS mobile_admins (id uuid PRIMARY KEY, username text UNIQUE NOT NULL,
                password_hash text NOT NULL, store_id uuid NOT NULL REFERENCES mobile_stores(id));
            CREATE TABLE IF NOT EXISTS mobile_sessions (token_hash text PRIMARY KEY,
                admin_id uuid NOT NULL REFERENCES mobile_admins(id), expires timestamptz NOT NULL);
            CREATE TABLE IF NOT EXISTS mobile_devices (store_id uuid PRIMARY KEY REFERENCES mobile_stores(id),
                token_hash text UNIQUE NULL, pairing_hash text UNIQUE NULL, pairing_expires timestamptz NULL);
            CREATE TABLE IF NOT EXISTS mobile_records (store_id uuid NOT NULL REFERENCES mobile_stores(id),
                table_name text NOT NULL, record_id uuid NOT NULL, data jsonb NOT NULL,
                PRIMARY KEY(store_id,table_name,record_id));
            CREATE INDEX IF NOT EXISTS mobile_records_table ON mobile_records(store_id,table_name);
            CREATE TABLE IF NOT EXISTS mobile_retired_generations (store_id uuid NOT NULL REFERENCES mobile_stores(id),
                generation uuid NOT NULL, PRIMARY KEY(store_id,generation));
            CREATE TABLE IF NOT EXISTS mobile_purchase_drafts (id uuid PRIMARY KEY,store_id uuid NOT NULL REFERENCES mobile_stores(id),
                admin_id uuid NOT NULL REFERENCES mobile_admins(id),version integer NOT NULL DEFAULT 1,
                status text NOT NULL DEFAULT 'draft',purchase jsonb NOT NULL,command jsonb NULL,result jsonb NULL,
                created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
            """, connection, tx);
        await schema.ExecuteNonQueryAsync();
        var username = config["Bootstrap:Username"];
        var password = config["Bootstrap:Password"];
        if (!string.IsNullOrWhiteSpace(username) && !string.IsNullOrWhiteSpace(password))
        {
            if (password.Length < 9 || Encoding.UTF8.GetByteCount(password) > 72) throw new InvalidOperationException("Mobile admin password must be 9 characters minimum, 72 UTF-8 bytes maximum.");
            await using var exists = new NpgsqlCommand("SELECT 1 FROM mobile_admins WHERE username=@username", connection, tx);
            exists.Parameters.AddWithValue("username", username.Trim().ToLowerInvariant());
            if (await exists.ExecuteScalarAsync() == null)
            {
                var storeId = Guid.NewGuid();
                await using var seed = new NpgsqlCommand("""
                    INSERT INTO mobile_stores(id,name) VALUES (@store,@name);
                    INSERT INTO mobile_admins(id,username,password_hash,store_id) VALUES (@id,@username,@hash,@store);
                    INSERT INTO mobile_devices(store_id) VALUES (@store);
                    """, connection, tx);
                seed.Parameters.AddWithValue("store", storeId);
                seed.Parameters.AddWithValue("id", Guid.NewGuid());
                seed.Parameters.AddWithValue("name", config["Bootstrap:StoreName"] ?? "My store");
                seed.Parameters.AddWithValue("username", username.Trim().ToLowerInvariant());
                seed.Parameters.AddWithValue("hash", BCrypt.Net.BCrypt.HashPassword(password, 12));
                await seed.ExecuteNonQueryAsync();
            }
        }
        await using var accountCount = new NpgsqlCommand("SELECT count(*) FROM mobile_admins", connection, tx);
        if ((long)(await accountCount.ExecuteScalarAsync())! == 0)
            throw new InvalidOperationException("The first launch needs Bootstrap:Username and Bootstrap:Password to create the mobile administrator.");
        await tx.CommitAsync();
    }

    public async Task<SyncCursor> Apply(Guid storeId, SyncBatch batch, CancellationToken ct)
    {
        if (batch.Version != SyncCatalog.Version || batch.Generation == Guid.Empty || batch.FromSequence < 0 || batch.ToSequence < 0 || batch.Changes == null)
            throw new ArgumentException("Unsupported or malformed sync batch.");
        if (batch.Snapshot != null)
        {
            if (!batch.Snapshot.Keys.Order().SequenceEqual(SyncCatalog.Tables.Order()) || batch.Changes.Count != 0)
                throw new ArgumentException("A snapshot must contain every business table.");
            foreach (var (table, rows) in batch.Snapshot)
            {
                if (rows == null) throw new ArgumentException("Missing table rows.");
                HashSet<Guid> ids = [];
                foreach (var row in rows)
                {
                    SyncCatalog.ValidateRecord(table, row);
                    if (!ids.Add(row.GetProperty("Id").GetGuid())) throw new ArgumentException("Duplicate snapshot record.");
                }
            }
        }
        else
        {
            var prior = batch.FromSequence;
            foreach (var change in batch.Changes)
            {
                if (!SyncCatalog.Tables.Contains(change.Table) || change.Sequence <= prior || change.Sequence > batch.ToSequence || change.Id == Guid.Empty)
                    throw new ArgumentException("Invalid sync sequence.");
                if (!change.Deleted)
                {
                    if (change.Row == null) throw new ArgumentException("Missing row.");
                    SyncCatalog.ValidateRecord(change.Table, change.Row.Value);
                    if (change.Row.Value.GetProperty("Id").GetGuid() != change.Id) throw new ArgumentException("Record ID mismatch.");
                }
                prior = change.Sequence;
            }
            if (batch.ToSequence != prior) throw new ArgumentException("Invalid end checkpoint.");
        }
        await using var connection = await source.OpenConnectionAsync(ct);
        await using var tx = await connection.BeginTransactionAsync(ct);
        Guid? generation; long sequence;
        await using (var state = new NpgsqlCommand("SELECT generation,sequence FROM mobile_stores WHERE id=@id FOR UPDATE", connection, tx))
        {
            state.Parameters.AddWithValue("id", storeId);
            await using var reader = await state.ExecuteReaderAsync(ct);
            if (!await reader.ReadAsync(ct)) throw new InvalidOperationException("Unknown store.");
            generation = reader.IsDBNull(0) ? null : reader.GetGuid(0); sequence = reader.GetInt64(1);
        }
        if (batch.Snapshot == null && (generation != batch.Generation || sequence != batch.FromSequence))
        {
            // A replay after a lost acknowledgement must be harmless.
            if (generation == batch.Generation && sequence == batch.ToSequence)
                return new(generation, sequence);
            throw new SyncConflictException();
        }
        if (batch.Snapshot != null)
        {
            await using var retired = new NpgsqlCommand("SELECT 1 FROM mobile_retired_generations WHERE store_id=@store AND generation=@generation", connection, tx);
            retired.Parameters.AddWithValue("store", storeId); retired.Parameters.AddWithValue("generation", batch.Generation);
            if (await retired.ExecuteScalarAsync(ct) != null) throw new SyncConflictException();
            if (generation.HasValue && generation != batch.Generation)
            {
                await using var retire = new NpgsqlCommand("INSERT INTO mobile_retired_generations(store_id,generation) VALUES (@store,@old) ON CONFLICT DO NOTHING", connection, tx);
                retire.Parameters.AddWithValue("store", storeId); retire.Parameters.AddWithValue("old", generation.Value);
                await retire.ExecuteNonQueryAsync(ct);
            }
            // An old retry cannot replace newer data within the same generation.
            if (generation == batch.Generation && batch.ToSequence < sequence) throw new SyncConflictException();
            await using var clear = new NpgsqlCommand("DELETE FROM mobile_records WHERE store_id=@store", connection, tx);
            clear.Parameters.AddWithValue("store", storeId); await clear.ExecuteNonQueryAsync(ct);
            foreach (var (table, rows) in batch.Snapshot)
                foreach (var row in rows) await Upsert(connection, tx, storeId, table, row.GetProperty("Id").GetGuid(), row, ct);
        }
        else foreach (var change in batch.Changes)
        {
            if (!change.Deleted) await Upsert(connection, tx, storeId, change.Table, change.Id, change.Row!.Value, ct);
            else
            {
                await using var delete = new NpgsqlCommand("DELETE FROM mobile_records WHERE store_id=@store AND table_name=@table AND record_id=@id", connection, tx);
                delete.Parameters.AddWithValue("store", storeId); delete.Parameters.AddWithValue("table", change.Table); delete.Parameters.AddWithValue("id", change.Id);
                await delete.ExecuteNonQueryAsync(ct);
            }
        }
        await using var ack = new NpgsqlCommand("UPDATE mobile_stores SET generation=@generation,sequence=@sequence,last_seen=now() WHERE id=@store", connection, tx);
        ack.Parameters.AddWithValue("generation", batch.Generation); ack.Parameters.AddWithValue("sequence", batch.ToSequence); ack.Parameters.AddWithValue("store", storeId);
        await ack.ExecuteNonQueryAsync(ct);
        await tx.CommitAsync(ct);
        return new(batch.Generation, batch.ToSequence);
    }

    private static async Task Upsert(NpgsqlConnection connection, NpgsqlTransaction tx, Guid store, string table, Guid id, JsonElement row, CancellationToken ct)
    {
        await using var cmd = new NpgsqlCommand("""
            INSERT INTO mobile_records(store_id,table_name,record_id,data) VALUES (@store,@table,@id,@data::jsonb)
            ON CONFLICT(store_id,table_name,record_id) DO UPDATE SET data=EXCLUDED.data
            """, connection, tx);
        cmd.Parameters.AddWithValue("store", store); cmd.Parameters.AddWithValue("table", table);
        cmd.Parameters.AddWithValue("id", id); cmd.Parameters.AddWithValue("data", row.GetRawText());
        await cmd.ExecuteNonQueryAsync(ct);
    }
}
public sealed class SyncConflictException : Exception;

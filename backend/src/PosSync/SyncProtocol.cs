using System.Text.Json;

namespace PosSync;

public static class SyncCatalog
{
    public const int Version = 1;
    public static readonly string[] Tables = ["categories", "products", "product_barcodes", "inventories",
        "expiration_batches", "transactions", "transaction_lines", "price_rules", "offers", "offer_items",
        "suppliers", "purchase_orders", "purchase_order_lines", "users", "audit_logs", "currency_rates",
        "store_profiles", "personal_purchases"];

    // Explicit user allowlist: a future credential column must never be uploaded accidentally.
    public static string Projection(string table, string alias) => table == "users"
        ? $"jsonb_build_object('Id', {alias}.\"Id\", 'Username', {alias}.\"Username\", 'DisplayName', {alias}.\"DisplayName\", 'Role', {alias}.\"Role\", 'CreatedAt', {alias}.\"CreatedAt\", 'UpdatedAt', {alias}.\"UpdatedAt\")"
        : table == "audit_logs" ? $"to_jsonb({alias}) - 'Data' - 'IpAddress'" : $"to_jsonb({alias})";

    public static void ValidateRecord(string table, JsonElement row)
    {
        if (!Tables.Contains(table) || row.ValueKind != JsonValueKind.Object ||
            !row.TryGetProperty("Id", out var id) || !id.TryGetGuid(out _))
            throw new InvalidOperationException("Unknown table or invalid record.");
        if (table == "users" && row.EnumerateObject().Any(p => !new[] { "Id", "Username", "DisplayName", "Role", "CreatedAt", "UpdatedAt" }.Contains(p.Name)))
            throw new InvalidOperationException("User credentials are not part of the sync protocol.");
        if (table == "audit_logs" && (row.TryGetProperty("Data", out _) || row.TryGetProperty("IpAddress", out _)))
            throw new InvalidOperationException("Raw audit payloads are not part of the sync protocol.");
    }
}

public record SyncChange(long Sequence, string Table, Guid Id, bool Deleted, JsonElement? Row);
public record SyncBatch(int Version, Guid Generation, long FromSequence, long ToSequence,
    Dictionary<string, JsonElement[]>? Snapshot, List<SyncChange> Changes);
public record SyncCursor(Guid? Generation, long Sequence);
public record PairRequest(string Code);
public record PairResponse(Guid StoreId, string DeviceToken);
public record PurchaseCommand(Guid Id, Guid Generation, JsonElement Purchase, Dictionary<Guid, JsonElement> ExpectedProducts);
public record PurchaseCommandResult(string Status, Guid? PurchaseId, string? Error);

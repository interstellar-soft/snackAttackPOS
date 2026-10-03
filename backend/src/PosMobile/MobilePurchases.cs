using System.Text.Json;
using Npgsql;
using PosSync;

namespace PosMobile;

public static class MobilePurchases
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    private static Guid Store(HttpContext context) => (Guid)context.Items["store"]!;
    public static void MapMobilePurchases(this WebApplication app)
    {
        app.MapGet("/api/admin/purchases", async (HttpContext context,NpgsqlDataSource source,CancellationToken ct) =>
        {
            await using var connection = await source.OpenConnectionAsync(ct);
            await using var cmd = new NpgsqlCommand("SELECT jsonb_build_object('id',id,'version',version,'status',status,'purchase',purchase,'result',result,'createdAt',created_at)::text FROM mobile_purchase_drafts WHERE store_id=@store ORDER BY created_at DESC LIMIT 100", connection);
            cmd.Parameters.AddWithValue("store", Store(context));
            await using var reader = await cmd.ExecuteReaderAsync(ct); List<JsonElement> rows = [];
            while(await reader.ReadAsync(ct)) rows.Add(JsonSerializer.Deserialize<JsonElement>(reader.GetString(0)));
            return Results.Ok(rows);
        });
        app.MapPut("/api/admin/purchases/{id:guid}", async (Guid id,SaveDraft request,HttpContext context,NpgsqlDataSource source,CancellationToken ct) =>
        {
            if (request.Purchase.ValueKind != JsonValueKind.Object || request.Purchase.GetRawText().Length > 200_000 || id == Guid.Empty) return Results.BadRequest();
            await using var connection = await source.OpenConnectionAsync(ct);
            await using var cmd = new NpgsqlCommand("""
                INSERT INTO mobile_purchase_drafts(id,store_id,admin_id,purchase)
                SELECT @id,@store,@admin,@purchase::jsonb WHERE @version=0
                ON CONFLICT(id) DO UPDATE SET purchase=EXCLUDED.purchase,version=mobile_purchase_drafts.version+1,updated_at=now()
                WHERE mobile_purchase_drafts.store_id=@store AND mobile_purchase_drafts.status='draft' AND mobile_purchase_drafts.version=@version
                RETURNING version
                """,connection);
            // Existing drafts need an UPDATE; initial inserts deliberately require version zero.
            if(request.Version>0)cmd.CommandText="UPDATE mobile_purchase_drafts SET purchase=@purchase::jsonb,version=version+1,updated_at=now() WHERE id=@id AND store_id=@store AND status='draft' AND version=@version RETURNING version";
            cmd.Parameters.AddWithValue("id",id);cmd.Parameters.AddWithValue("store",Store(context));cmd.Parameters.AddWithValue("admin",(Guid)context.Items["admin"]!);
            cmd.Parameters.AddWithValue("purchase",request.Purchase.GetRawText());cmd.Parameters.AddWithValue("version",request.Version);
            return await cmd.ExecuteScalarAsync(ct) is int version ? Results.Ok(new {id,version,status="draft"}) : Results.Conflict(new {message="This draft changed or was already submitted. Reload before editing."});
        });
        app.MapPost("/api/admin/purchases/{id:guid}/submit", async (Guid id,SubmitDraft request,HttpContext context,NpgsqlDataSource source,CancellationToken ct) =>
        {
            if(!request.Confirmed) return Results.BadRequest(new {message="Review and confirm the purchase first."});
            await using var connection=await source.OpenConnectionAsync(ct);await using var tx=await connection.BeginTransactionAsync(ct);
            Guid generation;
            await using(var store=new NpgsqlCommand("SELECT generation FROM mobile_stores WHERE id=@store FOR UPDATE",connection,tx))
            {store.Parameters.AddWithValue("store",Store(context));if(await store.ExecuteScalarAsync(ct) is not Guid value)return Results.Conflict(new {message="Wait for the first PC synchronization."});generation=value;}
            string payload,status;int version;
            await using(var cmd=new NpgsqlCommand("SELECT purchase::text,status,version FROM mobile_purchase_drafts WHERE id=@id AND store_id=@store FOR UPDATE",connection,tx))
            {cmd.Parameters.AddWithValue("id",id);cmd.Parameters.AddWithValue("store",Store(context));await using var reader=await cmd.ExecuteReaderAsync(ct);if(!await reader.ReadAsync(ct))return Results.NotFound();payload=reader.GetString(0);status=reader.GetString(1);version=reader.GetInt32(2);}
            if(status!="draft") return Results.Ok(new {id,status}); // A repeated tap is not a second purchase.
            if(version!=request.Version) return Results.Conflict(new {message="The draft changed. Review it again."});
            var purchase=JsonSerializer.Deserialize<PurchaseInput>(payload,Json);
            if(purchase?.Items is not {Count: >0 and <=100} || purchase.ExchangeRate<=0 || purchase.ExchangeRate>1_000_000_000 || purchase.SupplierName?.Length>180 || purchase.Reference?.Length>120)
                return Results.BadRequest(new {message="Provide items, a valid exchange rate and supplier details."});
            Dictionary<Guid,JsonElement> expected=[];
            foreach(var item in purchase.Items)
            {
                if(item==null || item.Quantity<=0 || item.Quantity>1_000_000 || item.Quantity!=decimal.Round(item.Quantity,3) || item.UnitCost<0 || item.UnitCost>1_000_000_000 || item.Currency is not ("USD" or "LBP") || item.Barcode?.Length>128 || item.Name?.Length>180 || item.CategoryName?.Length>120 || item.SalePriceUsd<0)
                    return Results.BadRequest(new {message="Check quantities, costs, currencies and names on all items."});
                if(item.ProductId.HasValue)
                {
                    await using var product=new NpgsqlCommand("SELECT data::text FROM mobile_records WHERE store_id=@store AND table_name='products' AND record_id=@id",connection,tx);
                    product.Parameters.AddWithValue("store",Store(context));product.Parameters.AddWithValue("id",item.ProductId.Value);
                    if(await product.ExecuteScalarAsync(ct) is not string data)return Results.Conflict(new {message="A selected product is missing. Refresh the catalog."});
                    expected[item.ProductId.Value]=JsonSerializer.Deserialize<JsonElement>(data);
                }
                else if(string.IsNullOrWhiteSpace(item.Barcode)||string.IsNullOrWhiteSpace(item.Name)||string.IsNullOrWhiteSpace(item.CategoryName)||item.SalePriceUsd is not >0)
                    return Results.BadRequest(new {message="New products need a barcode, name, category and selling price."});
            }
            if(!string.IsNullOrWhiteSpace(purchase.Reference))
            {
                await using var duplicate=new NpgsqlCommand("SELECT 1 FROM mobile_purchase_drafts WHERE store_id=@store AND id<>@id AND status IN ('pending','applied') AND lower(purchase->>'reference')=lower(@reference) AND lower(purchase->>'supplierName')=lower(@supplier) LIMIT 1",connection,tx);
                duplicate.Parameters.AddWithValue("store",Store(context));duplicate.Parameters.AddWithValue("id",id);duplicate.Parameters.AddWithValue("reference",purchase.Reference.Trim());duplicate.Parameters.AddWithValue("supplier",purchase.SupplierName?.Trim()??"");
                if(await duplicate.ExecuteScalarAsync(ct)!=null)return Results.Conflict(new {message="This supplier and invoice reference was already submitted."});
            }
            var command=new PurchaseCommand(id,generation,JsonSerializer.Deserialize<JsonElement>(payload),expected);
            await using var submit=new NpgsqlCommand("UPDATE mobile_purchase_drafts SET command=@command::jsonb,status='pending',updated_at=now() WHERE id=@id AND store_id=@store",connection,tx);
            submit.Parameters.AddWithValue("command",JsonSerializer.Serialize(command,Json));submit.Parameters.AddWithValue("id",id);submit.Parameters.AddWithValue("store",Store(context));
            await submit.ExecuteNonQueryAsync(ct);await tx.CommitAsync(ct);return Results.Ok(new {id,status="pending"});
        });
        app.MapGet("/api/device/purchases",async(HttpContext context,NpgsqlDataSource source,CancellationToken ct)=>
        {
            await using var connection=await source.OpenConnectionAsync(ct);
            await using var cmd=new NpgsqlCommand("SELECT command::text FROM mobile_purchase_drafts WHERE store_id=@store AND status='pending' ORDER BY created_at LIMIT 5",connection);
            cmd.Parameters.AddWithValue("store",Store(context));await using var reader=await cmd.ExecuteReaderAsync(ct);List<JsonElement> commands=[];
            while(await reader.ReadAsync(ct))commands.Add(JsonSerializer.Deserialize<JsonElement>(reader.GetString(0)));return Results.Ok(commands);
        });
        app.MapPost("/api/device/purchases/{id:guid}/result",async(Guid id,PurchaseCommandResult result,HttpContext context,NpgsqlDataSource source,CancellationToken ct)=>
        {
            if(result.Status is not ("applied" or "rejected") || (result.Status=="applied" && result.PurchaseId==null) || result.Error?.Length>1000)return Results.BadRequest();
            await using var connection=await source.OpenConnectionAsync(ct);
            await using var cmd=new NpgsqlCommand("UPDATE mobile_purchase_drafts SET status=@status,result=@result::jsonb,updated_at=now() WHERE id=@id AND store_id=@store AND status='pending' RETURNING id",connection);
            cmd.Parameters.AddWithValue("status",result.Status);cmd.Parameters.AddWithValue("result",JsonSerializer.Serialize(result,Json));cmd.Parameters.AddWithValue("id",id);cmd.Parameters.AddWithValue("store",Store(context));
            await cmd.ExecuteNonQueryAsync(ct);return Results.NoContent();
        });
    }
}
public record SaveDraft(JsonElement Purchase,int Version);
public record SubmitDraft(int Version,bool Confirmed);
public sealed class PurchaseInput
{
    public string? SupplierName{get;set;} public string? Reference{get;set;} public DateTimeOffset? PurchasedAt{get;set;}
    public decimal ExchangeRate{get;set;} public List<PurchaseItem>? Items{get;set;}
}
public sealed class PurchaseItem
{
    public Guid? ProductId{get;set;} public string? Barcode{get;set;} public string? Name{get;set;} public string? CategoryName{get;set;}
    public decimal Quantity{get;set;} public decimal UnitCost{get;set;} public string Currency{get;set;}="USD";public decimal? SalePriceUsd{get;set;}
}

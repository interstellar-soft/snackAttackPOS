using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Npgsql;
using PosBackend.Application.Requests;
using PosBackend.Application.Responses;
using PosBackend.Domain.Entities;
using PosBackend.Features.Purchases;
using PosBackend.Infrastructure.Data;
using PosSync;

namespace PosBackend.Application.Services;

public sealed class MobilePurchaseService(ApplicationDbContext db, CurrencyService currency, AuditLogger audit)
{
    public async Task<PurchaseCommandResult> Apply(PurchaseCommand command, Guid? adminId, CancellationToken ct)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        await db.Database.ExecuteSqlRawAsync("SELECT pg_advisory_xact_lock(194071,1)", ct);
        var connection = (NpgsqlConnection)db.Database.GetDbConnection();
        var tx = (NpgsqlTransaction)transaction.GetDbTransaction();
        async Task<PurchaseCommandResult> Reject(string message)
        {
            await transaction.RollbackAsync(ct); db.ChangeTracker.Clear();
            var failure = new PurchaseCommandResult("rejected", null, message);
            await db.Database.ExecuteSqlInterpolatedAsync($"INSERT INTO mobile_applied_commands(id,result) VALUES ({command.Id},{JsonSerializer.Serialize(failure)}) ON CONFLICT DO NOTHING", ct);
            return failure;
        }
        await using var generation = new NpgsqlCommand("SELECT generation FROM mobile_sync_state WHERE id=1", connection, tx);
        if ((Guid)(await generation.ExecuteScalarAsync(ct))! != command.Generation)
            return await Reject("The PC was restored after this draft was submitted. Review a new draft against the latest store data.");
        await using var prior = new NpgsqlCommand("SELECT result FROM mobile_applied_commands WHERE id=@id", connection, tx);
        prior.Parameters.AddWithValue("id", command.Id);
        if (await prior.ExecuteScalarAsync(ct) is string saved) return JsonSerializer.Deserialize<PurchaseCommandResult>(saved)!;
        if (!adminId.HasValue || !await db.Users.AnyAsync(u => u.Id == adminId && u.Role == UserRole.Admin, ct))
            return await Reject("The linked desktop administrator is no longer available. Pair the PC again.");
        var request = command.Purchase.Deserialize<CreatePurchaseRequest>(new JsonSerializerOptions(JsonSerializerDefaults.Web));
        var errors = new List<ValidationResult>();
        if (request == null || !Validator.TryValidateObject(request, new ValidationContext(request), errors, true) || request.Items == null || request.Items.Count is < 1 or > 100 || request.ExchangeRate <= 0)
            return await Reject("Invalid purchase details or exchange rate.");
        foreach (var item in request.Items)
        {
            if (item == null || !Validator.TryValidateObject(item, new ValidationContext(item), errors, true) || item.Quantity != decimal.Round(item.Quantity,3) || item.Currency is not ("USD" or "LBP"))
                return await Reject("Check quantities, currency and costs on every item.");
            if (item.ProductId.HasValue)
            {
                if (!command.ExpectedProducts.TryGetValue(item.ProductId.Value, out var expected)) return await Reject("Missing product version.");
                await using var check = new NpgsqlCommand("SELECT to_jsonb(p)=@expected::jsonb FROM products p WHERE p.\"Id\"=@id", connection, tx);
                check.Parameters.AddWithValue("id", item.ProductId.Value); check.Parameters.AddWithValue("expected", expected.GetRawText());
                if (await check.ExecuteScalarAsync(ct) is not true) return await Reject("A product changed or was removed on the PC. Review a new draft.");
                var product = await db.Products.SingleAsync(p => p.Id == item.ProductId, ct);
                if (!product.IsActive || (!product.IsSoldByWeight && item.Quantity != decimal.Truncate(item.Quantity)))
                    return await Reject("A product is inactive or a whole-unit item has a fractional quantity.");
            }
            else if (string.IsNullOrWhiteSpace(item.Name) || string.IsNullOrWhiteSpace(item.CategoryName) || string.IsNullOrWhiteSpace(item.Barcode) || item.SalePriceUsd is not > 0 || item.Quantity != decimal.Truncate(item.Quantity))
                return await Reject("New products need a name, category, barcode, selling price and whole-unit quantity.");
            else if (await db.Products.AnyAsync(p => p.Barcode == item.Barcode, ct) || await db.ProductBarcodes.AnyAsync(b => b.Code == item.Barcode, ct))
                return await Reject("This barcode already belongs to a product. Match the existing product before submitting.");
        }
        if (!string.IsNullOrWhiteSpace(request.Reference) && await db.PurchaseOrders.AnyAsync(p => p.Reference == request.Reference && p.Supplier != null && p.Supplier.Name == request.SupplierName, ct))
            return await Reject("A purchase with this supplier and invoice reference already exists.");
        var context = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity([
            new Claim(ClaimTypes.NameIdentifier, adminId.Value.ToString()), new Claim(ClaimTypes.Role, "Admin")], "mobile-command")) };
        var controller = new PurchasesController(db, currency, audit) { ControllerContext = new ControllerContext { HttpContext = context } };
        var result = await controller.Create(request, ct);
        var response = result.Value ?? (result.Result as ObjectResult)?.Value as PurchaseResponse;
        if (response == null) return await Reject("The PC could not validate this purchase. Check product details and retry with a new draft.");
        var success = new PurchaseCommandResult("applied", response.Id, null);
        await db.Database.ExecuteSqlInterpolatedAsync($"INSERT INTO mobile_applied_commands(id,result) VALUES ({command.Id},{JsonSerializer.Serialize(success)})", ct);
        await audit.LogAsync(adminId.Value,"MobilePurchase",nameof(PurchaseOrder),response.Id,new { command.Id },ct);
        await transaction.CommitAsync(ct);
        return success;
    }
}

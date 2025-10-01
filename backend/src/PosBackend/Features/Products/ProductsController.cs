using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PosBackend.Application.Requests;
using PosBackend.Application.Responses;
using PosBackend.Application.Services;
using PosBackend.Infrastructure.Data;

namespace PosBackend.Features.Products;

[ApiController]
[Route("api/products")]
[Authorize]
public class ProductsController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly MlClient _mlClient;
    private readonly ScanWatchdog _watchdog;

    public ProductsController(ApplicationDbContext db, MlClient mlClient, ScanWatchdog watchdog)
    {
        _db = db;
        _mlClient = mlClient;
        _watchdog = watchdog;
    }

    [HttpGet("search")]
    public async Task<ActionResult<IEnumerable<ProductResponse>>> Search([FromQuery] string? q, CancellationToken cancellationToken)
    {
        var query = _db.Products.Include(p => p.Category).AsQueryable();
        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = q.ToLower();
            query = query.Where(p => p.Name.ToLower().Contains(term) || p.Sku.ToLower().Contains(term) || p.Barcode.Contains(term));
        }

        var results = await query.OrderBy(p => p.Name).Take(50).Select(p => new ProductResponse
        {
            Id = p.Id,
            Sku = p.Sku,
            Name = p.Name,
            Barcode = p.Barcode,
            PriceUsd = p.PriceUsd,
            PriceLbp = p.PriceLbp,
            Category = p.Category != null ? p.Category.Name : string.Empty
        }).ToListAsync(cancellationToken);

        return Ok(results);
    }

    [HttpPost("scan")]
    public async Task<ActionResult<ProductResponse>> Scan([FromBody] ScanRequest request, CancellationToken cancellationToken)
    {
        var product = await _db.Products.Include(p => p.Category)
            .FirstOrDefaultAsync(p => p.Barcode == request.Barcode, cancellationToken);
        if (product is null)
        {
            return NotFound();
        }

        var userId = User.FindFirst("sub")?.Value ?? "anonymous";
        var rapid = _watchdog.IsRapidRepeat(userId, product.Sku);
        var anomaly = await _mlClient.PredictAnomalyAsync(new MlClient.AnomalyRequest(product.Sku, product.PriceUsd, 1), cancellationToken);

        var flagged = rapid || (anomaly?.IsAnomaly ?? false);
        var reason = rapid ? "rapid_repeat_scan" : anomaly?.Reason;

        return new ProductResponse
        {
            Id = product.Id,
            Sku = product.Sku,
            Name = product.Name,
            Barcode = product.Barcode,
            PriceUsd = product.PriceUsd,
            PriceLbp = product.PriceLbp,
            Category = product.Category?.Name ?? string.Empty,
            IsFlagged = flagged,
            FlagReason = reason
        };
    }
}

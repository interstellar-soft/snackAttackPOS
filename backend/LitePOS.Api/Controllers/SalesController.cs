using System.Linq;
using LitePOS.Api.Data;
using LitePOS.Api.Models.Sales;
using LitePOS.Api.Responses;
using LitePOS.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LitePOS.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class SalesController : ControllerBase
{
    private readonly LitePosDbContext _dbContext;
    private readonly SaleService _saleService;

    public SalesController(LitePosDbContext dbContext, SaleService saleService)
    {
        _dbContext = dbContext;
        _saleService = saleService;
    }

    [HttpGet]
    public async Task<ActionResult<PagedResponse<object>>> GetSales([FromQuery] int page = 1, [FromQuery] int pageSize = 20, [FromQuery] DateTime? date = null)
    {
        var query = _dbContext.Sales.Include(s => s.Customer).OrderByDescending(s => s.CreatedAt).AsNoTracking();
        if (date.HasValue)
        {
            var start = date.Value.Date;
            var end = start.AddDays(1);
            query = query.Where(s => s.CreatedAt >= start && s.CreatedAt < end);
        }

        var total = await query.CountAsync();
        var sales = await query.Skip((page - 1) * pageSize).Take(pageSize)
            .Select(s => new
            {
                s.Id,
                s.SaleNumber,
                s.CreatedAt,
                s.Subtotal,
                s.DiscountTotal,
                s.TaxTotal,
                s.Total,
                Customer = s.Customer != null ? new { s.Customer.Id, s.Customer.Name } : null
            }).ToListAsync();

        return new PagedResponse<object>
        {
            Items = sales.Cast<object>().ToList(),
            Page = page,
            PageSize = pageSize,
            TotalItems = total
        };
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetSale(Guid id)
    {
        var sale = await _dbContext.Sales
            .Include(s => s.Items)
            .Include(s => s.Customer)
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.Id == id);
        if (sale == null)
        {
            return NotFound();
        }

        var settings = await _dbContext.StoreSettings.AsNoTracking().FirstAsync();
        return Ok(new
        {
            sale.Id,
            sale.SaleNumber,
            sale.CreatedAt,
            sale.Subtotal,
            sale.DiscountTotal,
            sale.TaxTotal,
            sale.Total,
            sale.CashPayment,
            sale.CardPayment,
            sale.ChangeDue,
            sale.Notes,
            Customer = sale.Customer != null ? new { sale.Customer.Id, sale.Customer.Name, sale.Customer.Email } : null,
            Items = sale.Items.Select(i => new
            {
                i.ProductName,
                i.Quantity,
                i.UnitPrice,
                i.DiscountPercent,
                i.TaxAmount,
                i.LineTotal,
                i.Note,
                i.VariantName,
                i.ModifierName
            }),
            Settings = new
            {
                settings.StoreName,
                settings.Currency,
                settings.ReceiptHeader,
                settings.ReceiptFooter
            }
        });
    }

    [HttpPost]
    [Authorize(Roles = "Admin,Manager,Cashier")]
    public async Task<IActionResult> CreateSale([FromBody] CreateSaleRequest request)
    {
        var userIdClaim = User.FindFirst("sub")?.Value;
        if (userIdClaim == null)
        {
            return Unauthorized();
        }

        var sale = await _saleService.CreateSaleAsync(request, Guid.Parse(userIdClaim));
        if (sale == null)
        {
            return BadRequest("Unable to create sale");
        }

        await _dbContext.Entry(sale).Collection(s => s.Items).LoadAsync();
        await _dbContext.Entry(sale).Reference(s => s.Customer).LoadAsync();
        return CreatedAtAction(nameof(GetSale), new { id = sale.Id }, new { sale.Id, sale.SaleNumber });
    }
}

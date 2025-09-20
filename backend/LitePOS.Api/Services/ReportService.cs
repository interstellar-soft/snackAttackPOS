using LitePOS.Api.Data;
using LitePOS.Api.Models.Reports;
using Microsoft.EntityFrameworkCore;

namespace LitePOS.Api.Services;

public class ReportService
{
    private readonly LitePosDbContext _dbContext;

    public ReportService(LitePosDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<DailySalesSummaryResponse> GetDailySummaryAsync(DateTime date)
    {
        var start = date.Date;
        var end = start.AddDays(1);

        var sales = await _dbContext.Sales
            .Include(s => s.Items)
            .Where(s => s.CreatedAt >= start && s.CreatedAt < end)
            .ToListAsync();

        var summary = new DailySalesSummaryResponse
        {
            Date = start,
            GrossSales = sales.Sum(s => s.Subtotal),
            DiscountTotal = sales.Sum(s => s.DiscountTotal),
            TaxTotal = sales.Sum(s => s.TaxTotal),
            NetSales = sales.Sum(s => s.Total)
        };

        summary.TopProducts = sales.SelectMany(s => s.Items)
            .GroupBy(i => new { i.ProductId, i.ProductName })
            .Select(g => new TopProductResponse
            {
                ProductId = g.Key.ProductId,
                Name = g.Key.ProductName,
                QuantitySold = g.Sum(x => x.Quantity),
                TotalSales = g.Sum(x => x.LineTotal)
            })
            .OrderByDescending(g => g.TotalSales)
            .Take(5)
            .ToList();

        return summary;
    }

    public async Task<IEnumerable<TopProductResponse>> GetTopProductsAsync(int days)
    {
        var start = DateTime.UtcNow.Date.AddDays(-Math.Abs(days));

        var items = await _dbContext.SaleItems
            .Include(i => i.Sale)
            .Where(i => i.Sale != null && i.Sale.CreatedAt >= start)
            .ToListAsync();

        return items.GroupBy(i => new { i.ProductId, i.ProductName })
            .Select(g => new TopProductResponse
            {
                ProductId = g.Key.ProductId,
                Name = g.Key.ProductName,
                QuantitySold = g.Sum(x => x.Quantity),
                TotalSales = g.Sum(x => x.LineTotal)
            })
            .OrderByDescending(g => g.TotalSales)
            .Take(10)
            .ToList();
    }
}

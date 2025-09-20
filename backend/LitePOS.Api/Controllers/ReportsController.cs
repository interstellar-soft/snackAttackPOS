using LitePOS.Api.Models.Reports;
using LitePOS.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LitePOS.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Admin,Manager")]
public class ReportsController : ControllerBase
{
    private readonly ReportService _reportService;

    public ReportsController(ReportService reportService)
    {
        _reportService = reportService;
    }

    [HttpGet("daily-summary")]
    public async Task<ActionResult<DailySalesSummaryResponse>> GetDailySummary([FromQuery] DateTime? date = null)
    {
        var summary = await _reportService.GetDailySummaryAsync(date ?? DateTime.UtcNow);
        return summary;
    }

    [HttpGet("top-products")]
    public async Task<ActionResult<IEnumerable<TopProductResponse>>> GetTopProducts([FromQuery] int days = 30)
    {
        var result = await _reportService.GetTopProductsAsync(days);
        return Ok(result);
    }
}

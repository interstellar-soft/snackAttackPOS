using System;
using System.Linq;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PosBackend.Application.Responses;
using PosBackend.Features.Common;
using PosBackend.Infrastructure.Data;

namespace PosBackend.Features.Admin;

[ApiController]
[Route("api/my-cart")]
[Authorize(Roles = "Admin")]
public class MyCartController : ControllerBase
{
    private readonly ApplicationDbContext _db;

    public MyCartController(ApplicationDbContext db)
    {
        _db = db;
    }

    [HttpGet("summary")]
    public async Task<ActionResult<MyCartSummaryResponse>> Summary([FromQuery] DateTime? date, CancellationToken cancellationToken)
    {
        var userId = User.GetCurrentUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        var referenceDate = (date ?? DateTime.UtcNow).Date;
        var startOfDay = referenceDate;
        var endOfDay = startOfDay.AddDays(1);
        var startOfMonth = new DateTime(referenceDate.Year, referenceDate.Month, 1);
        var endOfMonth = startOfMonth.AddMonths(1);
        var startOfYear = new DateTime(referenceDate.Year, 1, 1);
        var endOfYear = startOfYear.AddYears(1);

        var baseQuery = _db.PersonalPurchases.AsNoTracking().Where(p => p.UserId == userId.Value);

        var dailyQuery = baseQuery.Where(p => p.PurchaseDate >= startOfDay && p.PurchaseDate < endOfDay);
        var monthlyQuery = baseQuery.Where(p => p.PurchaseDate >= startOfMonth && p.PurchaseDate < endOfMonth);
        var yearlyQuery = baseQuery.Where(p => p.PurchaseDate >= startOfYear && p.PurchaseDate < endOfYear);

        var dailyTotalUsd = await dailyQuery.SumAsync(p => (decimal?)p.TotalUsd, cancellationToken) ?? 0m;
        var dailyTotalLbp = await dailyQuery.SumAsync(p => (decimal?)p.TotalLbp, cancellationToken) ?? 0m;

        var monthlyTotalUsd = await monthlyQuery.SumAsync(p => (decimal?)p.TotalUsd, cancellationToken) ?? 0m;
        var monthlyTotalLbp = await monthlyQuery.SumAsync(p => (decimal?)p.TotalLbp, cancellationToken) ?? 0m;

        var yearlyTotalUsd = await yearlyQuery.SumAsync(p => (decimal?)p.TotalUsd, cancellationToken) ?? 0m;
        var yearlyTotalLbp = await yearlyQuery.SumAsync(p => (decimal?)p.TotalLbp, cancellationToken) ?? 0m;

        var response = new MyCartSummaryResponse
        {
            ReferenceDate = referenceDate,
            DailyTotalUsd = dailyTotalUsd,
            DailyTotalLbp = dailyTotalLbp,
            MonthlyTotalUsd = monthlyTotalUsd,
            MonthlyTotalLbp = monthlyTotalLbp,
            YearlyTotalUsd = yearlyTotalUsd,
            YearlyTotalLbp = yearlyTotalLbp
        };

        return Ok(response);
    }

    [HttpGet("purchases")]
    public async Task<ActionResult<IEnumerable<PersonalPurchaseResponse>>> Purchases([FromQuery] DateTime? from, [FromQuery] DateTime? to, CancellationToken cancellationToken)
    {
        var userId = User.GetCurrentUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        var query = _db.PersonalPurchases
            .AsNoTracking()
            .Include(p => p.Transaction)
            .Where(p => p.UserId == userId.Value);

        if (from.HasValue)
        {
            var start = from.Value.Date;
            query = query.Where(p => p.PurchaseDate >= start);
        }

        if (to.HasValue)
        {
            var end = to.Value.Date.AddDays(1);
            query = query.Where(p => p.PurchaseDate < end);
        }

        var results = await query
            .OrderByDescending(p => p.PurchaseDate)
            .Take(500)
            .Select(p => new PersonalPurchaseResponse
            {
                Id = p.Id,
                TransactionId = p.TransactionId,
                TransactionNumber = p.Transaction != null ? p.Transaction.TransactionNumber : string.Empty,
                TotalUsd = p.TotalUsd,
                TotalLbp = p.TotalLbp,
                PurchaseDate = p.PurchaseDate
            })
            .ToListAsync(cancellationToken);

        return Ok(results);
    }
}

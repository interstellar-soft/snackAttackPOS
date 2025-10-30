using System;
using System.Collections.Generic;
using System.Linq;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PosBackend.Application.Responses;
using PosBackend.Application.Services;
using PosBackend.Domain.Entities;
using PosBackend.Features.Common;
using PosBackend.Infrastructure.Data;

namespace PosBackend.Features.Analytics;

[ApiController]
[Route("api/analytics")]
[Authorize(Roles = "Admin,Manager")]
public class AnalyticsController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly AuditLogger _auditLogger;

    public AnalyticsController(ApplicationDbContext db, AuditLogger auditLogger)
    {
        _db = db;
        _auditLogger = auditLogger;
    }

    [HttpGet("profit")]
    public async Task<ActionResult<ProfitSummaryResponse>> GetProfitSummary([FromQuery] string? timezone, CancellationToken cancellationToken)
    {
        var lookbackStart = DateTime.UtcNow.AddYears(-3);
        var lines = await _db.TransactionLines
            .Include(l => l.Transaction)
            .Where(l => l.Transaction != null && l.Transaction.CreatedAt >= lookbackStart)
            .ToListAsync(cancellationToken);

        if (lines.Count == 0)
        {
            return new ProfitSummaryResponse();
        }

        var resolvedTimezone = ResolveTimeZone(timezone);

        var hourly = BuildSeries(lines, resolvedTimezone, StartOfHourUtc);

        var daily = BuildSeries(lines, resolvedTimezone, StartOfDayUtc);

        var weekly = BuildSeries(lines, resolvedTimezone, StartOfWeekUtc);

        var monthly = BuildSeries(lines, resolvedTimezone, StartOfMonthUtc);

        return new ProfitSummaryResponse
        {
            Daily = new ProfitSeries { Points = hourly },
            Weekly = new ProfitSeries { Points = daily },
            Monthly = new ProfitSeries { Points = weekly },
            Yearly = new ProfitSeries { Points = monthly }
        };
    }

    [HttpGet("dashboard")]
    public async Task<ActionResult<AnalyticsDashboardResponse>> GetDashboard(CancellationToken cancellationToken)
    {
        var transactions = await _db.Transactions
            .Include(t => t.Lines)
            .ThenInclude(l => l.Product)
            .ThenInclude(p => p!.Category)
            .OrderByDescending(t => t.CreatedAt)
            .Take(500)
            .ToListAsync(cancellationToken);

        if (!transactions.Any())
        {
            return new AnalyticsDashboardResponse
            {
                ProfitLeaders = new[]
                {
                    new MetricValue("Sample Apples", 1200m),
                    new MetricValue("Sample Bananas", 980m)
                },
                LossLeaders = new[]
                {
                    new MetricValue("Sample Milk", -150m),
                    new MetricValue("Sample Bread", -90m)
                },
                MarkdownRecovery = new[]
                {
                    new MetricValue("Dairy", 420m),
                    new MetricValue("Produce", 300m)
                },
                CurrencyMix = new[]
                {
                    new MetricValue("USD", 65m),
                    new MetricValue("LBP", 35m)
                },
                ChangeIssuance = new[]
                {
                    new MetricValue("USD", 80m),
                    new MetricValue("LBP", 120m)
                },
                DailySales = Enumerable.Range(0, 14)
                    .Select(offset => new TimeseriesPoint(DateTime.UtcNow.AddDays(-offset), 500 + offset * 20))
                    .OrderBy(point => point.Date)
                    .ToList(),
                ProfitMargins = new[]
                {
                    new MarginPoint("Sample Apples", 32.5m, 1200m),
                    new MarginPoint("Sample Bananas", 28.4m, 980m)
                },
                SeasonalForecast = Enumerable.Range(1, 14)
                    .Select(offset => new TimeseriesBandPoint(DateTime.UtcNow.AddDays(offset), 540 + offset * 8, 520 + offset * 6, 560 + offset * 10))
                    .ToList(),
                CurrencyMixTrend = Enumerable.Range(0, 14)
                    .Select(offset => new CurrencySplitPoint(DateTime.UtcNow.AddDays(-offset), 320 + offset * 5, 280 + offset * 8))
                    .OrderBy(point => point.Date)
                    .ToList(),
                ChangeIssuanceTrend = Enumerable.Range(0, 14)
                    .Select(offset => new CurrencySplitPoint(DateTime.UtcNow.AddDays(-offset), 40 + offset * 1, 120 + offset * 3))
                    .OrderBy(point => point.Date)
                    .ToList()
            };
        }

        TimeZoneInfo timezone;
        try
        {
            timezone = TimeZoneInfo.FindSystemTimeZoneById("Asia/Beirut");
        }
        catch (TimeZoneNotFoundException)
        {
            timezone = TimeZoneInfo.Local;
        }
        catch (InvalidTimeZoneException)
        {
            timezone = TimeZoneInfo.Local;
        }

        DateTime ToLocal(DateTime utc) => TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), timezone);

        var transactionLines = transactions.SelectMany(t => t.Lines).ToList();

        var profitability = transactionLines
            .GroupBy(l => l.Product?.Name ?? "Unknown")
            .Select(g =>
            {
                var revenue = g.Sum(l => l.TotalUsd);
                var cost = g.Sum(l => l.CostUsd);
                var grossProfit = g.Sum(l => l.ProfitUsd);
                var marginPercent = revenue == 0 ? 0 : Math.Round((grossProfit / revenue) * 100, 2);
                return new
                {
                    Label = g.Key,
                    Revenue = decimal.Round(revenue, 2),
                    GrossProfit = decimal.Round(grossProfit, 2),
                    MarginPercent = marginPercent
                };
            })
            .ToList();

        var profitLeaders = profitability
            .OrderByDescending(p => p.GrossProfit)
            .Take(5)
            .Select(p => new MetricValue(p.Label, p.GrossProfit))
            .ToList();

        var lossLeaders = profitability
            .OrderBy(p => p.GrossProfit)
            .Take(5)
            .Select(p => new MetricValue(p.Label, p.GrossProfit))
            .ToList();

        var profitMargins = profitability
            .OrderByDescending(p => p.MarginPercent)
            .Take(5)
            .Select(p => new MarginPoint(p.Label, p.MarginPercent, p.Revenue))
            .ToList();

        var markdownRecovery = transactions
            .SelectMany(t => t.Lines)
            .GroupBy(l => l.Product?.Category?.Name ?? "General")
            .Select(g => new MetricValue(g.Key, g.Sum(l => (l.BaseUnitPriceUsd - l.UnitPriceUsd) * l.Quantity)))
            .OrderByDescending(m => m.Value)
            .ToList();

        var currencyMix = new List<MetricValue>
        {
            new("USD", transactions.Sum(t => t.PaidUsd)),
            new("LBP", transactions.Sum(t => t.PaidLbp))
        };

        var changeIssuance = new List<MetricValue>
        {
            new("USD", transactions.Where(t => t.BalanceUsd < 0).Sum(t => Math.Abs(t.BalanceUsd))),
            new("LBP", transactions.Where(t => t.BalanceLbp < 0).Sum(t => Math.Abs(t.BalanceLbp)))
        };

        var dailySales = transactions
            .GroupBy(t => DateOnly.FromDateTime(ToLocal(t.CreatedAt)))
            .Select(g => new TimeseriesPoint(ToLocal(g.Key.ToDateTime(TimeOnly.MinValue)), g.Sum(t => t.TotalUsd)))
            .OrderBy(point => point.Date)
            .ToList();

        if (dailySales.Count == 0)
        {
            dailySales.Add(new TimeseriesPoint(ToLocal(DateTime.UtcNow), 0));
        }

        var values = dailySales.Select(point => point.Value).ToList();
        var average = values.Average();
        var stdDev = values.Count > 1
            ? Math.Sqrt(values.Sum(value => Math.Pow((double)(value - average), 2)) / values.Count)
            : 0d;

        var seasonLength = Math.Clamp(values.Count, 1, 7);
        var seasonalWindow = dailySales.TakeLast(seasonLength).ToList();
        if (seasonalWindow.Count == 0)
        {
            seasonalWindow.Add(new TimeseriesPoint(ToLocal(DateTime.UtcNow), 0));
        }
        var trend = dailySales.Count > 1
            ? (dailySales.Last().Value - dailySales.First().Value) / (dailySales.Count - 1)
            : 0;

        var seasonalForecast = new List<TimeseriesBandPoint>();
        for (var day = 1; day <= 14; day++)
        {
            var template = seasonalWindow[(day - 1) % seasonLength].Value;
            var forecastBase = template + trend * day;
            var lower = Math.Max(0, forecastBase - (decimal)(1.645 * stdDev));
            var upper = forecastBase + (decimal)(1.645 * stdDev);
            seasonalForecast.Add(new TimeseriesBandPoint(
                ToLocal(DateTime.UtcNow.AddDays(day)),
                decimal.Round(forecastBase, 2),
                decimal.Round(lower, 2),
                decimal.Round(upper, 2)));
        }

        var currencyMixTrend = transactions
            .GroupBy(t => DateOnly.FromDateTime(ToLocal(t.CreatedAt)))
            .Select(g => new CurrencySplitPoint(
                ToLocal(g.Key.ToDateTime(TimeOnly.MinValue)),
                g.Sum(t => t.PaidUsd),
                g.Sum(t => t.PaidLbp)))
            .OrderBy(point => point.Date)
            .ToList();

        var changeIssuanceTrend = transactions
            .GroupBy(t => DateOnly.FromDateTime(ToLocal(t.CreatedAt)))
            .Select(g => new CurrencySplitPoint(
                ToLocal(g.Key.ToDateTime(TimeOnly.MinValue)),
                g.Where(t => t.BalanceUsd < 0).Sum(t => Math.Abs(t.BalanceUsd)),
                g.Where(t => t.BalanceLbp < 0).Sum(t => Math.Abs(t.BalanceLbp))))
            .OrderBy(point => point.Date)
            .ToList();

        return new AnalyticsDashboardResponse
        {
            ProfitLeaders = profitLeaders,
            LossLeaders = lossLeaders,
            MarkdownRecovery = markdownRecovery,
            CurrencyMix = currencyMix,
            ChangeIssuance = changeIssuance,
            DailySales = dailySales,
            ProfitMargins = profitMargins,
            SeasonalForecast = seasonalForecast,
            CurrencyMixTrend = currencyMixTrend,
            ChangeIssuanceTrend = changeIssuanceTrend
        };
    }

    [HttpPost("reset")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> ResetAnalytics(CancellationToken cancellationToken)
    {
        var transactionCount = await _db.Transactions.CountAsync(cancellationToken);
        var lineCount = await _db.TransactionLines.CountAsync(cancellationToken);

        await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);

        await _db.TransactionLines.ExecuteDeleteAsync(cancellationToken);
        await _db.Transactions.ExecuteDeleteAsync(cancellationToken);

        await transaction.CommitAsync(cancellationToken);

        var currentUserId = User.GetCurrentUserId();
        if (currentUserId.HasValue)
        {
            await _auditLogger.LogAsync(
                currentUserId.Value,
                "ResetAnalyticsData",
                nameof(PosTransaction),
                null,
                new
                {
                    TransactionsRemoved = transactionCount,
                    TransactionLinesRemoved = lineCount
                },
                cancellationToken);
        }

        return NoContent();
    }

    private static List<ProfitPoint> BuildSeries(
        IEnumerable<TransactionLine> lines,
        TimeZoneInfo timezone,
        Func<DateTime, TimeZoneInfo, DateTime> bucketSelector)
    {
        return lines
            .Where(l => l.Transaction is not null)
            .GroupBy(l =>
            {
                var utcCreatedAt = DateTime.SpecifyKind(l.Transaction!.CreatedAt, DateTimeKind.Utc);
                return bucketSelector(utcCreatedAt, timezone);
            })
            .OrderBy(g => g.Key)
            .Select(g =>
            {
                var revenue = g.Sum(line => line.TotalUsd);
                var cost = g.Sum(line => line.CostUsd);
                var gross = g.Sum(line => line.ProfitUsd);
                return new ProfitPoint
                {
                    PeriodStart = g.Key,
                    RevenueUsd = decimal.Round(revenue, 2),
                    CostUsd = decimal.Round(cost, 2),
                    GrossProfitUsd = decimal.Round(gross, 2),
                    NetProfitUsd = decimal.Round(gross, 2)
                };
            })
            .ToList();
    }

    private static TimeZoneInfo ResolveTimeZone(string? timezoneId)
    {
        if (!string.IsNullOrWhiteSpace(timezoneId))
        {
            try
            {
                return TimeZoneInfo.FindSystemTimeZoneById(timezoneId);
            }
            catch (TimeZoneNotFoundException)
            {
            }
            catch (InvalidTimeZoneException)
            {
            }
        }

        return TimeZoneInfo.Local;
    }

    private static DateTime StartOfHourUtc(DateTime dateUtc, TimeZoneInfo timezone)
    {
        var local = TimeZoneInfo.ConvertTimeFromUtc(dateUtc, timezone);
        var localStart = new DateTime(local.Year, local.Month, local.Day, local.Hour, 0, 0, DateTimeKind.Unspecified);
        return TimeZoneInfo.ConvertTimeToUtc(localStart, timezone);
    }

    private static DateTime StartOfDayUtc(DateTime dateUtc, TimeZoneInfo timezone)
    {
        var local = TimeZoneInfo.ConvertTimeFromUtc(dateUtc, timezone);
        var localStart = new DateTime(local.Year, local.Month, local.Day, 0, 0, 0, DateTimeKind.Unspecified);
        return TimeZoneInfo.ConvertTimeToUtc(localStart, timezone);
    }

    private static DateTime StartOfMonthUtc(DateTime dateUtc, TimeZoneInfo timezone)
    {
        var local = TimeZoneInfo.ConvertTimeFromUtc(dateUtc, timezone);
        var localStart = new DateTime(local.Year, local.Month, 1, 0, 0, 0, DateTimeKind.Unspecified);
        return TimeZoneInfo.ConvertTimeToUtc(localStart, timezone);
    }

    private static DateTime StartOfWeekUtc(DateTime dateUtc, TimeZoneInfo timezone)
    {
        var local = TimeZoneInfo.ConvertTimeFromUtc(dateUtc, timezone);
        var localStart = new DateTime(local.Year, local.Month, local.Day, 0, 0, 0, DateTimeKind.Unspecified);
        var diff = (7 + (localStart.DayOfWeek - DayOfWeek.Monday)) % 7;
        var weekStartLocal = localStart.AddDays(-diff);
        return TimeZoneInfo.ConvertTimeToUtc(weekStartLocal, timezone);
    }
}

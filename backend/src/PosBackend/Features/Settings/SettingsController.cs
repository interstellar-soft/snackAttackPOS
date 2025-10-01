using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PosBackend.Application.Requests;
using PosBackend.Application.Responses;
using PosBackend.Application.Services;
using PosBackend.Domain.Entities;
using PosBackend.Infrastructure.Data;

namespace PosBackend.Features.Settings;

[ApiController]
[Route("api/settings")]
[Authorize(Roles = "Admin,Manager")]
public class SettingsController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly CurrencyService _currencyService;
    private readonly AuditLogger _auditLogger;

    public SettingsController(ApplicationDbContext db, CurrencyService currencyService, AuditLogger auditLogger)
    {
        _db = db;
        _currencyService = currencyService;
        _auditLogger = auditLogger;
    }

    [HttpGet("currency-rate")]
    public async Task<ActionResult<BalanceResponse>> GetCurrencyRate(CancellationToken cancellationToken)
    {
        var current = await _currencyService.GetCurrentRateAsync(cancellationToken);
        return new BalanceResponse
        {
            ExchangeRate = current.Rate,
            TotalUsd = 0,
            TotalLbp = 0,
            PaidUsd = 0,
            PaidLbp = 0,
            BalanceUsd = 0,
            BalanceLbp = 0
        };
    }

    [HttpPut("currency-rate")]
    public async Task<ActionResult> UpdateCurrencyRate([FromBody] UpdateCurrencyRateRequest request, CancellationToken cancellationToken)
    {
        var userId = Guid.Parse(User.FindFirst("sub")?.Value ?? throw new InvalidOperationException("Missing user id"));
        var rate = new CurrencyRate
        {
            Rate = request.Rate,
            Notes = request.Notes,
            BaseCurrency = "USD",
            QuoteCurrency = "LBP",
            UserId = userId
        };
        await _db.CurrencyRates.AddAsync(rate, cancellationToken);
        await _db.SaveChangesAsync(cancellationToken);

        await _auditLogger.LogAsync(userId, "UpdateCurrencyRate", nameof(CurrencyRate), rate.Id, new
        {
            rate.Rate,
            rate.Notes
        }, cancellationToken);

        return NoContent();
    }
}

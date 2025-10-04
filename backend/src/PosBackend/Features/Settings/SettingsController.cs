using System;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PosBackend.Application.Requests;
using PosBackend.Application.Responses;
using PosBackend.Application.Services;
using PosBackend.Domain.Entities;
using PosBackend.Features.Common;
using PosBackend.Infrastructure.Data;

namespace PosBackend.Features.Settings;

[ApiController]
[Route("api/settings")]
[Authorize]
public class SettingsController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly CurrencyService _currencyService;
    private readonly AuditLogger _auditLogger;
    private readonly StoreProfileService _storeProfileService;

    public SettingsController(ApplicationDbContext db, CurrencyService currencyService, AuditLogger auditLogger, StoreProfileService storeProfileService)
    {
        _db = db;
        _currencyService = currencyService;
        _auditLogger = auditLogger;
        _storeProfileService = storeProfileService;
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
    [Authorize(Roles = "Admin,Manager")]
    public async Task<ActionResult> UpdateCurrencyRate([FromBody] UpdateCurrencyRateRequest request, CancellationToken cancellationToken)
    {
        var userId = User.GetCurrentUserId();
        if (userId is null)
        {
            return Unauthorized();
        }
        var rate = new CurrencyRate
        {
            Rate = request.Rate,
            Notes = request.Notes,
            BaseCurrency = "USD",
            QuoteCurrency = "LBP",
            UserId = userId.Value
        };
        await _db.CurrencyRates.AddAsync(rate, cancellationToken);
        await _db.SaveChangesAsync(cancellationToken);

        await _auditLogger.LogAsync(userId.Value, "UpdateCurrencyRate", nameof(CurrencyRate), rate.Id, new
        {
            rate.Rate,
            rate.Notes
        }, cancellationToken);

        return NoContent();
    }

    [HttpGet("store-profile")]
    public async Task<ActionResult<StoreProfileResponse>> GetStoreProfile(CancellationToken cancellationToken)
    {
        var profile = await _storeProfileService.GetCurrentAsync(cancellationToken);
        return new StoreProfileResponse
        {
            Id = profile.Id,
            Name = profile.Name,
            CreatedAt = profile.CreatedAt,
            UpdatedAt = profile.UpdatedAt
        };
    }

    [HttpPut("store-profile")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<ActionResult<StoreProfileResponse>> UpdateStoreProfile([FromBody] UpdateStoreProfileRequest request, CancellationToken cancellationToken)
    {
        var trimmedName = request.Name?.Trim();
        if (string.IsNullOrWhiteSpace(trimmedName))
        {
            return BadRequest("Store name is required.");
        }

        var userId = User.GetCurrentUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        var profile = await _db.StoreProfiles.FirstOrDefaultAsync(cancellationToken);
        if (profile is null)
        {
            profile = new StoreProfile { Name = trimmedName };
            await _db.StoreProfiles.AddAsync(profile, cancellationToken);
        }
        else
        {
            profile.Name = trimmedName;
            profile.UpdatedAt = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync(cancellationToken);
        await _auditLogger.LogAsync(userId.Value, "UpdateStoreProfile", nameof(StoreProfile), profile.Id, new
        {
            profile.Name
        }, cancellationToken);

        return Ok(new StoreProfileResponse
        {
            Id = profile.Id,
            Name = profile.Name,
            CreatedAt = profile.CreatedAt,
            UpdatedAt = profile.UpdatedAt
        });
    }

}

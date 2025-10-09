using Microsoft.EntityFrameworkCore;
using PosBackend.Domain.Entities;
using PosBackend.Infrastructure.Data;

namespace PosBackend.Application.Services;

public class CurrencyService
{
    private readonly ApplicationDbContext _db;

    public CurrencyService(ApplicationDbContext db)
    {
        _db = db;
    }

    public async Task<CurrencyRate> GetCurrentRateAsync(CancellationToken cancellationToken = default)
    {
        return await _db.CurrencyRates.OrderByDescending(r => r.CreatedAt).FirstAsync(cancellationToken);
    }

    public decimal RoundUsd(decimal value) => decimal.Round(value, 2, MidpointRounding.AwayFromZero);

    public decimal RoundLbp(decimal value) => decimal.Round(value, 0, MidpointRounding.AwayFromZero);

    public decimal ConvertUsdToLbp(decimal amountUsd, decimal? rate = null)
    {
        var effectiveRate = rate ?? throw new InvalidOperationException("Exchange rate required");
        return RoundLbp(amountUsd * effectiveRate);
    }

    public decimal ConvertLbpToUsd(decimal amountLbp, decimal? rate = null)
    {
        var effectiveRate = rate ?? throw new InvalidOperationException("Exchange rate required");
        return RoundUsd(amountLbp / effectiveRate);
    }

    public (decimal totalUsd, decimal totalLbp, decimal balanceUsd, decimal balanceLbp) ComputeBalance(
        decimal totalUsd,
        decimal paidUsd,
        decimal paidLbp,
        decimal exchangeRate,
        decimal? totalLbpOverride = null)
    {
        var roundedTotalUsd = RoundUsd(totalUsd);
        var roundedTotalLbp = totalLbpOverride.HasValue
            ? RoundLbp(totalLbpOverride.Value)
            : ConvertUsdToLbp(roundedTotalUsd, exchangeRate);
        var roundedPaidUsd = RoundUsd(paidUsd);
        var roundedPaidLbp = RoundLbp(paidLbp);
        var paidUsdEquivalent = roundedPaidUsd + ConvertLbpToUsd(roundedPaidLbp, exchangeRate);
        var balanceUsd = RoundUsd(roundedTotalUsd - paidUsdEquivalent);
        var paidLbpEquivalent = roundedPaidLbp + ConvertUsdToLbp(roundedPaidUsd, exchangeRate);
        var balanceLbp = RoundLbp(roundedTotalLbp - paidLbpEquivalent);
        return (roundedTotalUsd, roundedTotalLbp, balanceUsd, balanceLbp);
    }
}

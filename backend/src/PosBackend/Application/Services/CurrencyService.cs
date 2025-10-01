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
        decimal exchangeRate)
    {
        var totalLbp = ConvertUsdToLbp(totalUsd, exchangeRate);
        var paidUsdEquivalent = paidUsd + ConvertLbpToUsd(paidLbp, exchangeRate);
        var balanceUsd = RoundUsd(totalUsd - paidUsdEquivalent);
        var paidLbpEquivalent = paidLbp + ConvertUsdToLbp(paidUsd, exchangeRate);
        var balanceLbp = RoundLbp(totalLbp - paidLbpEquivalent);
        return (RoundUsd(totalUsd), totalLbp, balanceUsd, balanceLbp);
    }
}

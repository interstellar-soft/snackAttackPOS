using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using PosBackend.Application.Requests;
using PosBackend.Application.Responses;
using PosBackend.Application.Services;
using PosBackend.Features.Common;
using PosBackend.Domain.Entities;
using PosBackend.Infrastructure.Data;
using PosBackend;

namespace PosBackend.Features.Transactions;

[ApiController]
[Route("api/transactions")]
[Authorize]
public class TransactionsController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly CartPricingService _pricingService;
    private readonly ReceiptRenderer _receiptRenderer;
    private readonly PosEventHub _eventHub;
    private readonly AuditLogger _auditLogger;
    private readonly CurrencyService _currencyService;
    private readonly MlClient _mlClient;
    private readonly bool _visionEnabled;

    public TransactionsController(ApplicationDbContext db, CartPricingService pricingService, ReceiptRenderer receiptRenderer, PosEventHub eventHub, AuditLogger auditLogger, CurrencyService currencyService, MlClient mlClient, IOptions<FeatureFlags> featureFlags)
    {
        _db = db;
        _pricingService = pricingService;
        _receiptRenderer = receiptRenderer;
        _eventHub = eventHub;
        _auditLogger = auditLogger;
        _currencyService = currencyService;
        _mlClient = mlClient;
        _visionEnabled = featureFlags.Value.VisionEnabled;
    }

    [HttpGet]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<ActionResult<IEnumerable<TransactionResponse>>> GetAll([FromQuery] int take = 100, CancellationToken cancellationToken = default)
    {
        var limit = Math.Clamp(take, 1, 500);
        var transactions = await _db.Transactions
            .Include(t => t.User)
            .Include(t => t.Lines)
                .ThenInclude(l => l.Product)
                    .ThenInclude(p => p.Category)
            .Include(t => t.Lines)
                .ThenInclude(l => l.Product)
                    .ThenInclude(p => p.Inventory)
            .Include(t => t.Lines)
                .ThenInclude(l => l.PriceRule)
            .Include(t => t.Lines)
                .ThenInclude(l => l.Offer)
            .OrderByDescending(t => t.CreatedAt)
            .Take(limit)
            .ToListAsync(cancellationToken);

        var responses = transactions.Select(ToResponse).ToList();
        return Ok(responses);
    }

    [HttpGet("{id:guid}")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<ActionResult<TransactionResponse>> GetById(Guid id, CancellationToken cancellationToken)
    {
        var transaction = await _db.Transactions
            .Include(t => t.User)
            .Include(t => t.Lines)
                .ThenInclude(l => l.Product)
                    .ThenInclude(p => p.Category)
            .Include(t => t.Lines)
                .ThenInclude(l => l.Product)
                    .ThenInclude(p => p.Inventory)
            .Include(t => t.Lines)
                .ThenInclude(l => l.PriceRule)
            .Include(t => t.Lines)
                .ThenInclude(l => l.Offer)
            .FirstOrDefaultAsync(t => t.Id == id, cancellationToken);

        if (transaction is null)
        {
            return NotFound();
        }

        return ToResponse(transaction);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<ActionResult<TransactionResponse>> Update(Guid id, [FromBody] UpdateTransactionRequest request, CancellationToken cancellationToken)
    {
        var allowManualPricing = User.IsInRole("Admin");
        var currentUserId = User.GetCurrentUserId();
        if (!ModelState.IsValid)
        {
            return ValidationProblem(ModelState);
        }

        if (request.Items.Any(i => i.IsWaste) && !allowManualPricing)
        {
            return Forbid();
        }

        if (request.Items.Count == 0)
        {
            return BadRequest(new { message = "At least one item is required." });
        }

        if (request.SaveToMyCart && !allowManualPricing)
        {
            return Forbid();
        }

        var transaction = await _db.Transactions
            .Include(t => t.User)
            .Include(t => t.Lines)
                .ThenInclude(l => l.Product)
                    .ThenInclude(p => p.Inventory)
            .Include(t => t.Lines)
                .ThenInclude(l => l.PriceRule)
            .Include(t => t.Lines)
                .ThenInclude(l => l.Offer)
            .FirstOrDefaultAsync(t => t.Id == id, cancellationToken);

        if (transaction is null)
        {
            return NotFound();
        }

        var rate = request.ExchangeRate > 0
            ? request.ExchangeRate
            : transaction.ExchangeRateUsed;

        var priceAtCostOnly = allowManualPricing && request.SaveToMyCart;
        var (computedTotalUsd, _, pricedLines) = await _pricingService.PriceCartAsync(
            request.Items,
            rate,
            allowManualPricing,
            priceAtCostOnly,
            cancellationToken);

        var manualTotalsAllowed = allowManualPricing && !request.SaveToMyCart;
        var (effectiveTotalUsd, totalLbpOverride, hasManualTotalOverride) = manualTotalsAllowed
            ? ResolveManualTotals(
                computedTotalUsd,
                rate,
                allowManualPricing,
                request.ManualTotalUsd,
                request.ManualTotalLbp)
            : (computedTotalUsd, (decimal?)null, false);

        foreach (var existingLine in transaction.Lines.ToList())
        {
            var inventory = existingLine.Product?.Inventory
                ?? await _db.Inventories.FirstOrDefaultAsync(i => i.ProductId == existingLine.ProductId, cancellationToken);
            if (inventory is not null)
            {
                inventory.QuantityOnHand += existingLine.Quantity;
            }
        }

        _db.TransactionLines.RemoveRange(transaction.Lines);
        transaction.Lines.Clear();

        var balance = _currencyService.ComputeBalance(effectiveTotalUsd, request.PaidUsd, request.PaidLbp, rate, totalLbpOverride);

        transaction.ExchangeRateUsed = rate;
        transaction.TotalUsd = balance.totalUsd;
        transaction.TotalLbp = balance.totalLbp;
        transaction.PaidUsd = _currencyService.RoundUsd(request.PaidUsd);
        transaction.PaidLbp = _currencyService.RoundLbp(request.PaidLbp);
        transaction.BalanceUsd = balance.balanceUsd;
        transaction.BalanceLbp = balance.balanceLbp;
        transaction.UpdatedAt = DateTime.UtcNow;
        transaction.HasManualTotalOverride = hasManualTotalOverride;

        foreach (var line in pricedLines)
        {
            line.TransactionId = transaction.Id;
            line.Transaction = transaction;
            transaction.Lines.Add(line);

            var inventory = line.Product?.Inventory
                ?? await _db.Inventories.FirstOrDefaultAsync(i => i.ProductId == line.ProductId, cancellationToken);
            if (inventory is not null)
            {
                inventory.QuantityOnHand = Math.Max(0, inventory.QuantityOnHand - line.Quantity);
            }
        }

        if (allowManualPricing)
        {
            var existingPersonalPurchase = await _db.PersonalPurchases
                .FirstOrDefaultAsync(p => p.TransactionId == transaction.Id, cancellationToken);

            if (request.SaveToMyCart)
            {
                if (existingPersonalPurchase is null)
                {
                    await _db.PersonalPurchases.AddAsync(new PersonalPurchase
                    {
                        TransactionId = transaction.Id,
                        UserId = transaction.UserId,
                        TotalUsd = transaction.TotalUsd,
                        TotalLbp = transaction.TotalLbp,
                        PurchaseDate = DateTime.UtcNow
                    }, cancellationToken);
                }
                else
                {
                    existingPersonalPurchase.TotalUsd = transaction.TotalUsd;
                    existingPersonalPurchase.TotalLbp = transaction.TotalLbp;
                    existingPersonalPurchase.PurchaseDate = DateTime.UtcNow;
                }
            }
            else if (existingPersonalPurchase is not null)
            {
                _db.PersonalPurchases.Remove(existingPersonalPurchase);
            }
        }

        await _db.SaveChangesAsync(cancellationToken);

        if (currentUserId.HasValue)
        {
            await _auditLogger.LogAsync(currentUserId.Value, "UpdateTransaction", nameof(PosTransaction), transaction.Id, new
            {
                transaction.TransactionNumber,
                transaction.TotalUsd,
                transaction.TotalLbp
            }, cancellationToken);
        }

        return ToResponse(transaction);
    }

    [HttpPost("checkout")]
    public async Task<ActionResult<CheckoutResponse>> Checkout([FromBody] CheckoutRequest request, CancellationToken cancellationToken)
    {
        var userId = User.GetCurrentUserId();
        if (userId is null)
        {
            return Unauthorized();
        }
        var allowManualPricing = User.IsInRole("Admin");
        if (request.Items.Any(i => i.IsWaste) && !allowManualPricing)
        {
            return Forbid();
        }
        if (request.SaveToMyCart && !allowManualPricing)
        {
            return Forbid();
        }
        var currentRate = request.ExchangeRate > 0
            ? request.ExchangeRate
            : (await _currencyService.GetCurrentRateAsync(cancellationToken)).Rate;

        var priceAtCostOnly = allowManualPricing && request.SaveToMyCart;
        var (computedTotalUsd, _, lines) = await _pricingService.PriceCartAsync(
            request.Items,
            currentRate,
            allowManualPricing,
            priceAtCostOnly,
            cancellationToken);

        var manualTotalsAllowed = allowManualPricing && !request.SaveToMyCart;
        var (effectiveTotalUsd, totalLbpOverride, hasManualTotalOverride) = manualTotalsAllowed
            ? ResolveManualTotals(
                computedTotalUsd,
                currentRate,
                allowManualPricing,
                request.ManualTotalUsd,
                request.ManualTotalLbp)
            : (computedTotalUsd, (decimal?)null, false);

        var balance = _currencyService.ComputeBalance(effectiveTotalUsd, request.PaidUsd, request.PaidLbp, currentRate, totalLbpOverride);

        var transaction = new PosTransaction
        {
            TransactionNumber = $"TX-{DateTime.UtcNow:yyyyMMddHHmmssfff}",
            UserId = userId.Value,
            TotalUsd = balance.totalUsd,
            TotalLbp = balance.totalLbp,
            PaidUsd = _currencyService.RoundUsd(request.PaidUsd),
            PaidLbp = _currencyService.RoundLbp(request.PaidLbp),
            ExchangeRateUsed = currentRate,
            BalanceUsd = balance.balanceUsd,
            BalanceLbp = balance.balanceLbp,
            HasManualTotalOverride = hasManualTotalOverride
        };

        foreach (var line in lines)
        {
            transaction.Lines.Add(line);
        }

        var visionFlags = new List<string>();
        if (_visionEnabled)
        {
            foreach (var line in lines)
            {
                var vision = await _mlClient.PredictVisionAsync(
                    new MlClient.VisionRequest(
                        line.ProductId.ToString(),
                        new[] { (double)line.UnitPriceUsd, (double)line.Quantity }),
                    cancellationToken);
                if (vision is not null && (!vision.IsMatch || vision.Confidence < 0.6))
                {
                    visionFlags.Add($"vision:{vision.PredictedLabel}:{vision.Confidence:0.00}");
                }
            }
        }

        string receiptBase64 = string.Empty;
        if (!visionFlags.Any())
        {
            await _db.Transactions.AddAsync(transaction, cancellationToken);

            if (allowManualPricing && request.SaveToMyCart)
            {
                await _db.PersonalPurchases.AddAsync(new PersonalPurchase
                {
                    TransactionId = transaction.Id,
                    UserId = transaction.UserId,
                    TotalUsd = transaction.TotalUsd,
                    TotalLbp = transaction.TotalLbp,
                    PurchaseDate = DateTime.UtcNow
                }, cancellationToken);
            }

            foreach (var line in lines)
            {
                var inventory = await _db.Inventories.FirstOrDefaultAsync(i => i.ProductId == line.ProductId, cancellationToken);
                if (inventory is not null)
                {
                    inventory.QuantityOnHand = Math.Max(0, inventory.QuantityOnHand - line.Quantity);
                }
            }

            await _db.SaveChangesAsync(cancellationToken);

            var receiptBytes = await _receiptRenderer.RenderPdfAsync(transaction, lines, currentRate, cancellationToken);
            receiptBase64 = Convert.ToBase64String(receiptBytes);

            await _eventHub.PublishAsync(new PosEvent("transaction.completed", new
            {
                transaction.Id,
                transaction.TransactionNumber,
                transaction.TotalUsd,
                transaction.TotalLbp
            }));

            await _auditLogger.LogAsync(userId.Value, "Checkout", nameof(PosTransaction), transaction.Id, new
            {
                transaction.TransactionNumber,
                transaction.TotalUsd,
                transaction.TotalLbp
            }, cancellationToken);
        }

        var responseLines = lines.Select(CheckoutLineResponse.FromEntity).ToList();

        return new CheckoutResponse
        {
            TransactionId = transaction.Id,
            TransactionNumber = transaction.TransactionNumber,
            TotalUsd = transaction.TotalUsd,
            TotalLbp = transaction.TotalLbp,
            PaidUsd = transaction.PaidUsd,
            PaidLbp = transaction.PaidLbp,
            BalanceUsd = transaction.BalanceUsd,
            BalanceLbp = transaction.BalanceLbp,
            ExchangeRate = transaction.ExchangeRateUsed,
            Lines = responseLines,
            ReceiptPdfBase64 = receiptBase64,
            RequiresOverride = visionFlags.Any(),
            OverrideReason = visionFlags.Any() ? string.Join(";", visionFlags) : null,
            HasManualTotalOverride = transaction.HasManualTotalOverride
        };
    }

    [HttpPost("return")]
    public async Task<ActionResult<CheckoutResponse>> Return([FromBody] ReturnRequest request, CancellationToken cancellationToken)
    {
        var original = await _db.Transactions
            .Include(t => t.Lines)
                .ThenInclude(l => l.Product)
            .Include(t => t.Lines)
                .ThenInclude(l => l.PriceRule)
            .Include(t => t.Lines)
                .ThenInclude(l => l.Offer)
            .FirstOrDefaultAsync(t => t.Id == request.TransactionId, cancellationToken);
        if (original is null)
        {
            return NotFound();
        }

        var lines = original.Lines.Where(l => request.LineIds.Contains(l.Id)).Select(l => new TransactionLine
        {
            ProductId = l.ProductId,
            Product = l.Product,
            PriceRuleId = l.PriceRuleId,
            PriceRule = l.PriceRule,
            OfferId = l.OfferId,
            Offer = l.Offer,
            Quantity = -Math.Abs(l.Quantity),
            BaseUnitPriceUsd = l.BaseUnitPriceUsd,
            BaseUnitPriceLbp = l.BaseUnitPriceLbp,
            UnitPriceUsd = l.UnitPriceUsd,
            UnitPriceLbp = l.UnitPriceLbp,
            TotalUsd = -Math.Abs(l.TotalUsd),
            TotalLbp = -Math.Abs(l.TotalLbp),
            DiscountPercent = l.DiscountPercent,
            CostUsd = -Math.Abs(l.CostUsd),
            CostLbp = -Math.Abs(l.CostLbp),
            ProfitUsd = -Math.Abs(l.ProfitUsd),
            ProfitLbp = -Math.Abs(l.ProfitLbp),
            IsWaste = l.IsWaste
        }).ToList();

        var totalUsd = _currencyService.RoundUsd(lines.Sum(l => l.TotalUsd));
        var totalLbp = _currencyService.RoundLbp(lines.Sum(l => l.TotalLbp));

        var transaction = new PosTransaction
        {
            TransactionNumber = $"RT-{DateTime.UtcNow:yyyyMMddHHmmssfff}",
            UserId = original.UserId,
            Type = TransactionType.Return,
            TotalUsd = totalUsd,
            TotalLbp = totalLbp,
            PaidUsd = totalUsd,
            PaidLbp = totalLbp,
            ExchangeRateUsed = original.ExchangeRateUsed,
            BalanceUsd = 0,
            BalanceLbp = 0
        };
        foreach (var line in lines)
        {
            transaction.Lines.Add(line);
        }

        await _db.Transactions.AddAsync(transaction, cancellationToken);
        foreach (var line in lines)
        {
            var inventory = await _db.Inventories.FirstOrDefaultAsync(i => i.ProductId == line.ProductId, cancellationToken);
            if (inventory is not null)
            {
                inventory.QuantityOnHand += Math.Abs(line.Quantity);
            }
        }

        await _db.SaveChangesAsync(cancellationToken);

        await _eventHub.PublishAsync(new PosEvent("transaction.return", new { transaction.Id, transaction.TransactionNumber }));
        await _auditLogger.LogAsync(original.UserId, "Return", nameof(PosTransaction), transaction.Id, new
        {
            original.TransactionNumber,
            ReturnTransaction = transaction.TransactionNumber,
            Lines = lines.Select(l => new { l.ProductId, l.Quantity })
        }, cancellationToken);

        var receiptBytes = await _receiptRenderer.RenderPdfAsync(transaction, lines, transaction.ExchangeRateUsed, cancellationToken);

        var responseLines = lines.Select(CheckoutLineResponse.FromEntity).ToList();

        return new CheckoutResponse
        {
            TransactionId = transaction.Id,
            TransactionNumber = transaction.TransactionNumber,
            TotalUsd = transaction.TotalUsd,
            TotalLbp = transaction.TotalLbp,
            PaidUsd = transaction.PaidUsd,
            PaidLbp = transaction.PaidLbp,
            BalanceUsd = 0,
            BalanceLbp = 0,
            ExchangeRate = transaction.ExchangeRateUsed,
            Lines = responseLines,
            ReceiptPdfBase64 = Convert.ToBase64String(receiptBytes)
        };
    }

    [HttpPost("compute-balance")]
    public async Task<ActionResult<BalanceResponse>> ComputeBalance([FromBody] ComputeBalanceRequest request, CancellationToken cancellationToken)
    {
        var rate = request.ExchangeRate.HasValue && request.ExchangeRate.Value > 0
            ? request.ExchangeRate.Value
            : (await _currencyService.GetCurrentRateAsync(cancellationToken)).Rate;

        var result = _currencyService.ComputeBalance(request.TotalUsd, request.PaidUsd, request.PaidLbp, rate);

        return new BalanceResponse
        {
            ExchangeRate = rate,
            TotalUsd = result.totalUsd,
            TotalLbp = result.totalLbp,
            PaidUsd = _currencyService.RoundUsd(request.PaidUsd),
            PaidLbp = _currencyService.RoundLbp(request.PaidLbp),
            BalanceUsd = result.balanceUsd,
            BalanceLbp = result.balanceLbp
        };
    }

    [HttpGet("{id:guid}/receipt")]
    public async Task<ActionResult<ReceiptResponse>> Receipt(Guid id, CancellationToken cancellationToken)
    {
        var transaction = await _db.Transactions.Include(t => t.Lines).ThenInclude(l => l.Product)
            .FirstOrDefaultAsync(t => t.Id == id, cancellationToken);
        if (transaction is null)
        {
            return NotFound();
        }

        var pdfBytes = await _receiptRenderer.RenderPdfAsync(transaction, transaction.Lines, transaction.ExchangeRateUsed, cancellationToken);
        return new ReceiptResponse
        {
            TransactionId = transaction.Id,
            PdfBase64 = Convert.ToBase64String(pdfBytes)
        };
    }

    private (decimal totalUsd, decimal? totalLbpOverride, bool hasManualOverride) ResolveManualTotals(
        decimal computedTotalUsd,
        decimal exchangeRate,
        bool allowManualPricing,
        decimal? manualTotalUsd,
        decimal? manualTotalLbp)
    {
        if (!allowManualPricing)
        {
            return (computedTotalUsd, null, false);
        }

        if (manualTotalUsd.HasValue)
        {
            return (manualTotalUsd.Value, manualTotalLbp, true);
        }

        if (manualTotalLbp.HasValue)
        {
            var convertedTotalUsd = _currencyService.ConvertLbpToUsd(manualTotalLbp.Value, exchangeRate);
            return (convertedTotalUsd, manualTotalLbp, true);
        }

        return (computedTotalUsd, null, false);
    }

    private TransactionResponse ToResponse(PosTransaction transaction)
    {
        return new TransactionResponse
        {
            Id = transaction.Id,
            TransactionNumber = transaction.TransactionNumber,
            Type = transaction.Type.ToString(),
            CashierName = transaction.User?.DisplayName ?? string.Empty,
            ExchangeRateUsed = transaction.ExchangeRateUsed,
            TotalUsd = transaction.TotalUsd,
            TotalLbp = transaction.TotalLbp,
            PaidUsd = transaction.PaidUsd,
            PaidLbp = transaction.PaidLbp,
            BalanceUsd = transaction.BalanceUsd,
            BalanceLbp = transaction.BalanceLbp,
            CreatedAt = transaction.CreatedAt,
            UpdatedAt = transaction.UpdatedAt,
            HasManualTotalOverride = transaction.HasManualTotalOverride,
            Lines = transaction.Lines.Select(CheckoutLineResponse.FromEntity).ToList()
        };
    }
}

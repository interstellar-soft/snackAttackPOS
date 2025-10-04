using System.Collections.Generic;
using System.Linq;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PosBackend.Application.Requests;
using PosBackend.Application.Responses;
using PosBackend.Application.Services;
using PosBackend.Domain.Entities;
using PosBackend.Infrastructure.Data;

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

    public TransactionsController(ApplicationDbContext db, CartPricingService pricingService, ReceiptRenderer receiptRenderer, PosEventHub eventHub, AuditLogger auditLogger, CurrencyService currencyService, MlClient mlClient)
    {
        _db = db;
        _pricingService = pricingService;
        _receiptRenderer = receiptRenderer;
        _eventHub = eventHub;
        _auditLogger = auditLogger;
        _currencyService = currencyService;
        _mlClient = mlClient;
    }

    [HttpPost("checkout")]
    public async Task<ActionResult<CheckoutResponse>> Checkout([FromBody] CheckoutRequest request, CancellationToken cancellationToken)
    {
        var userId = Guid.Parse(User.FindFirst("sub")?.Value ?? throw new InvalidOperationException("Missing user id"));
        var currentRate = request.ExchangeRate > 0
            ? request.ExchangeRate
            : (await _currencyService.GetCurrentRateAsync(cancellationToken)).Rate;

        var (totalUsd, totalLbp, lines) = await _pricingService.PriceCartAsync(request.Items, currentRate, cancellationToken);

        var balance = _currencyService.ComputeBalance(totalUsd, request.PaidUsd, request.PaidLbp, currentRate);

        var transaction = new PosTransaction
        {
            TransactionNumber = $"TX-{DateTime.UtcNow:yyyyMMddHHmmssfff}",
            UserId = userId,
            TotalUsd = balance.totalUsd,
            TotalLbp = balance.totalLbp,
            PaidUsd = _currencyService.RoundUsd(request.PaidUsd),
            PaidLbp = _currencyService.RoundLbp(request.PaidLbp),
            ExchangeRateUsed = currentRate,
            BalanceUsd = balance.balanceUsd,
            BalanceLbp = balance.balanceLbp
        };

        foreach (var line in lines)
        {
            transaction.Lines.Add(line);
        }

        var visionFlags = new List<string>();
        foreach (var line in lines)
        {
            var vision = await _mlClient.PredictVisionAsync(new MlClient.VisionRequest(line.ProductId.ToString(), new[] { (double)line.UnitPriceUsd, (double)line.Quantity }), cancellationToken);
            if (vision is not null && (!vision.IsMatch || vision.Confidence < 0.6))
            {
                visionFlags.Add($"vision:{vision.PredictedLabel}:{vision.Confidence:0.00}");
            }
        }

        string receiptBase64 = string.Empty;
        if (!visionFlags.Any())
        {
            await _db.Transactions.AddAsync(transaction, cancellationToken);

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

            await _auditLogger.LogAsync(userId, "Checkout", nameof(PosTransaction), transaction.Id, new
            {
                transaction.TransactionNumber,
                transaction.TotalUsd,
                transaction.TotalLbp
            }, cancellationToken);
        }

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
            Lines = lines,
            ReceiptPdfBase64 = receiptBase64,
            RequiresOverride = visionFlags.Any(),
            OverrideReason = visionFlags.Any() ? string.Join(";", visionFlags) : null
        };
    }

    [HttpPost("return")]
    public async Task<ActionResult<CheckoutResponse>> Return([FromBody] ReturnRequest request, CancellationToken cancellationToken)
    {
        var original = await _db.Transactions.Include(t => t.Lines).FirstOrDefaultAsync(t => t.Id == request.TransactionId, cancellationToken);
        if (original is null)
        {
            return NotFound();
        }

        var lines = original.Lines.Where(l => request.LineIds.Contains(l.Id)).Select(l => new TransactionLine
        {
            ProductId = l.ProductId,
            Quantity = -Math.Abs(l.Quantity),
            UnitPriceUsd = l.UnitPriceUsd,
            UnitPriceLbp = l.UnitPriceLbp,
            TotalUsd = -Math.Abs(l.TotalUsd),
            TotalLbp = -Math.Abs(l.TotalLbp)
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
            Lines = lines,
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
}

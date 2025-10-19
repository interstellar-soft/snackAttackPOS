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

    [HttpGet("debts")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<ActionResult<IEnumerable<DebtCardResponse>>> GetDebts(CancellationToken cancellationToken)
    {
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
            .Where(t => t.DebtCardName != null && t.DebtSettledAt == null)
            .Where(t => t.BalanceUsd > 0 || t.BalanceLbp > 0)
            .OrderByDescending(t => t.CreatedAt)
            .ToListAsync(cancellationToken);

        var grouped = transactions
            .Select(t => new
            {
                Transaction = t,
                TrimmedName = t.DebtCardName!.Trim()
            })
            .Where(x => !string.IsNullOrWhiteSpace(x.TrimmedName))
            .GroupBy(x => x.TrimmedName, StringComparer.OrdinalIgnoreCase)
            .Select(group =>
            {
                var orderedTransactions = group
                    .Select(x => x.Transaction)
                    .OrderByDescending(t => t.CreatedAt)
                    .ToList();

                var displayName = orderedTransactions
                    .Select(t => t.DebtCardName?.Trim())
                    .FirstOrDefault(name => !string.IsNullOrWhiteSpace(name))
                    ?? group.Key;

                var totalUsd = orderedTransactions.Sum(t => t.TotalUsd);
                var totalLbp = orderedTransactions.Sum(t => t.TotalLbp);
                var paidUsd = orderedTransactions.Sum(t => t.PaidUsd);
                var paidLbp = orderedTransactions.Sum(t => t.PaidLbp);
                var balanceUsd = orderedTransactions.Sum(t => t.BalanceUsd);
                var balanceLbp = orderedTransactions.Sum(t => t.BalanceLbp);
                var createdAt = orderedTransactions.Min(t => t.CreatedAt);
                var lastTransactionAt = orderedTransactions.Max(t => t.CreatedAt);

                return new DebtCardResponse
                {
                    Id = group.Key.ToLowerInvariant(),
                    Name = displayName,
                    TotalUsd = totalUsd,
                    TotalLbp = totalLbp,
                    PaidUsd = paidUsd,
                    PaidLbp = paidLbp,
                    BalanceUsd = balanceUsd,
                    BalanceLbp = balanceLbp,
                    CreatedAt = createdAt,
                    LastTransactionAt = lastTransactionAt,
                    Transactions = orderedTransactions
                        .Select(t => new DebtCardTransactionResponse
                        {
                            Id = t.Id,
                            TransactionNumber = t.TransactionNumber,
                            CreatedAt = t.CreatedAt,
                            TotalUsd = t.TotalUsd,
                            TotalLbp = t.TotalLbp,
                            PaidUsd = t.PaidUsd,
                            PaidLbp = t.PaidLbp,
                            BalanceUsd = t.BalanceUsd,
                            BalanceLbp = t.BalanceLbp,
                            Lines = t.Lines.Select(CheckoutLineResponse.FromEntity).ToList()
                        })
                        .ToList()
                };
            })
            .OrderByDescending(card => card.LastTransactionAt)
            .ToList();

        return Ok(grouped);
    }

    [HttpGet("debt-card-names")]
    public async Task<ActionResult<IEnumerable<string>>> GetDebtCardNames(CancellationToken cancellationToken)
    {
        var names = await _db.Transactions
            .Where(t => t.DebtCardName != null && t.DebtCardName != "")
            .Select(t => new
            {
                Name = t.DebtCardName!.Trim(),
                t.CreatedAt
            })
            .Where(t => t.Name != "")
            .GroupBy(t => t.Name)
            .Select(group => new
            {
                Name = group.Key,
                LastUsed = group.Max(t => t.CreatedAt)
            })
            .OrderByDescending(t => t.LastUsed)
            .Take(100)
            .Select(t => t.Name)
            .ToListAsync(cancellationToken);

        return Ok(names);
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

    [HttpGet("lookup-by-barcode")]
    public async Task<ActionResult<IEnumerable<TransactionLineLookupResponse>>> LookupByBarcode(
        [FromQuery] string? barcode,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(barcode))
        {
            return BadRequest(new { message = "Barcode is required." });
        }

        var normalizedBarcode = barcode.Trim();

        var lines = await _db.TransactionLines
            .AsNoTracking()
            .Include(l => l.Transaction)
            .Include(l => l.Product)
            .Where(l => !l.IsWaste)
            .Where(l => l.Transaction != null && (l.Transaction.Type == TransactionType.Sale || l.Transaction.Type == TransactionType.Return))
            .Where(l => l.Product != null && (l.Product.Barcode == normalizedBarcode || l.Product.AdditionalBarcodes.Any(b => b.Code == normalizedBarcode)))
            .OrderByDescending(l => l.Transaction!.CreatedAt)
            .Take(10)
            .Select(l => new TransactionLineLookupResponse
            {
                TransactionId = l.TransactionId,
                LineId = l.Id,
                ProductId = l.ProductId,
                TransactionNumber = l.Transaction!.TransactionNumber,
                ProductName = l.Product!.Name,
                ProductSku = l.Product!.Sku,
                ProductBarcode = l.Product!.Barcode,
                Quantity = l.Quantity,
                TotalUsd = l.TotalUsd,
                TotalLbp = l.TotalLbp,
                UnitPriceUsd = l.UnitPriceUsd,
                UnitPriceLbp = l.UnitPriceLbp,
                CostUsd = l.CostUsd,
                CostLbp = l.CostLbp,
                ProfitUsd = l.ProfitUsd,
                ProfitLbp = l.ProfitLbp,
                CreatedAt = l.Transaction!.CreatedAt,
                IsWaste = l.IsWaste,
                TransactionType = l.Transaction!.Type.ToString()
            })
            .ToListAsync(cancellationToken);

        return Ok(lines);
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

        var isRefundTransaction = request.IsRefund || transaction.Type == TransactionType.Return;

        var saveToMyCart = allowManualPricing && request.SaveToMyCart && !isRefundTransaction;
        var priceAtCostOnly = saveToMyCart;
        var (computedTotalUsd, _, pricedLines) = await _pricingService.PriceCartAsync(
            request.Items,
            rate,
            allowManualPricing,
            priceAtCostOnly,
            isRefundTransaction,
            cancellationToken);

        var manualTotalsAllowed = allowManualPricing && !saveToMyCart;
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
        transaction.Type = isRefundTransaction ? TransactionType.Return : TransactionType.Sale;

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

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var transaction = await _db.Transactions
            .Include(t => t.Lines)
                .ThenInclude(l => l.Product)
                    .ThenInclude(p => p.Inventory)
            .FirstOrDefaultAsync(t => t.Id == id, cancellationToken);

        if (transaction is null)
        {
            return NotFound();
        }

        foreach (var line in transaction.Lines)
        {
            var inventory = line.Product?.Inventory
                ?? await _db.Inventories.FirstOrDefaultAsync(i => i.ProductId == line.ProductId, cancellationToken);

            if (inventory is not null)
            {
                inventory.QuantityOnHand = Math.Max(0m, inventory.QuantityOnHand + line.Quantity);
            }
        }

        var personalPurchase = await _db.PersonalPurchases
            .FirstOrDefaultAsync(p => p.TransactionId == transaction.Id, cancellationToken);

        if (personalPurchase is not null)
        {
            _db.PersonalPurchases.Remove(personalPurchase);
        }

        _db.TransactionLines.RemoveRange(transaction.Lines);
        _db.Transactions.Remove(transaction);

        await _db.SaveChangesAsync(cancellationToken);

        var currentUserId = User.GetCurrentUserId();
        if (currentUserId.HasValue)
        {
            await _auditLogger.LogAsync(currentUserId.Value, "DeleteTransaction", nameof(PosTransaction), transaction.Id, new
            {
                transaction.TransactionNumber,
                transaction.TotalUsd,
                transaction.TotalLbp
            }, cancellationToken);
        }

        await _eventHub.PublishAsync(new PosEvent("transaction.deleted", new
        {
            transaction.Id,
            transaction.TransactionNumber
        }));

        return NoContent();
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

        var saveToMyCart = allowManualPricing && request.SaveToMyCart && !request.IsRefund;
        var priceAtCostOnly = saveToMyCart;
        var (computedTotalUsd, _, lines) = await _pricingService.PriceCartAsync(
            request.Items,
            currentRate,
            allowManualPricing,
            priceAtCostOnly,
            request.IsRefund,
            cancellationToken);

        var manualTotalsAllowed = allowManualPricing && !saveToMyCart;
        var (effectiveTotalUsd, totalLbpOverride, hasManualTotalOverride) = manualTotalsAllowed
            ? ResolveManualTotals(
                computedTotalUsd,
                currentRate,
                allowManualPricing,
                request.ManualTotalUsd,
                request.ManualTotalLbp)
            : (computedTotalUsd, (decimal?)null, false);

        var balance = _currencyService.ComputeBalance(effectiveTotalUsd, request.PaidUsd, request.PaidLbp, currentRate, totalLbpOverride);

        var trimmedDebtName = string.IsNullOrWhiteSpace(request.DebtCardName)
            ? null
            : request.DebtCardName.Trim();

        if ((balance.balanceUsd > 0 || balance.balanceLbp > 0) && string.IsNullOrWhiteSpace(trimmedDebtName))
        {
            return BadRequest(new { message = "Debt card name is required when a balance remains." });
        }

        if (balance.balanceUsd <= 0 && balance.balanceLbp <= 0)
        {
            trimmedDebtName = null;
        }

        var transaction = new PosTransaction
        {
            TransactionNumber = request.IsRefund
                ? $"RT-{DateTime.UtcNow:yyyyMMddHHmmssfff}"
                : $"TX-{DateTime.UtcNow:yyyyMMddHHmmssfff}",
            Type = request.IsRefund ? TransactionType.Return : TransactionType.Sale,
            UserId = userId.Value,
            TotalUsd = balance.totalUsd,
            TotalLbp = balance.totalLbp,
            PaidUsd = _currencyService.RoundUsd(request.PaidUsd),
            PaidLbp = _currencyService.RoundLbp(request.PaidLbp),
            ExchangeRateUsed = currentRate,
            BalanceUsd = balance.balanceUsd,
            BalanceLbp = balance.balanceLbp,
            HasManualTotalOverride = hasManualTotalOverride,
            DebtCardName = trimmedDebtName
        };

        foreach (var line in lines)
        {
            transaction.Lines.Add(line);
        }

        var visionFlags = new List<string>();
        if (_visionEnabled && !request.IsRefund)
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

            if (saveToMyCart)
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

            var eventName = request.IsRefund ? "transaction.return" : "transaction.completed";
            await _eventHub.PublishAsync(new PosEvent(eventName, new
            {
                transaction.Id,
                transaction.TransactionNumber,
                transaction.TotalUsd,
                transaction.TotalLbp
            }));

            var auditAction = request.IsRefund ? "Return" : "Checkout";
            await _auditLogger.LogAsync(userId.Value, auditAction, nameof(PosTransaction), transaction.Id, new
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
            HasManualTotalOverride = transaction.HasManualTotalOverride,
            DebtCardName = transaction.DebtCardName,
            DebtSettledAt = transaction.DebtSettledAt
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
            ReceiptPdfBase64 = Convert.ToBase64String(receiptBytes),
            DebtCardName = transaction.DebtCardName,
            DebtSettledAt = transaction.DebtSettledAt
        };
    }

    [HttpPost("{id:guid}/settle-debt")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<ActionResult<TransactionResponse>> SettleDebt(Guid id, [FromBody] SettleDebtRequest request, CancellationToken cancellationToken)
    {
        var transaction = await _db.Transactions
            .Include(t => t.User)
            .FirstOrDefaultAsync(t => t.Id == id, cancellationToken);

        if (transaction is null)
        {
            return NotFound();
        }

        if (string.IsNullOrWhiteSpace(transaction.DebtCardName) || transaction.DebtSettledAt != null)
        {
            return BadRequest(new { message = "Transaction is not an outstanding debt." });
        }

        if (transaction.BalanceUsd <= 0 && transaction.BalanceLbp <= 0)
        {
            transaction.DebtSettledAt = transaction.DebtSettledAt ?? DateTime.UtcNow;
            await _db.SaveChangesAsync(cancellationToken);
            return ToResponse(transaction);
        }

        var additionalUsd = request.PaidUsd > 0 ? request.PaidUsd : 0m;
        var additionalLbp = request.PaidLbp > 0 ? request.PaidLbp : 0m;

        if (additionalUsd == 0m && additionalLbp == 0m)
        {
            additionalUsd = transaction.BalanceUsd > 0 ? transaction.BalanceUsd : 0m;
            additionalLbp = transaction.BalanceLbp > 0 ? transaction.BalanceLbp : 0m;
        }

        transaction.PaidUsd = _currencyService.RoundUsd(transaction.PaidUsd + additionalUsd);
        transaction.PaidLbp = _currencyService.RoundLbp(transaction.PaidLbp + additionalLbp);

        var manualTotalLbp = transaction.HasManualTotalOverride ? transaction.TotalLbp : (decimal?)null;
        var balance = _currencyService.ComputeBalance(transaction.TotalUsd, transaction.PaidUsd, transaction.PaidLbp, transaction.ExchangeRateUsed, manualTotalLbp);
        transaction.BalanceUsd = balance.balanceUsd;
        transaction.BalanceLbp = balance.balanceLbp;
        transaction.UpdatedAt = DateTime.UtcNow;

        var isSettled = transaction.BalanceUsd <= 0.01m && transaction.BalanceLbp <= 100m;

        if (isSettled)
        {
            transaction.BalanceUsd = 0;
            transaction.BalanceLbp = 0;
            transaction.DebtSettledAt = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync(cancellationToken);

        var currentUserId = User.GetCurrentUserId();
        if (currentUserId.HasValue)
        {
            await _auditLogger.LogAsync(currentUserId.Value, "SettleDebt", nameof(PosTransaction), transaction.Id, new
            {
                transaction.TransactionNumber,
                transaction.DebtCardName,
                transaction.PaidUsd,
                transaction.PaidLbp,
                transaction.BalanceUsd,
                transaction.BalanceLbp
            }, cancellationToken);
        }

        if (isSettled)
        {
            await _eventHub.PublishAsync(new PosEvent("transaction.debt.settled", new
            {
                transaction.Id,
                transaction.TransactionNumber,
                transaction.DebtCardName
            }));
        }

        return ToResponse(transaction);
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

    [HttpPost("price")]
    public async Task<ActionResult<PriceCartResponse>> PriceCart([FromBody] PriceCartRequest request, CancellationToken cancellationToken)
    {
        var allowManualPricing = User.IsInRole("Admin");
        var exchangeRate = request.ExchangeRate > 0
            ? request.ExchangeRate
            : (await _currencyService.GetCurrentRateAsync(cancellationToken)).Rate;

        var saveToMyCart = allowManualPricing && request.SaveToMyCart && !request.IsRefund;
        var priceAtCostOnly = saveToMyCart;
        var items = request.Items?.ToList() ?? new List<CartItemRequest>();

        var (totalUsd, totalLbp, lines) = await _pricingService.PriceCartAsync(
            items,
            exchangeRate,
            allowManualPricing,
            priceAtCostOnly,
            request.IsRefund,
            cancellationToken);

        var response = new PriceCartResponse
        {
            TotalUsd = totalUsd,
            TotalLbp = totalLbp,
            Lines = lines.Select(CheckoutLineResponse.FromEntity).ToList()
        };

        return Ok(response);
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
            DebtCardName = transaction.DebtCardName,
            DebtSettledAt = transaction.DebtSettledAt,
            Lines = transaction.Lines.Select(CheckoutLineResponse.FromEntity).ToList()
        };
    }
}

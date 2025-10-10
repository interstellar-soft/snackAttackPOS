using System.Globalization;
using Microsoft.EntityFrameworkCore;
using PosBackend.Application.Responses;
using PosBackend.Domain.Entities;
using PosBackend.Infrastructure.Data;

namespace PosBackend.Application.Services;

public class BackupService
{
    private readonly ApplicationDbContext _db;

    public BackupService(ApplicationDbContext db)
    {
        _db = db;
    }

    public async Task<DatabaseBackup> ExportAsync(CancellationToken cancellationToken = default)
    {
        var backup = new DatabaseBackup
        {
            GeneratedAt = DateTime.UtcNow,
            Users = await _db.Users
                .AsNoTracking()
                .OrderBy(u => u.Username)
                .Select(u => new UserBackup
                {
                    Id = u.Id,
                    CreatedAt = u.CreatedAt,
                    UpdatedAt = u.UpdatedAt,
                    Username = u.Username,
                    DisplayName = u.DisplayName,
                    PasswordHash = u.PasswordHash,
                    Role = u.Role
                })
                .ToListAsync(cancellationToken),
            Categories = await _db.Categories
                .AsNoTracking()
                .OrderBy(c => c.Name)
                .Select(c => new CategoryBackup
                {
                    Id = c.Id,
                    CreatedAt = c.CreatedAt,
                    UpdatedAt = c.UpdatedAt,
                    Name = c.Name
                })
                .ToListAsync(cancellationToken),
            Products = await _db.Products
                .AsNoTracking()
                .OrderBy(p => p.Name)
                .Select(p => new ProductBackup
                {
                    Id = p.Id,
                    CreatedAt = p.CreatedAt,
                    UpdatedAt = p.UpdatedAt,
                    Sku = p.Sku,
                    Name = p.Name,
                    Description = p.Description,
                    Barcode = p.Barcode,
                    CategoryId = p.CategoryId,
                    PriceUsd = p.PriceUsd,
                    PriceLbp = p.PriceLbp,
                    IsActive = p.IsActive,
                    IsPinned = p.IsPinned
                })
                .ToListAsync(cancellationToken),
            Inventories = await _db.Inventories
                .AsNoTracking()
                .OrderBy(i => i.ProductId)
                .Select(i => new InventoryBackup
                {
                    Id = i.Id,
                    CreatedAt = i.CreatedAt,
                    UpdatedAt = i.UpdatedAt,
                    ProductId = i.ProductId,
                    QuantityOnHand = i.QuantityOnHand,
                    ReorderPoint = i.ReorderPoint,
                    ReorderQuantity = i.ReorderQuantity,
                    AverageCostUsd = i.AverageCostUsd,
                    AverageCostLbp = i.AverageCostLbp,
                    LastRestockedAt = i.LastRestockedAt,
                    IsReorderAlarmEnabled = i.IsReorderAlarmEnabled
                })
                .ToListAsync(cancellationToken),
            ExpirationBatches = await _db.ExpirationBatches
                .AsNoTracking()
                .OrderBy(b => b.ProductId)
                .Select(b => new ExpirationBatchBackup
                {
                    Id = b.Id,
                    CreatedAt = b.CreatedAt,
                    UpdatedAt = b.UpdatedAt,
                    ProductId = b.ProductId,
                    BatchCode = b.BatchCode,
                    ExpirationDate = b.ExpirationDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                    Quantity = b.Quantity
                })
                .ToListAsync(cancellationToken),
            PriceRules = await _db.PriceRules
                .AsNoTracking()
                .OrderBy(r => r.ProductId)
                .Select(r => new PriceRuleBackup
                {
                    Id = r.Id,
                    CreatedAt = r.CreatedAt,
                    UpdatedAt = r.UpdatedAt,
                    ProductId = r.ProductId,
                    RuleType = r.RuleType,
                    DiscountPercent = r.DiscountPercent,
                    StartDate = r.StartDate,
                    EndDate = r.EndDate,
                    Description = r.Description,
                    IsActive = r.IsActive
                })
                .ToListAsync(cancellationToken),
            Offers = await _db.Offers
                .AsNoTracking()
                .OrderBy(o => o.Name)
                .Select(o => new OfferBackup
                {
                    Id = o.Id,
                    CreatedAt = o.CreatedAt,
                    UpdatedAt = o.UpdatedAt,
                    Name = o.Name,
                    Description = o.Description,
                    PriceUsd = o.PriceUsd,
                    PriceLbp = o.PriceLbp,
                    IsActive = o.IsActive
                })
                .ToListAsync(cancellationToken),
            OfferItems = await _db.OfferItems
                .AsNoTracking()
                .OrderBy(i => i.OfferId)
                .Select(i => new OfferItemBackup
                {
                    Id = i.Id,
                    CreatedAt = i.CreatedAt,
                    UpdatedAt = i.UpdatedAt,
                    OfferId = i.OfferId,
                    ProductId = i.ProductId,
                    Quantity = i.Quantity
                })
                .ToListAsync(cancellationToken),
            Suppliers = await _db.Suppliers
                .AsNoTracking()
                .OrderBy(s => s.Name)
                .Select(s => new SupplierBackup
                {
                    Id = s.Id,
                    CreatedAt = s.CreatedAt,
                    UpdatedAt = s.UpdatedAt,
                    Name = s.Name,
                    ContactEmail = s.ContactEmail,
                    ContactPhone = s.ContactPhone
                })
                .ToListAsync(cancellationToken),
            PurchaseOrders = await _db.PurchaseOrders
                .AsNoTracking()
                .OrderBy(p => p.CreatedAt)
                .Select(p => new PurchaseOrderBackup
                {
                    Id = p.Id,
                    CreatedAt = p.CreatedAt,
                    UpdatedAt = p.UpdatedAt,
                    SupplierId = p.SupplierId,
                    OrderedAt = p.OrderedAt,
                    ExpectedAt = p.ExpectedAt,
                    Status = p.Status,
                    Reference = p.Reference,
                    TotalCostUsd = p.TotalCostUsd,
                    TotalCostLbp = p.TotalCostLbp,
                    ExchangeRateUsed = p.ExchangeRateUsed,
                    ReceivedAt = p.ReceivedAt,
                    CreatedByUserId = p.CreatedByUserId
                })
                .ToListAsync(cancellationToken),
            PurchaseOrderLines = await _db.PurchaseOrderLines
                .AsNoTracking()
                .OrderBy(l => l.PurchaseOrderId)
                .Select(l => new PurchaseOrderLineBackup
                {
                    Id = l.Id,
                    CreatedAt = l.CreatedAt,
                    UpdatedAt = l.UpdatedAt,
                    PurchaseOrderId = l.PurchaseOrderId,
                    ProductId = l.ProductId,
                    Barcode = l.Barcode,
                    Quantity = l.Quantity,
                    UnitCostUsd = l.UnitCostUsd,
                    UnitCostLbp = l.UnitCostLbp,
                    TotalCostUsd = l.TotalCostUsd,
                    TotalCostLbp = l.TotalCostLbp
                })
                .ToListAsync(cancellationToken),
            Transactions = await _db.Transactions
                .AsNoTracking()
                .OrderBy(t => t.CreatedAt)
                .Select(t => new PosTransactionBackup
                {
                    Id = t.Id,
                    CreatedAt = t.CreatedAt,
                    UpdatedAt = t.UpdatedAt,
                    TransactionNumber = t.TransactionNumber,
                    Type = t.Type,
                    UserId = t.UserId,
                    ExchangeRateUsed = t.ExchangeRateUsed,
                    TotalUsd = t.TotalUsd,
                    TotalLbp = t.TotalLbp,
                    PaidUsd = t.PaidUsd,
                    PaidLbp = t.PaidLbp,
                    BalanceUsd = t.BalanceUsd,
                    BalanceLbp = t.BalanceLbp,
                    ReceiptHtml = t.ReceiptHtml
                })
                .ToListAsync(cancellationToken),
            TransactionLines = await _db.TransactionLines
                .AsNoTracking()
                .OrderBy(l => l.TransactionId)
                .Select(l => new TransactionLineBackup
                {
                    Id = l.Id,
                    CreatedAt = l.CreatedAt,
                    UpdatedAt = l.UpdatedAt,
                    TransactionId = l.TransactionId,
                    ProductId = l.ProductId,
                    PriceRuleId = l.PriceRuleId,
                    OfferId = l.OfferId,
                    Quantity = l.Quantity,
                    BaseUnitPriceUsd = l.BaseUnitPriceUsd,
                    BaseUnitPriceLbp = l.BaseUnitPriceLbp,
                    UnitPriceUsd = l.UnitPriceUsd,
                    UnitPriceLbp = l.UnitPriceLbp,
                    DiscountPercent = l.DiscountPercent,
                    TotalUsd = l.TotalUsd,
                    TotalLbp = l.TotalLbp,
                    CostUsd = l.CostUsd,
                    CostLbp = l.CostLbp,
                    ProfitUsd = l.ProfitUsd,
                    ProfitLbp = l.ProfitLbp,
                    IsWaste = l.IsWaste
                })
                .ToListAsync(cancellationToken),
            CurrencyRates = await _db.CurrencyRates
                .AsNoTracking()
                .OrderBy(c => c.CreatedAt)
                .Select(c => new CurrencyRateBackup
                {
                    Id = c.Id,
                    CreatedAt = c.CreatedAt,
                    UpdatedAt = c.UpdatedAt,
                    BaseCurrency = c.BaseCurrency,
                    QuoteCurrency = c.QuoteCurrency,
                    Rate = c.Rate,
                    Notes = c.Notes,
                    UserId = c.UserId
                })
                .ToListAsync(cancellationToken),
            StoreProfiles = await _db.StoreProfiles
                .AsNoTracking()
                .OrderBy(s => s.CreatedAt)
                .Select(s => new StoreProfileBackup
                {
                    Id = s.Id,
                    CreatedAt = s.CreatedAt,
                    UpdatedAt = s.UpdatedAt,
                    Name = s.Name
                })
                .ToListAsync(cancellationToken),
            AuditLogs = await _db.AuditLogs
                .AsNoTracking()
                .OrderBy(a => a.CreatedAt)
                .Select(a => new AuditLogBackup
                {
                    Id = a.Id,
                    CreatedAt = a.CreatedAt,
                    UpdatedAt = a.UpdatedAt,
                    UserId = a.UserId,
                    Action = a.Action,
                    Entity = a.Entity,
                    EntityId = a.EntityId,
                    Data = a.Data,
                    IpAddress = a.IpAddress
                })
                .ToListAsync(cancellationToken)
        };

        return backup;
    }

    public async Task<BackupImportResult> ImportAsync(DatabaseBackup backup, CancellationToken cancellationToken = default)
    {
        if (backup.SchemaVersion != DatabaseBackup.CurrentSchemaVersion)
        {
            throw new InvalidOperationException($"Unsupported backup schema version {backup.SchemaVersion}. Expected {DatabaseBackup.CurrentSchemaVersion}.");
        }

        await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);

        await _db.TransactionLines.ExecuteDeleteAsync(cancellationToken);
        await _db.Transactions.ExecuteDeleteAsync(cancellationToken);
        await _db.OfferItems.ExecuteDeleteAsync(cancellationToken);
        await _db.Offers.ExecuteDeleteAsync(cancellationToken);
        await _db.PurchaseOrderLines.ExecuteDeleteAsync(cancellationToken);
        await _db.PurchaseOrders.ExecuteDeleteAsync(cancellationToken);
        await _db.PriceRules.ExecuteDeleteAsync(cancellationToken);
        await _db.ExpirationBatches.ExecuteDeleteAsync(cancellationToken);
        await _db.Inventories.ExecuteDeleteAsync(cancellationToken);
        await _db.Products.ExecuteDeleteAsync(cancellationToken);
        await _db.Categories.ExecuteDeleteAsync(cancellationToken);
        await _db.CurrencyRates.ExecuteDeleteAsync(cancellationToken);
        await _db.StoreProfiles.ExecuteDeleteAsync(cancellationToken);
        await _db.AuditLogs.ExecuteDeleteAsync(cancellationToken);
        await _db.Users.ExecuteDeleteAsync(cancellationToken);
        await _db.Suppliers.ExecuteDeleteAsync(cancellationToken);

        _db.ChangeTracker.Clear();

        var counts = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);

        var users = (backup.Users ?? new List<UserBackup>()).Select(u => new User
        {
            Id = u.Id,
            CreatedAt = u.CreatedAt,
            UpdatedAt = u.UpdatedAt,
            Username = u.Username,
            DisplayName = u.DisplayName,
            PasswordHash = u.PasswordHash,
            Role = u.Role
        }).ToList();
        if (users.Count > 0)
        {
            await _db.Users.AddRangeAsync(users, cancellationToken);
        }
        counts["users"] = users.Count;

        var categories = (backup.Categories ?? new List<CategoryBackup>()).Select(c => new Category
        {
            Id = c.Id,
            CreatedAt = c.CreatedAt,
            UpdatedAt = c.UpdatedAt,
            Name = c.Name
        }).ToList();
        if (categories.Count > 0)
        {
            await _db.Categories.AddRangeAsync(categories, cancellationToken);
        }
        counts["categories"] = categories.Count;

        var products = (backup.Products ?? new List<ProductBackup>()).Select(p => new Product
        {
            Id = p.Id,
            CreatedAt = p.CreatedAt,
            UpdatedAt = p.UpdatedAt,
            Sku = p.Sku,
            Name = p.Name,
            Description = p.Description,
            Barcode = p.Barcode,
            CategoryId = p.CategoryId,
            PriceUsd = p.PriceUsd,
            PriceLbp = p.PriceLbp,
            IsActive = p.IsActive,
            IsPinned = p.IsPinned
        }).ToList();
        if (products.Count > 0)
        {
            await _db.Products.AddRangeAsync(products, cancellationToken);
        }
        counts["products"] = products.Count;

        var inventories = (backup.Inventories ?? new List<InventoryBackup>()).Select(i => new Inventory
        {
            Id = i.Id,
            CreatedAt = i.CreatedAt,
            UpdatedAt = i.UpdatedAt,
            ProductId = i.ProductId,
            QuantityOnHand = i.QuantityOnHand,
            ReorderPoint = i.ReorderPoint,
            ReorderQuantity = i.ReorderQuantity,
            AverageCostUsd = i.AverageCostUsd,
            AverageCostLbp = i.AverageCostLbp,
            LastRestockedAt = i.LastRestockedAt,
            IsReorderAlarmEnabled = i.IsReorderAlarmEnabled
        }).ToList();
        if (inventories.Count > 0)
        {
            await _db.Inventories.AddRangeAsync(inventories, cancellationToken);
        }
        counts["inventories"] = inventories.Count;

        var expirationBatches = (backup.ExpirationBatches ?? new List<ExpirationBatchBackup>()).Select(b => new ExpirationBatch
        {
            Id = b.Id,
            CreatedAt = b.CreatedAt,
            UpdatedAt = b.UpdatedAt,
            ProductId = b.ProductId,
            BatchCode = b.BatchCode,
            ExpirationDate = DateOnly.ParseExact(b.ExpirationDate, "yyyy-MM-dd", CultureInfo.InvariantCulture),
            Quantity = b.Quantity
        }).ToList();
        if (expirationBatches.Count > 0)
        {
            await _db.ExpirationBatches.AddRangeAsync(expirationBatches, cancellationToken);
        }
        counts["expirationBatches"] = expirationBatches.Count;

        var priceRules = (backup.PriceRules ?? new List<PriceRuleBackup>()).Select(r => new PriceRule
        {
            Id = r.Id,
            CreatedAt = r.CreatedAt,
            UpdatedAt = r.UpdatedAt,
            ProductId = r.ProductId,
            RuleType = r.RuleType,
            DiscountPercent = r.DiscountPercent,
            StartDate = r.StartDate,
            EndDate = r.EndDate,
            Description = r.Description,
            IsActive = r.IsActive
        }).ToList();
        if (priceRules.Count > 0)
        {
            await _db.PriceRules.AddRangeAsync(priceRules, cancellationToken);
        }
        counts["priceRules"] = priceRules.Count;

        var offers = (backup.Offers ?? new List<OfferBackup>()).Select(o => new Offer
        {
            Id = o.Id,
            CreatedAt = o.CreatedAt,
            UpdatedAt = o.UpdatedAt,
            Name = o.Name,
            Description = o.Description,
            PriceUsd = o.PriceUsd,
            PriceLbp = o.PriceLbp,
            IsActive = o.IsActive
        }).ToList();
        if (offers.Count > 0)
        {
            await _db.Offers.AddRangeAsync(offers, cancellationToken);
        }
        counts["offers"] = offers.Count;

        var offerItems = (backup.OfferItems ?? new List<OfferItemBackup>()).Select(i => new OfferItem
        {
            Id = i.Id,
            CreatedAt = i.CreatedAt,
            UpdatedAt = i.UpdatedAt,
            OfferId = i.OfferId,
            ProductId = i.ProductId,
            Quantity = i.Quantity
        }).ToList();
        if (offerItems.Count > 0)
        {
            await _db.OfferItems.AddRangeAsync(offerItems, cancellationToken);
        }
        counts["offerItems"] = offerItems.Count;

        var suppliers = (backup.Suppliers ?? new List<SupplierBackup>()).Select(s => new Supplier
        {
            Id = s.Id,
            CreatedAt = s.CreatedAt,
            UpdatedAt = s.UpdatedAt,
            Name = s.Name,
            ContactEmail = s.ContactEmail,
            ContactPhone = s.ContactPhone
        }).ToList();
        if (suppliers.Count > 0)
        {
            await _db.Suppliers.AddRangeAsync(suppliers, cancellationToken);
        }
        counts["suppliers"] = suppliers.Count;

        var purchaseOrders = (backup.PurchaseOrders ?? new List<PurchaseOrderBackup>()).Select(p => new PurchaseOrder
        {
            Id = p.Id,
            CreatedAt = p.CreatedAt,
            UpdatedAt = p.UpdatedAt,
            SupplierId = p.SupplierId,
            OrderedAt = p.OrderedAt,
            ExpectedAt = p.ExpectedAt,
            Status = p.Status,
            Reference = p.Reference,
            TotalCostUsd = p.TotalCostUsd,
            TotalCostLbp = p.TotalCostLbp,
            ExchangeRateUsed = p.ExchangeRateUsed,
            ReceivedAt = p.ReceivedAt,
            CreatedByUserId = p.CreatedByUserId
        }).ToList();
        if (purchaseOrders.Count > 0)
        {
            await _db.PurchaseOrders.AddRangeAsync(purchaseOrders, cancellationToken);
        }
        counts["purchaseOrders"] = purchaseOrders.Count;

        var purchaseOrderLines = (backup.PurchaseOrderLines ?? new List<PurchaseOrderLineBackup>()).Select(l => new PurchaseOrderLine
        {
            Id = l.Id,
            CreatedAt = l.CreatedAt,
            UpdatedAt = l.UpdatedAt,
            PurchaseOrderId = l.PurchaseOrderId,
            ProductId = l.ProductId,
            Barcode = l.Barcode,
            Quantity = l.Quantity,
            UnitCostUsd = l.UnitCostUsd,
            UnitCostLbp = l.UnitCostLbp,
            TotalCostUsd = l.TotalCostUsd,
            TotalCostLbp = l.TotalCostLbp
        }).ToList();
        if (purchaseOrderLines.Count > 0)
        {
            await _db.PurchaseOrderLines.AddRangeAsync(purchaseOrderLines, cancellationToken);
        }
        counts["purchaseOrderLines"] = purchaseOrderLines.Count;

        var transactions = (backup.Transactions ?? new List<PosTransactionBackup>()).Select(t => new PosTransaction
        {
            Id = t.Id,
            CreatedAt = t.CreatedAt,
            UpdatedAt = t.UpdatedAt,
            TransactionNumber = t.TransactionNumber,
            Type = t.Type,
            UserId = t.UserId,
            ExchangeRateUsed = t.ExchangeRateUsed,
            TotalUsd = t.TotalUsd,
            TotalLbp = t.TotalLbp,
            PaidUsd = t.PaidUsd,
            PaidLbp = t.PaidLbp,
            BalanceUsd = t.BalanceUsd,
            BalanceLbp = t.BalanceLbp,
            ReceiptHtml = t.ReceiptHtml
        }).ToList();
        if (transactions.Count > 0)
        {
            await _db.Transactions.AddRangeAsync(transactions, cancellationToken);
        }
        counts["transactions"] = transactions.Count;

        var transactionLines = (backup.TransactionLines ?? new List<TransactionLineBackup>()).Select(l => new TransactionLine
        {
            Id = l.Id,
            CreatedAt = l.CreatedAt,
            UpdatedAt = l.UpdatedAt,
            TransactionId = l.TransactionId,
            ProductId = l.ProductId,
            PriceRuleId = l.PriceRuleId,
            OfferId = l.OfferId,
            Quantity = l.Quantity,
            BaseUnitPriceUsd = l.BaseUnitPriceUsd,
            BaseUnitPriceLbp = l.BaseUnitPriceLbp,
            UnitPriceUsd = l.UnitPriceUsd,
            UnitPriceLbp = l.UnitPriceLbp,
            DiscountPercent = l.DiscountPercent,
            TotalUsd = l.TotalUsd,
            TotalLbp = l.TotalLbp,
            CostUsd = l.CostUsd,
            CostLbp = l.CostLbp,
            ProfitUsd = l.ProfitUsd,
            ProfitLbp = l.ProfitLbp,
            IsWaste = l.IsWaste
        }).ToList();
        if (transactionLines.Count > 0)
        {
            await _db.TransactionLines.AddRangeAsync(transactionLines, cancellationToken);
        }
        counts["transactionLines"] = transactionLines.Count;

        var currencyRates = (backup.CurrencyRates ?? new List<CurrencyRateBackup>()).Select(c => new CurrencyRate
        {
            Id = c.Id,
            CreatedAt = c.CreatedAt,
            UpdatedAt = c.UpdatedAt,
            BaseCurrency = c.BaseCurrency,
            QuoteCurrency = c.QuoteCurrency,
            Rate = c.Rate,
            Notes = c.Notes,
            UserId = c.UserId
        }).ToList();
        if (currencyRates.Count > 0)
        {
            await _db.CurrencyRates.AddRangeAsync(currencyRates, cancellationToken);
        }
        counts["currencyRates"] = currencyRates.Count;

        var storeProfiles = (backup.StoreProfiles ?? new List<StoreProfileBackup>()).Select(s => new StoreProfile
        {
            Id = s.Id,
            CreatedAt = s.CreatedAt,
            UpdatedAt = s.UpdatedAt,
            Name = s.Name
        }).ToList();
        if (storeProfiles.Count > 0)
        {
            await _db.StoreProfiles.AddRangeAsync(storeProfiles, cancellationToken);
        }
        counts["storeProfiles"] = storeProfiles.Count;

        var auditLogs = (backup.AuditLogs ?? new List<AuditLogBackup>()).Select(a => new AuditLog
        {
            Id = a.Id,
            CreatedAt = a.CreatedAt,
            UpdatedAt = a.UpdatedAt,
            UserId = a.UserId,
            Action = a.Action,
            Entity = a.Entity,
            EntityId = a.EntityId,
            Data = a.Data,
            IpAddress = a.IpAddress
        }).ToList();
        if (auditLogs.Count > 0)
        {
            await _db.AuditLogs.AddRangeAsync(auditLogs, cancellationToken);
        }
        counts["auditLogs"] = auditLogs.Count;

        await _db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return new BackupImportResult
        {
            ImportedAt = DateTime.UtcNow,
            RecordsImported = counts
        };
    }
}

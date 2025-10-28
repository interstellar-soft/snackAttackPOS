using PosBackend.Domain.Entities;

namespace PosBackend.Application.Responses;

public class DatabaseBackup
{
    public const int CurrentSchemaVersion = 1;

    public int SchemaVersion { get; set; } = CurrentSchemaVersion;
    public DateTime GeneratedAt { get; set; } = DateTime.UtcNow;

    public List<UserBackup> Users { get; set; } = new();
    public List<CategoryBackup> Categories { get; set; } = new();
    public List<ProductBackup> Products { get; set; } = new();
    public List<InventoryBackup> Inventories { get; set; } = new();
    public List<ExpirationBatchBackup> ExpirationBatches { get; set; } = new();
    public List<PriceRuleBackup> PriceRules { get; set; } = new();
    public List<OfferBackup> Offers { get; set; } = new();
    public List<OfferItemBackup> OfferItems { get; set; } = new();
    public List<SupplierBackup> Suppliers { get; set; } = new();
    public List<PurchaseOrderBackup> PurchaseOrders { get; set; } = new();
    public List<PurchaseOrderLineBackup> PurchaseOrderLines { get; set; } = new();
    public List<PosTransactionBackup> Transactions { get; set; } = new();
    public List<TransactionLineBackup> TransactionLines { get; set; } = new();
    public List<CurrencyRateBackup> CurrencyRates { get; set; } = new();
    public List<StoreProfileBackup> StoreProfiles { get; set; } = new();
    public List<AuditLogBackup> AuditLogs { get; set; } = new();
}

public abstract class BackupEntityBase
{
    public Guid Id { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}

public class UserBackup : BackupEntityBase
{
    public string Username { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public UserRole Role { get; set; }
}

public class CategoryBackup : BackupEntityBase
{
    public string Name { get; set; } = string.Empty;
}

public class ProductBackup : BackupEntityBase
{
    public string? Sku { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Barcode { get; set; } = string.Empty;
    public Guid CategoryId { get; set; }
    public decimal PriceUsd { get; set; }
    public decimal PriceLbp { get; set; }
    public bool IsActive { get; set; }
    public bool IsPinned { get; set; }
}

public class InventoryBackup : BackupEntityBase
{
    public Guid ProductId { get; set; }
    public decimal QuantityOnHand { get; set; }
    public decimal ReorderPoint { get; set; }
    public decimal ReorderQuantity { get; set; }
    public decimal AverageCostUsd { get; set; }
    public decimal AverageCostLbp { get; set; }
    public DateTimeOffset? LastRestockedAt { get; set; }
    public bool IsReorderAlarmEnabled { get; set; }
}

public class ExpirationBatchBackup : BackupEntityBase
{
    public Guid ProductId { get; set; }
    public string BatchCode { get; set; } = string.Empty;
    public string ExpirationDate { get; set; } = string.Empty;
    public decimal Quantity { get; set; }
}

public class PriceRuleBackup : BackupEntityBase
{
    public Guid ProductId { get; set; }
    public PriceRuleType RuleType { get; set; }
    public decimal DiscountPercent { get; set; }
    public DateTimeOffset StartDate { get; set; }
    public DateTimeOffset? EndDate { get; set; }
    public string? Description { get; set; }
    public bool IsActive { get; set; }
}

public class OfferBackup : BackupEntityBase
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public decimal PriceUsd { get; set; }
    public decimal PriceLbp { get; set; }
    public bool IsActive { get; set; }
}

public class OfferItemBackup : BackupEntityBase
{
    public Guid OfferId { get; set; }
    public Guid ProductId { get; set; }
    public decimal Quantity { get; set; }
}

public class SupplierBackup : BackupEntityBase
{
    public string Name { get; set; } = string.Empty;
    public string? ContactEmail { get; set; }
    public string? ContactPhone { get; set; }
}

public class PurchaseOrderBackup : BackupEntityBase
{
    public Guid SupplierId { get; set; }
    public DateTimeOffset OrderedAt { get; set; }
    public DateTimeOffset? ExpectedAt { get; set; }
    public PurchaseOrderStatus Status { get; set; }
    public string? Reference { get; set; }
    public decimal TotalCostUsd { get; set; }
    public decimal TotalCostLbp { get; set; }
    public decimal ExchangeRateUsed { get; set; }
    public DateTimeOffset? ReceivedAt { get; set; }
    public Guid? CreatedByUserId { get; set; }
}

public class PurchaseOrderLineBackup : BackupEntityBase
{
    public Guid PurchaseOrderId { get; set; }
    public Guid ProductId { get; set; }
    public string Barcode { get; set; } = string.Empty;
    public decimal Quantity { get; set; }
    public decimal UnitCostUsd { get; set; }
    public decimal UnitCostLbp { get; set; }
    public decimal TotalCostUsd { get; set; }
    public decimal TotalCostLbp { get; set; }
    public string Currency { get; set; } = "USD";
}

public class PosTransactionBackup : BackupEntityBase
{
    public string TransactionNumber { get; set; } = string.Empty;
    public TransactionType Type { get; set; }
    public Guid UserId { get; set; }
    public decimal ExchangeRateUsed { get; set; }
    public decimal TotalUsd { get; set; }
    public decimal TotalLbp { get; set; }
    public decimal PaidUsd { get; set; }
    public decimal PaidLbp { get; set; }
    public decimal BalanceUsd { get; set; }
    public decimal BalanceLbp { get; set; }
    public string? ReceiptHtml { get; set; }
}

public class TransactionLineBackup : BackupEntityBase
{
    public Guid TransactionId { get; set; }
    public Guid ProductId { get; set; }
    public Guid? PriceRuleId { get; set; }
    public Guid? OfferId { get; set; }
    public decimal Quantity { get; set; }
    public decimal BaseUnitPriceUsd { get; set; }
    public decimal BaseUnitPriceLbp { get; set; }
    public decimal UnitPriceUsd { get; set; }
    public decimal UnitPriceLbp { get; set; }
    public decimal DiscountPercent { get; set; }
    public decimal TotalUsd { get; set; }
    public decimal TotalLbp { get; set; }
    public decimal CostUsd { get; set; }
    public decimal CostLbp { get; set; }
    public decimal ProfitUsd { get; set; }
    public decimal ProfitLbp { get; set; }
    public bool IsWaste { get; set; }
}

public class CurrencyRateBackup : BackupEntityBase
{
    public string BaseCurrency { get; set; } = "USD";
    public string QuoteCurrency { get; set; } = "LBP";
    public decimal Rate { get; set; }
    public string? Notes { get; set; }
    public Guid? UserId { get; set; }
}

public class StoreProfileBackup : BackupEntityBase
{
    public string Name { get; set; } = string.Empty;
}

public class AuditLogBackup : BackupEntityBase
{
    public Guid UserId { get; set; }
    public string Action { get; set; } = string.Empty;
    public string Entity { get; set; } = string.Empty;
    public Guid? EntityId { get; set; }
    public string Data { get; set; } = string.Empty;
    public string? IpAddress { get; set; }
}

public class BackupImportResult
{
    public DateTime ImportedAt { get; set; } = DateTime.UtcNow;
    public IDictionary<string, int> RecordsImported { get; set; } = new Dictionary<string, int>();
}

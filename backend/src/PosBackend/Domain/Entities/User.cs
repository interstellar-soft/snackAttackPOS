namespace PosBackend.Domain.Entities;

public enum UserRole
{
    Admin = 1,
    Manager = 2,
    Cashier = 3
}

public class User : BaseEntity
{
    public string Username { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public UserRole Role { get; set; } = UserRole.Cashier;
    public ICollection<PosTransaction> Transactions { get; set; } = new List<PosTransaction>();
    public ICollection<AuditLog> AuditLogs { get; set; } = new List<AuditLog>();
    public ICollection<PurchaseOrder> PurchaseOrders { get; set; } = new List<PurchaseOrder>();
}

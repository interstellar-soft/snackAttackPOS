using LitePOS.Api.Entities;
using Microsoft.EntityFrameworkCore;

namespace LitePOS.Api.Data;

public class LitePosDbContext : DbContext
{
    public LitePosDbContext(DbContextOptions<LitePosDbContext> options) : base(options)
    {
    }

    public DbSet<AppUser> Users => Set<AppUser>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<ProductVariant> ProductVariants => Set<ProductVariant>();
    public DbSet<ProductModifier> ProductModifiers => Set<ProductModifier>();
    public DbSet<InventoryAdjustment> InventoryAdjustments => Set<InventoryAdjustment>();
    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<Sale> Sales => Set<Sale>();
    public DbSet<SaleItem> SaleItems => Set<SaleItem>();
    public DbSet<StoreSetting> StoreSettings => Set<StoreSetting>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<AppUser>()
            .HasIndex(u => u.Email)
            .IsUnique();

        modelBuilder.Entity<Product>()
            .Property(p => p.Price)
            .HasPrecision(18, 2);
        modelBuilder.Entity<Product>()
            .Property(p => p.Cost)
            .HasPrecision(18, 2);
        modelBuilder.Entity<Product>()
            .Property(p => p.StockQuantity)
            .HasPrecision(18, 3);
        modelBuilder.Entity<Product>()
            .Property(p => p.LowStockThreshold)
            .HasPrecision(18, 3);
        modelBuilder.Entity<Product>()
            .Property(p => p.TaxRate)
            .HasPrecision(6, 4);

        modelBuilder.Entity<ProductVariant>()
            .Property(v => v.Price)
            .HasPrecision(18, 2);

        modelBuilder.Entity<ProductModifier>()
            .Property(m => m.PriceDelta)
            .HasPrecision(18, 2);

        modelBuilder.Entity<Sale>()
            .Property(s => s.Subtotal).HasPrecision(18, 2);
        modelBuilder.Entity<Sale>()
            .Property(s => s.DiscountTotal).HasPrecision(18, 2);
        modelBuilder.Entity<Sale>()
            .Property(s => s.TaxTotal).HasPrecision(18, 2);
        modelBuilder.Entity<Sale>()
            .Property(s => s.Total).HasPrecision(18, 2);
        modelBuilder.Entity<Sale>()
            .Property(s => s.CashPayment).HasPrecision(18, 2);
        modelBuilder.Entity<Sale>()
            .Property(s => s.CardPayment).HasPrecision(18, 2);
        modelBuilder.Entity<Sale>()
            .Property(s => s.ChangeDue).HasPrecision(18, 2);

        modelBuilder.Entity<SaleItem>()
            .Property(i => i.Quantity).HasPrecision(18, 3);
        modelBuilder.Entity<SaleItem>()
            .Property(i => i.UnitPrice).HasPrecision(18, 2);
        modelBuilder.Entity<SaleItem>()
            .Property(i => i.DiscountPercent).HasPrecision(5, 2);
        modelBuilder.Entity<SaleItem>()
            .Property(i => i.TaxAmount).HasPrecision(18, 2);
        modelBuilder.Entity<SaleItem>()
            .Property(i => i.LineTotal).HasPrecision(18, 2);

        modelBuilder.Entity<StoreSetting>()
            .Property(s => s.DefaultTaxRate)
            .HasPrecision(6, 4);
    }
}

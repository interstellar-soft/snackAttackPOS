using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PosBackend.Domain.Entities;

namespace PosBackend.Infrastructure.Data.Configurations;

public class PurchaseOrderConfiguration : IEntityTypeConfiguration<PurchaseOrder>
{
    public void Configure(EntityTypeBuilder<PurchaseOrder> builder)
    {
        builder.ToTable("purchase_orders");
        builder.Property(p => p.TotalCostUsd).HasColumnType("numeric(14,2)");
        builder.Property(p => p.TotalCostLbp).HasColumnType("numeric(20,2)");
        builder.Property(p => p.ExchangeRateUsed).HasColumnType("numeric(18,4)");
        builder.Property(p => p.Reference).HasMaxLength(120);
        builder.HasMany(p => p.Lines)
            .WithOne(l => l.PurchaseOrder)
            .HasForeignKey(l => l.PurchaseOrderId);
        builder.HasOne(p => p.CreatedByUser)
            .WithMany(u => u.PurchaseOrders)
            .HasForeignKey(p => p.CreatedByUserId);
    }
}

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PosBackend.Domain.Entities;

namespace PosBackend.Infrastructure.Data.Configurations;

public class PurchaseOrderLineConfiguration : IEntityTypeConfiguration<PurchaseOrderLine>
{
    public void Configure(EntityTypeBuilder<PurchaseOrderLine> builder)
    {
        builder.ToTable("purchase_order_lines");
        builder.Property(l => l.Barcode).HasMaxLength(128);
        builder.Property(l => l.Quantity).HasColumnType("numeric(14,2)");
        builder.Property(l => l.UnitCostUsd).HasColumnType("numeric(14,4)");
        builder.Property(l => l.UnitCostLbp).HasColumnType("numeric(20,2)");
        builder.Property(l => l.TotalCostUsd).HasColumnType("numeric(14,2)");
        builder.Property(l => l.TotalCostLbp).HasColumnType("numeric(20,2)");
        builder.Property(l => l.Currency).HasMaxLength(3);
    }
}

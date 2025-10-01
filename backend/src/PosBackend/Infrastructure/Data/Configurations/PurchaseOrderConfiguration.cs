using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PosBackend.Domain.Entities;

namespace PosBackend.Infrastructure.Data.Configurations;

public class PurchaseOrderConfiguration : IEntityTypeConfiguration<PurchaseOrder>
{
    public void Configure(EntityTypeBuilder<PurchaseOrder> builder)
    {
        builder.ToTable("purchase_orders");
        builder.Property(p => p.TotalCost).HasColumnType("numeric(14,2)");
        builder.Property(p => p.Currency).HasMaxLength(3);
    }
}

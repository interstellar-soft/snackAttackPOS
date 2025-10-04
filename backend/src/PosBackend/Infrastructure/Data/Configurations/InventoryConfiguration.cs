using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PosBackend.Domain.Entities;

namespace PosBackend.Infrastructure.Data.Configurations;

public class InventoryConfiguration : IEntityTypeConfiguration<Inventory>
{
    public void Configure(EntityTypeBuilder<Inventory> builder)
    {
        builder.ToTable("inventories");
        builder.HasIndex(i => i.ProductId).IsUnique();
        builder.Property(i => i.QuantityOnHand).HasColumnType("numeric(14,2)");
        builder.Property(i => i.AverageCostUsd).HasColumnType("numeric(14,4)");
        builder.Property(i => i.AverageCostLbp).HasColumnType("numeric(20,2)");
    }
}

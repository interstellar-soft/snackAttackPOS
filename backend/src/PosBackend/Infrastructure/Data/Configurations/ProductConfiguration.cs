using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PosBackend.Domain.Entities;

namespace PosBackend.Infrastructure.Data.Configurations;

public class ProductConfiguration : IEntityTypeConfiguration<Product>
{
    public void Configure(EntityTypeBuilder<Product> builder)
    {
        builder.ToTable("products");
        builder.Property(p => p.Sku)
            .IsRequired(false);

        builder.HasIndex(p => p.Sku)
            .IsUnique()
            .HasFilter("\"Sku\" IS NOT NULL");
        builder.HasIndex(p => p.Barcode).IsUnique();
        builder.Property(p => p.PriceUsd).HasColumnType("numeric(12,2)");
        builder.Property(p => p.PriceLbp).HasColumnType("numeric(14,2)");
        builder.Property(p => p.IsPinned)
            .HasColumnName("is_pinned")
            .HasDefaultValue(false);
    }
}

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PosBackend.Domain.Entities;

namespace PosBackend.Infrastructure.Data.Configurations;

public class ProductConfiguration : IEntityTypeConfiguration<Product>
{
    public void Configure(EntityTypeBuilder<Product> builder)
    {
        builder.ToTable("products");
        builder.HasIndex(p => p.Sku).IsUnique();
        builder.HasIndex(p => p.Barcode).IsUnique();
        builder.Property(p => p.PriceUsd).HasColumnType("numeric(12,2)");
        builder.Property(p => p.PriceLbp).HasColumnType("numeric(14,2)");
    }
}

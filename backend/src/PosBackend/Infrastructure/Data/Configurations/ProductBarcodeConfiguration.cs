using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PosBackend.Domain.Entities;

namespace PosBackend.Infrastructure.Data.Configurations;

public class ProductBarcodeConfiguration : IEntityTypeConfiguration<ProductBarcode>
{
    public void Configure(EntityTypeBuilder<ProductBarcode> builder)
    {
        builder.ToTable("product_barcodes");
        builder.Property(b => b.Code)
            .IsRequired()
            .HasMaxLength(120);
        builder.Property(b => b.QuantityPerScan)
            .HasDefaultValue(1);
        builder.Property(b => b.PriceUsdOverride)
            .HasColumnType("numeric(12,2)");
        builder.Property(b => b.PriceLbpOverride)
            .HasColumnType("numeric(14,2)");
        builder.HasIndex(b => b.Code)
            .IsUnique();
        builder.HasOne(b => b.Product)
            .WithMany(p => p.AdditionalBarcodes)
            .HasForeignKey(b => b.ProductId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

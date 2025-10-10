using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PosBackend.Domain.Entities;

namespace PosBackend.Infrastructure.Data.Configurations;

public class OfferConfiguration : IEntityTypeConfiguration<Offer>
{
    public void Configure(EntityTypeBuilder<Offer> builder)
    {
        builder.ToTable("offers");
        builder.Property(o => o.PriceUsd).HasColumnType("numeric(12,2)");
        builder.Property(o => o.PriceLbp).HasColumnType("numeric(18,2)");
        builder.Property(o => o.Name).HasMaxLength(200);
        builder.HasMany(o => o.Items)
            .WithOne(i => i.Offer)
            .HasForeignKey(i => i.OfferId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

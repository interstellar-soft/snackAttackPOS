using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PosBackend.Domain.Entities;

namespace PosBackend.Infrastructure.Data.Configurations;

public class PersonalPurchaseConfiguration : IEntityTypeConfiguration<PersonalPurchase>
{
    public void Configure(EntityTypeBuilder<PersonalPurchase> builder)
    {
        builder.ToTable("personal_purchases");
        builder.Property(p => p.TotalUsd).HasColumnType("numeric(14,2)");
        builder.Property(p => p.TotalLbp).HasColumnType("numeric(18,2)");
        builder.Property(p => p.PurchaseDate).HasColumnType("timestamp with time zone");
        builder.HasIndex(p => new { p.UserId, p.PurchaseDate });
        builder.HasIndex(p => p.TransactionId).IsUnique();
    }
}

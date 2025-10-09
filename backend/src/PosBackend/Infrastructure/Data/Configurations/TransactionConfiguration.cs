using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PosBackend.Domain.Entities;

namespace PosBackend.Infrastructure.Data.Configurations;

public class TransactionConfiguration : IEntityTypeConfiguration<PosTransaction>
{
    public void Configure(EntityTypeBuilder<PosTransaction> builder)
    {
        builder.ToTable("transactions");
        builder.HasIndex(t => t.TransactionNumber).IsUnique();
        builder.Property(t => t.TotalUsd).HasColumnType("numeric(14,2)");
        builder.Property(t => t.TotalLbp).HasColumnType("numeric(18,2)");
        builder.Property(t => t.PaidUsd).HasColumnType("numeric(14,2)");
        builder.Property(t => t.PaidLbp).HasColumnType("numeric(18,2)");
        builder.Property(t => t.BalanceUsd).HasColumnType("numeric(14,2)");
        builder.Property(t => t.BalanceLbp).HasColumnType("numeric(18,2)");
        builder.Property(t => t.ExchangeRateUsed).HasColumnType("numeric(18,6)");
        builder.Property(t => t.HasManualTotalOverride).HasColumnType("boolean").HasDefaultValue(false);
    }
}

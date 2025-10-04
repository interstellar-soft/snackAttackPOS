using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PosBackend.Domain.Entities;

namespace PosBackend.Infrastructure.Data.Configurations;

public class TransactionLineConfiguration : IEntityTypeConfiguration<TransactionLine>
{
    public void Configure(EntityTypeBuilder<TransactionLine> builder)
    {
        builder.ToTable("transaction_lines");
        builder.Property(l => l.BaseUnitPriceUsd).HasColumnType("numeric(14,2)");
        builder.Property(l => l.BaseUnitPriceLbp).HasColumnType("numeric(18,2)");
        builder.Property(l => l.UnitPriceUsd).HasColumnType("numeric(14,2)");
        builder.Property(l => l.UnitPriceLbp).HasColumnType("numeric(18,2)");
        builder.Property(l => l.TotalUsd).HasColumnType("numeric(14,2)");
        builder.Property(l => l.TotalLbp).HasColumnType("numeric(18,2)");
        builder.Property(l => l.CostUsd).HasColumnType("numeric(14,4)");
        builder.Property(l => l.CostLbp).HasColumnType("numeric(18,2)");
        builder.Property(l => l.ProfitUsd).HasColumnType("numeric(14,2)");
        builder.Property(l => l.ProfitLbp).HasColumnType("numeric(18,2)");
    }
}

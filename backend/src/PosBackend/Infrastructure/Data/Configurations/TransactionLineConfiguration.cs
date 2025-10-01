using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PosBackend.Domain.Entities;

namespace PosBackend.Infrastructure.Data.Configurations;

public class TransactionLineConfiguration : IEntityTypeConfiguration<TransactionLine>
{
    public void Configure(EntityTypeBuilder<TransactionLine> builder)
    {
        builder.ToTable("transaction_lines");
        builder.Property(l => l.UnitPriceUsd).HasColumnType("numeric(14,2)");
        builder.Property(l => l.UnitPriceLbp).HasColumnType("numeric(18,2)");
        builder.Property(l => l.TotalUsd).HasColumnType("numeric(14,2)");
        builder.Property(l => l.TotalLbp).HasColumnType("numeric(18,2)");
    }
}

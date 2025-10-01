using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PosBackend.Domain.Entities;

namespace PosBackend.Infrastructure.Data.Configurations;

public class CurrencyRateConfiguration : IEntityTypeConfiguration<CurrencyRate>
{
    public void Configure(EntityTypeBuilder<CurrencyRate> builder)
    {
        builder.ToTable("currency_rates");
        builder.Property(r => r.Rate).HasColumnType("numeric(18,6)");
        builder.Property(r => r.BaseCurrency).HasMaxLength(3);
        builder.Property(r => r.QuoteCurrency).HasMaxLength(3);
    }
}

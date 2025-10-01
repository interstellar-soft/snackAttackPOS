using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PosBackend.Domain.Entities;

namespace PosBackend.Infrastructure.Data.Configurations;

public class ExpirationBatchConfiguration : IEntityTypeConfiguration<ExpirationBatch>
{
    public void Configure(EntityTypeBuilder<ExpirationBatch> builder)
    {
        builder.ToTable("expiration_batches");
        builder.Property(b => b.Quantity).HasColumnType("numeric(14,2)");
    }
}

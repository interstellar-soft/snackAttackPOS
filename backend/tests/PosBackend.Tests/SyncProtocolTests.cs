using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using PosBackend.Infrastructure.Data;
using PosSync;
using Xunit;

namespace PosBackend.Tests;

public class SyncProtocolTests
{
    [Fact]
    public void CatalogCoversEveryBusinessTable()
    {
        using var db = new ApplicationDbContext(new DbContextOptionsBuilder<ApplicationDbContext>().UseNpgsql("Host=localhost;Database=unused").Options);
        var tables = db.Model.GetEntityTypes().Select(t => t.GetTableName()).Distinct().Order().ToArray();
        Assert.Equal(tables, SyncCatalog.Tables.Order().ToArray());
    }

    [Theory]
    [InlineData("PasswordHash")]
    [InlineData("RecoveryCode")]
    [InlineData("ApiKey")]
    public void UnknownUserFieldsAreRejected(string field)
    {
        var row = JsonSerializer.SerializeToElement(new Dictionary<string,object> { ["Id"] = Guid.NewGuid(), ["Username"] = "admin", [field] = "secret" });
        Assert.Throws<InvalidOperationException>(() => SyncCatalog.ValidateRecord("users",row));
    }

    [Theory]
    [InlineData("Data")]
    [InlineData("IpAddress")]
    public void UnstructuredAuditPayloadIsNotMirrored(string field)
    {
        var row = JsonSerializer.SerializeToElement(new Dictionary<string,object> { ["Id"] = Guid.NewGuid(), [field] = "sensitive" });
        Assert.Throws<InvalidOperationException>(() => SyncCatalog.ValidateRecord("audit_logs",row));
    }

    [Fact]
    public void BusinessRowKeepsExactDecimalQuantity()
    {
        var row = JsonSerializer.SerializeToElement(new { Id = Guid.NewGuid(), QuantityOnHand = 0.001m });
        SyncCatalog.ValidateRecord("inventories",row);
        Assert.Equal(0.001m,row.GetProperty("QuantityOnHand").GetDecimal());
    }
}

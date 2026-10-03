using Microsoft.Extensions.Configuration;
using Npgsql;
using PosMobile;
using Xunit;

public class HostingSettingsTests
{
    static IConfiguration Config(params (string Key, string Value)[] values) => new ConfigurationBuilder().AddInMemoryCollection(values.Select(v => new KeyValuePair<string, string?>(v.Key, v.Value))).Build();
    [Fact] public void RequiresPublicOriginUnlessExplicitlyLocal()
    {
        Assert.Throws<InvalidOperationException>(() => HostingSettings.Read(Config()));
        Assert.Null(HostingSettings.Read(Config(("Hosting:AllowLocalHttp", "true"))).PublicOrigin);
        Assert.False(HostingSettings.Read(Config(("RENDER_EXTERNAL_URL", "https://test.onrender.com"))).AllowLocalHttp);
    }
    [Theory]
    [InlineData("http://example.com")][InlineData("https://example.com/path")][InlineData("https://user:pw@example.com")][InlineData("https://example.com?x=1")][InlineData("https://example.com#x")]
    public void RejectsInvalidPublicOrigins(string value) => Assert.Throws<InvalidOperationException>(() => HostingSettings.Read(Config(("Hosting:PublicOrigin", value))));
    [Fact] public void CustomDomainOverridesRenderDomain() => Assert.Equal("shop.example.com", HostingSettings.Read(Config(("RENDER_EXTERNAL_URL", "https://test.onrender.com"), ("Hosting:PublicOrigin", "https://shop.example.com"))).PublicOrigin!.Host);
    [Fact] public void DatabaseUrlDecodesCredentialsAndRequiresTls()
    {
        var cs = new NpgsqlConnectionStringBuilder(HostingSettings.DatabaseConnection(Config(("DATABASE_URL", "postgresql://user:p%40ss%3Aword@db.example.com/mobile"))));
        Assert.Equal("p@ss:word", cs.Password); Assert.Equal(5432, cs.Port); Assert.Equal(SslMode.Require, cs.SslMode); Assert.Equal("mobile", cs.Database);
    }
    [Theory][InlineData("disable")][InlineData("prefer")][InlineData("allow")]
    public void RejectsPlaintextDatabaseModes(string mode) => Assert.Throws<InvalidOperationException>(() => HostingSettings.DatabaseConnection(Config(("DATABASE_URL", $"postgres://user:pass@db/mobile?sslmode={mode}"))));
    [Fact] public void KeepsExplicitLocalConnection() => Assert.Equal(SslMode.Disable, new NpgsqlConnectionStringBuilder(HostingSettings.DatabaseConnection(Config(("ConnectionStrings:Mobile", "Host=localhost;Database=local;SSL Mode=Disable")))).SslMode);
}

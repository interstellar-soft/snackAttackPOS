using Npgsql;

namespace PosMobile;

public sealed record HostingSettings(bool AllowLocalHttp, Uri? PublicOrigin)
{
    public static HostingSettings Read(IConfiguration configuration)
    {
        var local = configuration.GetValue<bool>("Hosting:AllowLocalHttp");
        var origin = configuration["Hosting:PublicOrigin"] ?? configuration["RENDER_EXTERNAL_URL"];
        if (string.IsNullOrWhiteSpace(origin))
        {
            if (local) return new(true, null);
            throw new InvalidOperationException("Set Hosting:PublicOrigin to the public HTTPS URL. Only the local development launcher should enable Hosting:AllowLocalHttp.");
        }
        if (!Uri.TryCreate(origin, UriKind.Absolute, out var uri) || uri.Scheme != "https" ||
            uri.UserInfo.Length > 0 || uri.Query.Length > 0 || uri.Fragment.Length > 0 || uri.AbsolutePath != "/")
            throw new InvalidOperationException("Hosting:PublicOrigin must be an HTTPS origin without a path, credentials, query or fragment.");
        return new(local, uri);
    }

    public static string DatabaseConnection(IConfiguration configuration)
    {
        var explicitConnection = configuration.GetConnectionString("Mobile");
        if (!string.IsNullOrWhiteSpace(explicitConnection)) return new NpgsqlConnectionStringBuilder(explicitConnection).ConnectionString;
        var raw = configuration["DATABASE_URL"];
        if (!Uri.TryCreate(raw, UriKind.Absolute, out var url) || url.Scheme is not ("postgresql" or "postgres") ||
            string.IsNullOrWhiteSpace(url.Host) || url.AbsolutePath.Length <= 1 || url.Fragment.Length > 0)
            throw new InvalidOperationException("Set ConnectionStrings:Mobile or DATABASE_URL to the separate mobile database.");
        var credentials = url.UserInfo.Split(':', 2);
        if (credentials.Length != 2 || string.IsNullOrWhiteSpace(credentials[0]))
            throw new InvalidOperationException("DATABASE_URL must contain a username and password.");
        var connection = new NpgsqlConnectionStringBuilder
        {
            Host = url.Host, Port = url.Port > 0 ? url.Port : 5432,
            Username = Uri.UnescapeDataString(credentials[0]), Password = Uri.UnescapeDataString(credentials[1]),
            Database = Uri.UnescapeDataString(url.AbsolutePath[1..]),
            // Render internal connections use self-signed certificates; require encryption, without plaintext fallback.
            SslMode = SslMode.Require, MaxPoolSize = 20, Timeout = 15, CommandTimeout = 60
        };
        foreach (var pair in url.Query.TrimStart('?').Split('&', StringSplitOptions.RemoveEmptyEntries))
        {
            var parts = pair.Split('=', 2);
            if (parts.Length != 2 || parts[0] != "sslmode") throw new InvalidOperationException("Unsupported DATABASE_URL option. Use an explicit Npgsql connection string for advanced settings.");
            connection.SslMode = parts[1].ToLowerInvariant() switch
            {
                "require" => SslMode.Require,
                "verify-ca" => SslMode.VerifyCA,
                "verify-full" => SslMode.VerifyFull,
                _ => throw new InvalidOperationException("Hosted database connections must use TLS.")
            };
        }
        return connection.ConnectionString;
    }
}

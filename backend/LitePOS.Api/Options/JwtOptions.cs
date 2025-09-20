namespace LitePOS.Api.Options;

public class JwtOptions
{
    public string? Secret { get; set; }
    public int AccessTokenMinutes { get; set; } = 60;
    public int RefreshTokenDays { get; set; } = 7;
}

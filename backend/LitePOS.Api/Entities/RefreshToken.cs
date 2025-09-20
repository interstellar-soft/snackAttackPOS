namespace LitePOS.Api.Entities;

public class RefreshToken
{
    public Guid Id { get; set; }
    public string Token { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? RevokedAt { get; set; }
    public Guid AppUserId { get; set; }
    public AppUser? AppUser { get; set; }
    public bool IsActive => RevokedAt == null && DateTime.UtcNow <= ExpiresAt;
}

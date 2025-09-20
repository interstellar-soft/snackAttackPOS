using System.ComponentModel.DataAnnotations;

namespace LitePOS.Api.Entities;

public class AppUser
{
    public Guid Id { get; set; }

    [MaxLength(120)]
    public string FullName { get; set; } = string.Empty;

    [MaxLength(160)]
    public string Email { get; set; } = string.Empty;

    public string PasswordHash { get; set; } = string.Empty;

    public UserRole Role { get; set; }

    public List<RefreshToken> RefreshTokens { get; set; } = new();
}

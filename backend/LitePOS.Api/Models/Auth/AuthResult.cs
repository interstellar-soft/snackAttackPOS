using LitePOS.Api.Entities;

namespace LitePOS.Api.Models.Auth;

public record AuthResult(AppUser User, string AccessToken, string RefreshToken);

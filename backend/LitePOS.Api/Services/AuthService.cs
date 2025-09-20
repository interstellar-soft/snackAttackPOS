using BCrypt.Net;
using LitePOS.Api.Data;
using LitePOS.Api.Entities;
using LitePOS.Api.Models.Auth;
using Microsoft.EntityFrameworkCore;

namespace LitePOS.Api.Services;

public class AuthService
{
    private readonly LitePosDbContext _dbContext;
    private readonly TokenService _tokenService;

    public AuthService(LitePosDbContext dbContext, TokenService tokenService)
    {
        _dbContext = dbContext;
        _tokenService = tokenService;
    }

    public async Task<AuthResult?> LoginAsync(string email, string password)
    {
        var user = await _dbContext.Users.Include(u => u.RefreshTokens)
            .FirstOrDefaultAsync(u => u.Email == email);
        if (user is null)
        {
            return null;
        }

        if (!BCrypt.Net.BCrypt.Verify(password, user.PasswordHash))
        {
            return null;
        }

        var accessToken = _tokenService.GenerateAccessToken(user);
        var refreshToken = await _tokenService.GenerateRefreshTokenAsync(user);

        return new AuthResult(user, accessToken, refreshToken.Token);
    }

    public async Task<AuthResult?> RefreshAsync(string refreshToken)
    {
        var token = await _tokenService.GetRefreshTokenAsync(refreshToken);
        if (token is null || !token.IsActive || token.AppUser is null)
        {
            return null;
        }

        if (token.ExpiresAt < DateTime.UtcNow)
        {
            return null;
        }

        var accessToken = _tokenService.GenerateAccessToken(token.AppUser);
        var newRefresh = await _tokenService.GenerateRefreshTokenAsync(token.AppUser);
        await _tokenService.RevokeRefreshTokenAsync(token);
        return new AuthResult(token.AppUser, accessToken, newRefresh.Token);
    }

    public async Task RevokeAsync(string refreshToken)
    {
        var token = await _tokenService.GetRefreshTokenAsync(refreshToken);
        if (token != null)
        {
            await _tokenService.RevokeRefreshTokenAsync(token);
        }
    }
}

using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using LitePOS.Api.Data;
using LitePOS.Api.Entities;
using LitePOS.Api.Options;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace LitePOS.Api.Services;

public class TokenService
{
    private readonly LitePosDbContext _dbContext;
    private readonly JwtOptions _options;

    public TokenService(LitePosDbContext dbContext, IOptions<JwtOptions> options)
    {
        _dbContext = dbContext;
        _options = options.Value;
    }

    public string GenerateAccessToken(AppUser user)
    {
        var handler = new JwtSecurityTokenHandler();
        var key = Encoding.UTF8.GetBytes(_options.Secret ?? "super_secret_key_change_me");
        var descriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(new[]
            {
                new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
                new Claim(JwtRegisteredClaimNames.Email, user.Email),
                new Claim(ClaimTypes.Role, user.Role.ToString()),
                new Claim("fullName", user.FullName)
            }),
            Expires = DateTime.UtcNow.AddMinutes(_options.AccessTokenMinutes),
            SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
        };
        var token = handler.CreateToken(descriptor);
        return handler.WriteToken(token);
    }

    public async Task<RefreshToken> GenerateRefreshTokenAsync(AppUser user)
    {
        var token = Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));
        var refreshToken = new RefreshToken
        {
            Id = Guid.NewGuid(),
            AppUserId = user.Id,
            Token = token,
            CreatedAt = DateTime.UtcNow,
            ExpiresAt = DateTime.UtcNow.AddDays(_options.RefreshTokenDays)
        };
        _dbContext.RefreshTokens.Add(refreshToken);
        await _dbContext.SaveChangesAsync();
        return refreshToken;
    }

    public async Task<RefreshToken?> GetRefreshTokenAsync(string token)
    {
        return await _dbContext.RefreshTokens.Include(r => r.AppUser)
            .FirstOrDefaultAsync(r => r.Token == token && r.RevokedAt == null);
    }

    public async Task RevokeRefreshTokenAsync(RefreshToken refreshToken)
    {
        refreshToken.RevokedAt = DateTime.UtcNow;
        _dbContext.RefreshTokens.Update(refreshToken);
        await _dbContext.SaveChangesAsync();
    }
}

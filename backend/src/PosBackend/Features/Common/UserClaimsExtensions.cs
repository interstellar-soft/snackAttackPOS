using System;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace PosBackend.Features.Common;

internal static class UserClaimsExtensions
{
    public static Guid? GetCurrentUserId(this ClaimsPrincipal? user)
    {
        if (user is null)
        {
            return null;
        }

        var userIdValue = user.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(userIdValue))
        {
            userIdValue = user.FindFirstValue(JwtRegisteredClaimNames.Sub);
        }
        if (string.IsNullOrWhiteSpace(userIdValue))
        {
            return null;
        }

        return Guid.TryParse(userIdValue, out var userId) ? userId : null;
    }
}

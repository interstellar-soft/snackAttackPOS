using LitePOS.Api.Models.Auth;
using LitePOS.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LitePOS.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly AuthService _authService;

    public AuthController(AuthService authService)
    {
        _authService = authService;
    }

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<AuthResponse>> Login([FromBody] LoginRequest request)
    {
        var result = await _authService.LoginAsync(request.Email, request.Password);
        if (result == null)
        {
            return Unauthorized(new { message = "Invalid credentials" });
        }

        return new AuthResponse
        {
            UserId = result.User.Id,
            FullName = result.User.FullName,
            Email = result.User.Email,
            Role = result.User.Role.ToString(),
            AccessToken = result.AccessToken,
            RefreshToken = result.RefreshToken
        };
    }

    [HttpPost("refresh")]
    [AllowAnonymous]
    public async Task<ActionResult<AuthResponse>> Refresh([FromBody] RefreshTokenRequest request)
    {
        var result = await _authService.RefreshAsync(request.RefreshToken);
        if (result == null)
        {
            return Unauthorized(new { message = "Invalid refresh token" });
        }

        return new AuthResponse
        {
            UserId = result.User.Id,
            FullName = result.User.FullName,
            Email = result.User.Email,
            Role = result.User.Role.ToString(),
            AccessToken = result.AccessToken,
            RefreshToken = result.RefreshToken
        };
    }

    [HttpPost("logout")]
    public async Task<IActionResult> Logout([FromBody] RefreshTokenRequest request)
    {
        await _authService.RevokeAsync(request.RefreshToken);
        return NoContent();
    }
}

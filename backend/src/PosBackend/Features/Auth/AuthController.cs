using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PosBackend.Application.Requests;
using PosBackend.Application.Responses;
using PosBackend.Application.Services;
using PosBackend.Infrastructure.Data;

namespace PosBackend.Features.Auth;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly JwtTokenService _tokenService;

    public AuthController(ApplicationDbContext db, JwtTokenService tokenService)
    {
        _db = db;
        _tokenService = tokenService;
    }

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<LoginResponse>> Login([FromBody] LoginRequest request, CancellationToken cancellationToken)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Username == request.Username, cancellationToken);
        if (user is null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
        {
            return Unauthorized();
        }

        var token = _tokenService.CreateToken(user);
        return new LoginResponse
        {
            Token = token,
            DisplayName = user.DisplayName,
            Role = user.Role.ToString()
        };
    }
}

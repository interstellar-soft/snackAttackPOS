using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PosBackend.Application.Requests;
using PosBackend.Application.Responses;
using PosBackend.Application.Services;
using PosBackend.Domain.Entities;
using PosBackend.Features.Common;
using PosBackend.Infrastructure.Data;

namespace PosBackend.Features.Admin;

[ApiController]
[Route("api/admin/users")]
[Authorize(Roles = "Admin")]
public class UsersController : ControllerBase
{
    private const int MinimumPasswordLength = 8;

    private readonly ApplicationDbContext _db;
    private readonly AuditLogger _auditLogger;

    public UsersController(ApplicationDbContext db, AuditLogger auditLogger)
    {
        _db = db;
        _auditLogger = auditLogger;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<UserResponse>>> GetUsers(CancellationToken cancellationToken)
    {
        var users = await _db.Users
            .AsNoTracking()
            .OrderBy(u => u.Username)
            .ToListAsync(cancellationToken);

        return Ok(users.Select(ToResponse));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<UserResponse>> GetUserById(Guid id, CancellationToken cancellationToken)
    {
        var user = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == id, cancellationToken);
        if (user is null)
        {
            return NotFound();
        }

        return Ok(ToResponse(user));
    }

    [HttpPost]
    public async Task<ActionResult<UserResponse>> CreateUser([FromBody] CreateUserRequest request, CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, List<string>>();

        var username = request.Username?.Trim();
        var password = request.Password?.Trim();
        var displayName = request.DisplayName?.Trim();
        string? normalizedUsername = null;

        if (string.IsNullOrWhiteSpace(username))
        {
            AddError(errors, nameof(request.Username), "Username is required.");
        }
        else if (username.Length < 3)
        {
            AddError(errors, nameof(request.Username), "Username must be at least 3 characters long.");
        }
        else
        {
            normalizedUsername = username.ToLowerInvariant();
            if (await _db.Users.AnyAsync(u => u.Username.ToLower() == normalizedUsername, cancellationToken))
            {
                AddError(errors, nameof(request.Username), "Username is already in use.");
            }
        }

        if (string.IsNullOrWhiteSpace(password))
        {
            AddError(errors, nameof(request.Password), "Password is required.");
        }
        else if (password.Length < MinimumPasswordLength)
        {
            AddError(errors, nameof(request.Password), $"Password must be at least {MinimumPasswordLength} characters long.");
        }

        if (string.IsNullOrWhiteSpace(displayName))
        {
            AddError(errors, nameof(request.DisplayName), "Display name is required.");
        }

        var roleParseResult = TryParseRole(request.Role, out var role);
        if (!roleParseResult.Succeeded)
        {
            AddError(errors, nameof(request.Role), roleParseResult.ErrorMessage);
        }

        if (errors.Count > 0)
        {
            return CreateValidationProblem(errors);
        }

        var user = new User
        {
            Username = username!,
            DisplayName = displayName!,
            Role = role,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(password!)
        };

        await _db.Users.AddAsync(user, cancellationToken);
        await _db.SaveChangesAsync(cancellationToken);

        var currentUserId = User.GetCurrentUserId();
        if (currentUserId.HasValue)
        {
            await _auditLogger.LogAsync(currentUserId.Value, "CreateUser", nameof(User), user.Id, new
            {
                user.Username,
                user.DisplayName,
                Role = user.Role.ToString()
            }, cancellationToken);
        }

        return CreatedAtAction(nameof(GetUserById), new { id = user.Id }, ToResponse(user));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<UserResponse>> UpdateUser(Guid id, [FromBody] UpdateUserRequest request, CancellationToken cancellationToken)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == id, cancellationToken);
        if (user is null)
        {
            return NotFound();
        }

        var errors = new Dictionary<string, List<string>>();

        if (request.DisplayName is not null)
        {
            var trimmedName = request.DisplayName.Trim();
            if (string.IsNullOrWhiteSpace(trimmedName))
            {
                AddError(errors, nameof(request.DisplayName), "Display name cannot be empty.");
            }
            else
            {
                user.DisplayName = trimmedName;
            }
        }

        if (request.Role is not null)
        {
            var roleParseResult = TryParseRole(request.Role, out var role);
            if (!roleParseResult.Succeeded)
            {
                AddError(errors, nameof(request.Role), roleParseResult.ErrorMessage);
            }
            else
            {
                user.Role = role;
            }
        }

        if (errors.Count > 0)
        {
            return CreateValidationProblem(errors);
        }

        user.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);

        var currentUserId = User.GetCurrentUserId();
        if (currentUserId.HasValue)
        {
            await _auditLogger.LogAsync(currentUserId.Value, "UpdateUser", nameof(User), user.Id, new
            {
                user.DisplayName,
                Role = user.Role.ToString()
            }, cancellationToken);
        }

        return Ok(ToResponse(user));
    }

    [HttpPut("{id:guid}/password")]
    public async Task<ActionResult> UpdatePassword(Guid id, [FromBody] UpdateUserPasswordRequest request, CancellationToken cancellationToken)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == id, cancellationToken);
        if (user is null)
        {
            return NotFound();
        }

        var newPassword = request.NewPassword?.Trim();
        if (string.IsNullOrWhiteSpace(newPassword))
        {
            return CreateValidationProblem(new Dictionary<string, List<string>>
            {
                [nameof(request.NewPassword)] = new() { "New password is required." }
            });
        }

        if (newPassword.Length < MinimumPasswordLength)
        {
            return CreateValidationProblem(new Dictionary<string, List<string>>
            {
                [nameof(request.NewPassword)] = new() { $"Password must be at least {MinimumPasswordLength} characters long." }
            });
        }

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(newPassword);
        user.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(cancellationToken);

        var currentUserId = User.GetCurrentUserId();
        if (currentUserId.HasValue)
        {
            await _auditLogger.LogAsync(currentUserId.Value, "UpdateUserPassword", nameof(User), user.Id, new
            {
                user.Username
            }, cancellationToken);
        }

        return NoContent();
    }

    [HttpPost("{id:guid}/reset-password")]
    public async Task<ActionResult<ResetPasswordResponse>> ResetPassword(Guid id, CancellationToken cancellationToken)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == id, cancellationToken);
        if (user is null)
        {
            return NotFound();
        }

        var temporaryPassword = GenerateTemporaryPassword();
        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(temporaryPassword);
        user.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(cancellationToken);

        var currentUserId = User.GetCurrentUserId();
        if (currentUserId.HasValue)
        {
            await _auditLogger.LogAsync(currentUserId.Value, "ResetUserPassword", nameof(User), user.Id, new
            {
                user.Username
            }, cancellationToken);
        }

        return Ok(new ResetPasswordResponse
        {
            TemporaryPassword = temporaryPassword
        });
    }

    private static (bool Succeeded, string ErrorMessage) TryParseRole(string? value, out UserRole role)
    {
        role = UserRole.Cashier;
        if (string.IsNullOrWhiteSpace(value))
        {
            return (false, "Role is required.");
        }

        if (!Enum.TryParse<UserRole>(value, true, out role))
        {
            return (false, "Role is invalid. Allowed values are Admin, Manager, or Cashier.");
        }

        return (true, string.Empty);
    }

    private static string GenerateTemporaryPassword()
    {
        const string Allowed = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@$%*";
        const int Length = 12;

        var bytes = new byte[Length];
        RandomNumberGenerator.Fill(bytes);

        var builder = new StringBuilder(Length);
        for (var i = 0; i < Length; i++)
        {
            var index = bytes[i] % Allowed.Length;
            builder.Append(Allowed[index]);
        }

        return builder.ToString();
    }

    private static UserResponse ToResponse(User user)
    {
        return new UserResponse
        {
            Id = user.Id,
            Username = user.Username,
            DisplayName = user.DisplayName,
            Role = user.Role.ToString(),
            CreatedAt = user.CreatedAt,
            UpdatedAt = user.UpdatedAt
        };
    }

    private ActionResult CreateValidationProblem(IDictionary<string, List<string>> errors)
    {
        ModelState.Clear();
        foreach (var (key, messages) in errors)
        {
            foreach (var message in messages)
            {
                ModelState.AddModelError(key, message);
            }
        }

        return ValidationProblem(ModelState);
    }

    private static void AddError(Dictionary<string, List<string>> errors, string key, string message)
    {
        if (!errors.TryGetValue(key, out var list))
        {
            list = new List<string>();
            errors[key] = list;
        }

        list.Add(message);
    }
}

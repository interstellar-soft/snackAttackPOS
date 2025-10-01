using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PosBackend.Application.Responses;
using PosBackend.Infrastructure.Data;

namespace PosBackend.Features.Audit;

[ApiController]
[Route("api/audit")]
[Authorize(Roles = "Admin,Manager")]
public class AuditController : ControllerBase
{
    private readonly ApplicationDbContext _db;

    public AuditController(ApplicationDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<AuditLogResponse>>> Get(CancellationToken cancellationToken)
    {
        var items = await _db.AuditLogs.Include(a => a.User)
            .OrderByDescending(a => a.CreatedAt)
            .Take(200)
            .Select(a => new AuditLogResponse
            {
                Id = a.Id,
                CreatedAt = a.CreatedAt,
                User = a.User != null ? a.User.DisplayName : string.Empty,
                Action = a.Action,
                Entity = a.Entity,
                Data = a.Data
            }).ToListAsync(cancellationToken);

        return Ok(items);
    }
}

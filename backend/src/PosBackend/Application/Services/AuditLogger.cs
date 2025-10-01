using PosBackend.Infrastructure.Data;

namespace PosBackend.Application.Services;

public class AuditLogger
{
    private readonly ApplicationDbContext _db;

    public AuditLogger(ApplicationDbContext db)
    {
        _db = db;
    }

    public async Task LogAsync(Guid userId, string action, string entity, Guid? entityId, object data, CancellationToken cancellationToken = default)
    {
        var payload = System.Text.Json.JsonSerializer.Serialize(data);
        _db.AuditLogs.Add(new Domain.Entities.AuditLog
        {
            UserId = userId,
            Action = action,
            Entity = entity,
            EntityId = entityId,
            Data = payload,
            CreatedAt = DateTime.UtcNow
        });
        await _db.SaveChangesAsync(cancellationToken);
    }
}

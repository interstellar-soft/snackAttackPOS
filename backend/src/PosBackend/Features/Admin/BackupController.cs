using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PosBackend.Application.Responses;
using PosBackend.Application.Services;
using PosBackend.Features.Common;

namespace PosBackend.Features.Admin;

[ApiController]
[Route("api/admin/backup")]
[Authorize(Roles = "Admin")]
public class BackupController : ControllerBase
{
    private static readonly JsonSerializerOptions SerializerOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = true
    };

    private readonly BackupService _backupService;
    private readonly AuditLogger _auditLogger;

    public BackupController(BackupService backupService, AuditLogger auditLogger)
    {
        _backupService = backupService;
        _auditLogger = auditLogger;
    }

    [HttpGet("export")]
    public async Task<IActionResult> ExportAsync(CancellationToken cancellationToken)
    {
        var backup = await _backupService.ExportAsync(cancellationToken);
        var payload = JsonSerializer.Serialize(backup, SerializerOptions);
        var fileName = $"aurora-backup-{DateTime.UtcNow:yyyyMMddHHmmss}.json";

        var currentUserId = User.GetCurrentUserId();
        if (currentUserId.HasValue)
        {
            await _auditLogger.LogAsync(currentUserId.Value, "ExportBackup", nameof(DatabaseBackup), null, new
            {
                backup.SchemaVersion,
                backup.GeneratedAt,
                Counts = new
                {
                    Users = backup.Users.Count,
                    Products = backup.Products.Count,
                    Transactions = backup.Transactions.Count
                }
            }, cancellationToken);
        }

        return File(Encoding.UTF8.GetBytes(payload), "application/json", fileName);
    }

    [HttpPost("import")]
    public async Task<ActionResult<BackupImportResult>> ImportAsync([FromBody] DatabaseBackup backup, CancellationToken cancellationToken)
    {
        if (backup is null)
        {
            return BadRequest("Backup payload is required.");
        }

        if (backup.SchemaVersion < 1 || backup.SchemaVersion > DatabaseBackup.CurrentSchemaVersion ||
            backup.Users is null || !backup.Users.Any(u => u.Role == PosBackend.Domain.Entities.UserRole.Admin))
            return BadRequest("The backup must have a supported schema and contain an administrator account.");

        var currentUserId = User.GetCurrentUserId();
        if (!currentUserId.HasValue)
        {
            return Unauthorized();
        }

        var result = await _backupService.ImportAsync(backup, cancellationToken);

        var auditUserId = backup.Users.Any(u => u.Id == currentUserId.Value)
            ? currentUserId.Value : backup.Users.First(u => u.Role == PosBackend.Domain.Entities.UserRole.Admin).Id;
        await _auditLogger.LogAsync(auditUserId, "ImportBackup", nameof(DatabaseBackup), null, new
        {
            InitiatedByUserId = currentUserId.Value,
            backup.SchemaVersion,
            result.RecordsImported
        }, cancellationToken);

        return Ok(result);
    }
}

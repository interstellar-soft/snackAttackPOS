namespace PosBackend.Application.Responses;

public class AuditLogResponse
{
    public Guid Id { get; set; }
    public DateTime CreatedAt { get; set; }
    public string User { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty;
    public string Entity { get; set; } = string.Empty;
    public string Data { get; set; } = string.Empty;
}

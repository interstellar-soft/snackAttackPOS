namespace PosBackend.Application.Requests;

public class ReturnRequest
{
    public Guid TransactionId { get; set; }
    public IEnumerable<Guid> LineIds { get; set; } = new List<Guid>();
}

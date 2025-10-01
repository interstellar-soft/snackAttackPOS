namespace PosBackend.Application.Responses;

public class ReceiptResponse
{
    public Guid TransactionId { get; set; }
    public string PdfBase64 { get; set; } = string.Empty;
}

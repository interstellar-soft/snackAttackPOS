namespace PosBackend.Application.Requests;

public class UpdateCurrencyRateRequest
{
    public decimal Rate { get; set; }
    public string? Notes { get; set; }
}

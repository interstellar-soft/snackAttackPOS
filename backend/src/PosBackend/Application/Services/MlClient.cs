using System.Net.Http.Json;
using Microsoft.Extensions.Configuration;
using System.Text.Json.Serialization;

namespace PosBackend.Application.Services;

public class MlClient
{
    private readonly HttpClient _httpClient;

    public MlClient(HttpClient httpClient, IConfiguration configuration)
    {
        _httpClient = httpClient;
        var baseUrl = configuration.GetValue<string>("MlService:BaseUrl") ?? "http://ml:8001";
        _httpClient.BaseAddress = new Uri(baseUrl.EndsWith('/') ? baseUrl : baseUrl + "/");
    }

    public record AnomalyRequest(string Sku, decimal Price, decimal Quantity);
    public record AnomalyResult(bool IsAnomaly, double Score, string? Reason);

    public record VisionRequest(
        [property: JsonPropertyName("product_id")] string ProductId,
        [property: JsonPropertyName("embedding")] IEnumerable<double> Embedding);

    public record VisionResult(
        [property: JsonPropertyName("predicted_label")] string PredictedLabel,
        [property: JsonPropertyName("confidence")] double Confidence,
        [property: JsonPropertyName("is_match")] bool IsMatch);

    public async Task<AnomalyResult?> PredictAnomalyAsync(AnomalyRequest request, CancellationToken cancellationToken)
    {
        var response = await _httpClient.PostAsJsonAsync("anomaly/predict", request, cancellationToken);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<AnomalyResult>(cancellationToken: cancellationToken);
    }

    public async Task<VisionResult?> PredictVisionAsync(VisionRequest request, CancellationToken cancellationToken)
    {
        var response = await _httpClient.PostAsJsonAsync("vision/predict", request, cancellationToken);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<VisionResult>(cancellationToken: cancellationToken);
    }
}

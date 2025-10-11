using System.Net;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using PosBackend.Application.Exceptions;

namespace PosBackend.Application.Services;

public class MlClient
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<MlClient> _logger;

    public MlClient(HttpClient httpClient, IConfiguration configuration, ILogger<MlClient> logger)
    {
        _httpClient = httpClient;
        _logger = logger;
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
        return await SendRequestAsync<AnomalyResult>("anomaly/predict", request, cancellationToken);
    }

    public async Task<VisionResult?> PredictVisionAsync(VisionRequest request, CancellationToken cancellationToken)
    {
        return await SendRequestAsync<VisionResult>("vision/predict", request, cancellationToken);
    }

    private async Task<TResponse?> SendRequestAsync<TResponse>(string relativeUrl, object request, CancellationToken cancellationToken)
    {
        try
        {
            var response = await _httpClient.PostAsJsonAsync(relativeUrl, request, cancellationToken);
            return await HandleResponseAsync<TResponse>(relativeUrl, response, cancellationToken);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            _logger.LogWarning("ML request to {RelativeUrl} was cancelled.", relativeUrl);
            throw;
        }
        catch (MlClientException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error while calling ML service endpoint {RelativeUrl}.", relativeUrl);
            throw new MlClientException($"Unexpected error while calling ML service endpoint '{relativeUrl}'.", ex);
        }
    }

    private async Task<TResponse?> HandleResponseAsync<TResponse>(string relativeUrl, HttpResponseMessage response, CancellationToken cancellationToken)
    {
        if (response.IsSuccessStatusCode)
        {
            return await response.Content.ReadFromJsonAsync<TResponse>(cancellationToken: cancellationToken);
        }

        var responseContent = await response.Content.ReadAsStringAsync(cancellationToken);
        _logger.LogError(
            "ML service responded with non-success status code {StatusCode} for {RelativeUrl}. Response body: {ResponseBody}",
            (int)response.StatusCode,
            relativeUrl,
            string.IsNullOrWhiteSpace(responseContent) ? "<empty>" : responseContent);

        throw new MlClientException(
            $"ML service responded with status code {(int)response.StatusCode} ({response.StatusCode}) for endpoint '{relativeUrl}'.",
            response.StatusCode,
            responseContent,
            null);
    }
}

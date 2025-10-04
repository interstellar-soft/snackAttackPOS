using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using PosBackend.Application.Services;
using Xunit;

namespace PosBackend.Tests;

public class MlClientTests
{
    [Fact]
    public async Task PredictVisionAsync_SendsSnakeCasePayloadAndParsesResponse()
    {
        string? recordedContent = null;

        var handler = new DelegateHttpMessageHandler(async request =>
        {
            recordedContent = await request.Content!.ReadAsStringAsync();
            var response = new MlClient.VisionResult("apple", 0.87, true);
            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = JsonContent.Create(response)
            };
        });

        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string>
            {
                ["MlService:BaseUrl"] = "http://localhost"
            })
            .Build();

        var client = new MlClient(new HttpClient(handler), configuration);
        var request = new MlClient.VisionRequest("ABC123", new[] { 0.1, 0.2 });

        var result = await client.PredictVisionAsync(request, CancellationToken.None);

        Assert.NotNull(recordedContent);
        using var document = JsonDocument.Parse(recordedContent!);
        var root = document.RootElement;
        Assert.Equal("ABC123", root.GetProperty("product_id").GetString());

        var embedding = root.GetProperty("embedding").EnumerateArray().Select(e => e.GetDouble()).ToArray();
        Assert.Equal(new[] { 0.1, 0.2 }, embedding);

        Assert.NotNull(result);
        Assert.Equal("apple", result!.PredictedLabel);
        Assert.Equal(0.87, result.Confidence);
        Assert.True(result.IsMatch);
    }

    private sealed class DelegateHttpMessageHandler : HttpMessageHandler
    {
        private readonly Func<HttpRequestMessage, Task<HttpResponseMessage>> _handler;

        public DelegateHttpMessageHandler(Func<HttpRequestMessage, Task<HttpResponseMessage>> handler)
        {
            _handler = handler;
        }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            return _handler(request);
        }
    }
}

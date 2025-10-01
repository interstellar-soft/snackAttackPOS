using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PosBackend.Application.Services;

namespace PosBackend.Features.Transactions;

[ApiController]
[Route("api/pos-events")]
[Authorize]
public class PosEventsController : ControllerBase
{
    private readonly PosEventHub _eventHub;

    public PosEventsController(PosEventHub eventHub)
    {
        _eventHub = eventHub;
    }

    [HttpGet("stream")]
    public async Task Stream(CancellationToken cancellationToken)
    {
        Response.Headers.Add("Content-Type", "text/event-stream");
        await foreach (var evt in _eventHub.Reader.ReadAllAsync(cancellationToken))
        {
            var payload = JsonSerializer.Serialize(evt.Payload);
            await Response.WriteAsync($"event: {evt.EventType}\n", cancellationToken);
            await Response.WriteAsync($"data: {payload}\n\n", cancellationToken);
            await Response.Body.FlushAsync(cancellationToken);
        }
    }
}

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PosBackend.Application.Services;
using PosBackend.Features.Common;

namespace PosBackend.Features.Admin;

[ApiController, Route("api/admin/mobile-sync"), Authorize(Roles = "Admin")]
public sealed class MobileSyncController(MobileSyncService sync) : ControllerBase
{
    public record ConnectRequest(string Url, string Code);
    [HttpGet] public async Task<IActionResult> Status(CancellationToken ct) => Ok(await sync.Status(ct));
    [HttpPost("pair")]
    public async Task<IActionResult> Pair(ConnectRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Url) || string.IsNullOrWhiteSpace(request.Code)) return BadRequest(new { message = "URL and pairing code are required." });
        try { await sync.Pair(request.Url, request.Code, User.GetCurrentUserId(), ct); return Ok(await sync.Status(ct)); }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
        catch (HttpRequestException) { return BadRequest(new { message = "Unable to reach the mobile dashboard." }); }
    }
    [HttpDelete] public async Task<IActionResult> Disconnect(CancellationToken ct) { await sync.Disconnect(ct); return NoContent(); }
}

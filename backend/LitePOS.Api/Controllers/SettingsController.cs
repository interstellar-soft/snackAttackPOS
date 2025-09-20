using LitePOS.Api.Data;
using LitePOS.Api.Models.Settings;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LitePOS.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class SettingsController : ControllerBase
{
    private readonly LitePosDbContext _dbContext;

    public SettingsController(LitePosDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    [HttpGet]
    public async Task<ActionResult<StoreSettingDto>> GetSettings()
    {
        var settings = await _dbContext.StoreSettings.AsNoTracking().FirstAsync();
        return Map(settings);
    }

    [HttpPut]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<ActionResult<StoreSettingDto>> UpdateSettings([FromBody] UpdateStoreSettingRequest request)
    {
        var settings = await _dbContext.StoreSettings.FirstAsync();
        settings.StoreName = request.StoreName;
        settings.Currency = request.Currency;
        settings.DefaultTaxRate = request.DefaultTaxRate;
        settings.ReceiptHeader = request.ReceiptHeader;
        settings.ReceiptFooter = request.ReceiptFooter;
        settings.Address = request.Address;
        settings.Phone = request.Phone;
        await _dbContext.SaveChangesAsync();
        return Map(settings);
    }

    private static StoreSettingDto Map(Entities.StoreSetting settings) => new()
    {
        Id = settings.Id,
        StoreName = settings.StoreName,
        Currency = settings.Currency,
        DefaultTaxRate = settings.DefaultTaxRate,
        ReceiptHeader = settings.ReceiptHeader,
        ReceiptFooter = settings.ReceiptFooter,
        Address = settings.Address,
        Phone = settings.Phone
    };
}

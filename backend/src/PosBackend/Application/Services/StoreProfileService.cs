using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using PosBackend.Domain.Entities;
using PosBackend.Infrastructure.Data;

namespace PosBackend.Application.Services;

public class StoreProfileService
{
    private readonly ApplicationDbContext _db;

    public const string DefaultStoreName = "Aurora Market";

    public StoreProfileService(ApplicationDbContext db)
    {
        _db = db;
    }

    public async Task<StoreProfile> GetCurrentAsync(CancellationToken cancellationToken = default)
    {
        var profile = await _db.StoreProfiles.FirstOrDefaultAsync(cancellationToken);
        if (profile is not null)
        {
            return profile;
        }

        profile = new StoreProfile
        {
            Name = DefaultStoreName
        };

        await _db.StoreProfiles.AddAsync(profile, cancellationToken);
        await _db.SaveChangesAsync(cancellationToken);
        return profile;
    }
}

namespace PosBackend.Application.Services;

public class ScanWatchdog
{
    private readonly Dictionary<string, DateTime> _lastScan = new();
    private readonly TimeSpan _threshold = TimeSpan.FromSeconds(5);

    public bool IsRapidRepeat(string userId, string sku)
    {
        var key = $"{userId}:{sku}";
        var now = DateTime.UtcNow;
        if (_lastScan.TryGetValue(key, out var last) && now - last < _threshold)
        {
            _lastScan[key] = now;
            return true;
        }

        _lastScan[key] = now;
        return false;
    }
}

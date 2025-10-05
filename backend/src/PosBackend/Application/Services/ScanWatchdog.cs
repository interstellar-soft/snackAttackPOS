namespace PosBackend.Application.Services;

public class ScanWatchdog
{
    private readonly Dictionary<string, DateTime> _lastScan = new();
    private readonly TimeSpan _threshold = TimeSpan.FromSeconds(5);

    public bool IsRapidRepeat(string userId, string productKey)
    {
        var safeKey = string.IsNullOrWhiteSpace(productKey) ? "unknown" : productKey;
        var key = $"{userId}:{safeKey}";
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

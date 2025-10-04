namespace PosBackend.Application.Responses;

public class ProfitSummaryResponse
{
    public ProfitSeries Daily { get; set; } = new();
    public ProfitSeries Weekly { get; set; } = new();
    public ProfitSeries Monthly { get; set; } = new();
    public ProfitSeries Yearly { get; set; } = new();
}

public class ProfitSeries
{
    public List<ProfitPoint> Points { get; set; } = new();
}

public class ProfitPoint
{
    public DateTime PeriodStart { get; set; }
    public decimal GrossProfitUsd { get; set; }
    public decimal NetProfitUsd { get; set; }
    public decimal RevenueUsd { get; set; }
    public decimal CostUsd { get; set; }
}

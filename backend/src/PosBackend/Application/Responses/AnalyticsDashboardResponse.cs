using System;
using System.Collections.Generic;
using System.Linq;

namespace PosBackend.Application.Responses;

public class AnalyticsDashboardResponse
{
    public IEnumerable<MetricValue> ProfitLeaders { get; set; } = Enumerable.Empty<MetricValue>();
    public IEnumerable<MetricValue> LossLeaders { get; set; } = Enumerable.Empty<MetricValue>();
    public IEnumerable<MetricValue> MarkdownRecovery { get; set; } = Enumerable.Empty<MetricValue>();
    public IEnumerable<MetricValue> CurrencyMix { get; set; } = Enumerable.Empty<MetricValue>();
    public IEnumerable<MetricValue> ChangeIssuance { get; set; } = Enumerable.Empty<MetricValue>();
    public IEnumerable<TimeseriesPoint> DailySales { get; set; } = Enumerable.Empty<TimeseriesPoint>();
    public IEnumerable<MarginPoint> ProfitMargins { get; set; } = Enumerable.Empty<MarginPoint>();
    public IEnumerable<TimeseriesBandPoint> SeasonalForecast { get; set; } = Enumerable.Empty<TimeseriesBandPoint>();
    public IEnumerable<CurrencySplitPoint> CurrencyMixTrend { get; set; } = Enumerable.Empty<CurrencySplitPoint>();
    public IEnumerable<CurrencySplitPoint> ChangeIssuanceTrend { get; set; } = Enumerable.Empty<CurrencySplitPoint>();
}

public class SalesBreakdownResponse
{
    public IEnumerable<SalesMetricValue> TopItems { get; set; } = Enumerable.Empty<SalesMetricValue>();
    public IEnumerable<SalesMetricValue> TopCategories { get; set; } = Enumerable.Empty<SalesMetricValue>();
    public ProductRangeSalesResponse? SelectedProductSales { get; set; }
}

public record MetricValue(string Label, decimal Value);
public record SalesMetricValue(string Label, decimal QuantitySold, decimal SalesUsd);
public record ProductRangeSalesResponse(Guid ProductId, string ProductName, DateOnly StartDate, DateOnly EndDate, decimal QuantitySold, decimal SalesUsd);

public record MarginPoint(string Label, decimal MarginPercent, decimal RevenueUsd);

public record TimeseriesPoint(DateTime Date, decimal Value);

public record TimeseriesBandPoint(DateTime Date, decimal Value, decimal Lower, decimal Upper);

public record CurrencySplitPoint(DateTime Date, decimal Usd, decimal Lbp);

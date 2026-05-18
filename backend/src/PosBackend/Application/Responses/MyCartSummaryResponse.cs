namespace PosBackend.Application.Responses;

public class MyCartSummaryResponse
{
    public DateTime ReferenceDate { get; set; }
    public decimal DailyTotalUsd { get; set; }
    public decimal DailyTotalLbp { get; set; }
    public decimal WeeklyTotalUsd { get; set; }
    public decimal WeeklyTotalLbp { get; set; }
    public decimal MonthlyTotalUsd { get; set; }
    public decimal MonthlyTotalLbp { get; set; }
    public decimal YearlyTotalUsd { get; set; }
    public decimal YearlyTotalLbp { get; set; }
}

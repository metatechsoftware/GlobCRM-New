namespace GlobCRM.Domain.Enums;

/// <summary>
/// Types of dashboard widgets for visual display.
/// Each type determines the rendering component and available configuration options.
/// </summary>
public enum WidgetType
{
    KpiCard,
    BarChart,
    LineChart,
    PieChart,
    Leaderboard,
    Table,
    TargetProgress
}

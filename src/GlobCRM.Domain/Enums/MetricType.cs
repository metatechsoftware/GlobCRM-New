namespace GlobCRM.Domain.Enums;

/// <summary>
/// Types of CRM metrics available for dashboard widgets and KPI targets.
/// Covers Deals, Activities, Quotes, Contacts, Companies, and Requests.
/// </summary>
public enum MetricType
{
    // Deal metrics
    DealCount,
    DealPipelineValue,
    DealsByStage,
    DealsWon,
    DealsLost,
    WinRate,
    AverageDealValue,

    // Activity metrics
    ActivityCount,
    ActivitiesByType,
    ActivitiesByStatus,
    ActivitiesCompleted,
    OverdueActivities,

    // Quote metrics
    QuoteTotal,
    QuotesByStatus,

    // Contact & Company metrics
    ContactsCreated,
    CompaniesCreated,

    // Request metrics
    RequestsByStatus,
    RequestsByPriority,

    // Leaderboard metrics
    SalesLeaderboard,
    ActivityLeaderboard
}

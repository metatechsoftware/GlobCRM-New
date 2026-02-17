using GlobCRM.Domain.Enums;
using GlobCRM.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GlobCRM.Infrastructure.Dashboards;

/// <summary>
/// Result of a metric computation. Contains a numeric value, display label,
/// and optional series data for chart-type widgets.
/// </summary>
public record MetricResult(decimal Value, string Label, List<ChartDataPoint>? Series = null);

/// <summary>
/// A single data point for chart series data.
/// </summary>
public record ChartDataPoint(string Label, decimal Value);

/// <summary>
/// A leaderboard entry for sales/activity ranking.
/// </summary>
public record LeaderboardEntry(Guid UserId, string Name, decimal Value, int Count);

/// <summary>
/// Centralized service for computing all 20 dashboard metrics server-side.
/// Uses EF Core projections (GroupBy/Select/Sum/Count) -- never loads full entities.
/// Respects RBAC ownership scope so users only see permitted data.
/// Scoped service (one instance per request).
/// </summary>
public class DashboardAggregationService
{
    private readonly ApplicationDbContext _db;

    public DashboardAggregationService(ApplicationDbContext db)
    {
        _db = db;
    }

    /// <summary>
    /// Computes a single metric value for the given date range and ownership scope.
    /// The userId/scope/teamMemberIds are resolved by the controller and passed in.
    /// </summary>
    public async Task<MetricResult> ComputeMetricAsync(
        MetricType metric,
        DateTimeOffset start,
        DateTimeOffset end,
        Guid userId,
        PermissionScope scope,
        List<Guid>? teamMemberIds = null)
    {
        return metric switch
        {
            MetricType.DealCount => await ComputeDealCountAsync(start, end, userId, scope, teamMemberIds),
            MetricType.DealPipelineValue => await ComputeDealPipelineValueAsync(start, end, userId, scope, teamMemberIds),
            MetricType.DealsByStage => await ComputeDealsByStageAsync(start, end, userId, scope, teamMemberIds),
            MetricType.DealsWon => await ComputeDealsWonAsync(start, end, userId, scope, teamMemberIds),
            MetricType.DealsLost => await ComputeDealsLostAsync(start, end, userId, scope, teamMemberIds),
            MetricType.WinRate => await ComputeWinRateAsync(start, end, userId, scope, teamMemberIds),
            MetricType.AverageDealValue => await ComputeAverageDealValueAsync(start, end, userId, scope, teamMemberIds),
            MetricType.ActivityCount => await ComputeActivityCountAsync(start, end, userId, scope, teamMemberIds),
            MetricType.ActivitiesByType => await ComputeActivitiesByTypeAsync(start, end, userId, scope, teamMemberIds),
            MetricType.ActivitiesByStatus => await ComputeActivitiesByStatusAsync(start, end, userId, scope, teamMemberIds),
            MetricType.ActivitiesCompleted => await ComputeActivitiesCompletedAsync(start, end, userId, scope, teamMemberIds),
            MetricType.OverdueActivities => await ComputeOverdueActivitiesAsync(userId, scope, teamMemberIds),
            MetricType.QuoteTotal => await ComputeQuoteTotalAsync(start, end, userId, scope, teamMemberIds),
            MetricType.QuotesByStatus => await ComputeQuotesByStatusAsync(start, end, userId, scope, teamMemberIds),
            MetricType.ContactsCreated => await ComputeContactsCreatedAsync(start, end, userId, scope, teamMemberIds),
            MetricType.CompaniesCreated => await ComputeCompaniesCreatedAsync(start, end, userId, scope, teamMemberIds),
            MetricType.RequestsByStatus => await ComputeRequestsByStatusAsync(start, end, userId, scope, teamMemberIds),
            MetricType.RequestsByPriority => await ComputeRequestsByPriorityAsync(start, end, userId, scope, teamMemberIds),
            MetricType.SalesLeaderboard => await ComputeSalesLeaderboardAsync(start, end, userId, scope, teamMemberIds),
            MetricType.ActivityLeaderboard => await ComputeActivityLeaderboardAsync(start, end, userId, scope, teamMemberIds),
            _ => new MetricResult(0, "Unknown")
        };
    }

    /// <summary>
    /// Batch computes multiple metrics in one call to avoid N+1 API calls per widget.
    /// Returns a dictionary mapping each metric type to its computed result.
    /// </summary>
    public async Task<Dictionary<MetricType, MetricResult>> ComputeMetricsAsync(
        List<MetricType> metrics,
        DateTimeOffset start,
        DateTimeOffset end,
        Guid userId,
        PermissionScope scope,
        List<Guid>? teamMemberIds = null)
    {
        var results = new Dictionary<MetricType, MetricResult>();

        foreach (var metric in metrics)
        {
            results[metric] = await ComputeMetricAsync(metric, start, end, userId, scope, teamMemberIds);
        }

        return results;
    }

    // ========== Deal Metrics ==========

    private async Task<MetricResult> ComputeDealCountAsync(
        DateTimeOffset start, DateTimeOffset end, Guid userId, PermissionScope scope, List<Guid>? teamMemberIds)
    {
        var query = ApplyDealScope(_db.Deals.Where(d => d.CreatedAt >= start && d.CreatedAt <= end), userId, scope, teamMemberIds);
        var count = await query.CountAsync();
        return new MetricResult(count, "Deals");
    }

    private async Task<MetricResult> ComputeDealPipelineValueAsync(
        DateTimeOffset start, DateTimeOffset end, Guid userId, PermissionScope scope, List<Guid>? teamMemberIds)
    {
        var query = ApplyDealScope(_db.Deals.Where(d => d.CreatedAt >= start && d.CreatedAt <= end), userId, scope, teamMemberIds);
        var total = await query.SumAsync(d => d.Value ?? 0);
        return new MetricResult(total, "Pipeline Value");
    }

    private async Task<MetricResult> ComputeDealsByStageAsync(
        DateTimeOffset start, DateTimeOffset end, Guid userId, PermissionScope scope, List<Guid>? teamMemberIds)
    {
        var query = ApplyDealScope(
            _db.Deals.Include(d => d.Stage).Where(d => d.CreatedAt >= start && d.CreatedAt <= end),
            userId, scope, teamMemberIds);

        var groups = await query
            .GroupBy(d => d.Stage.Name)
            .Select(g => new { Label = g.Key, Count = g.Count(), Sum = g.Sum(d => d.Value ?? 0) })
            .ToListAsync();

        var series = groups.Select(g => new ChartDataPoint(g.Label, g.Count)).ToList();
        var totalCount = groups.Sum(g => g.Count);
        return new MetricResult(totalCount, "Deals by Stage", series);
    }

    private async Task<MetricResult> ComputeDealsWonAsync(
        DateTimeOffset start, DateTimeOffset end, Guid userId, PermissionScope scope, List<Guid>? teamMemberIds)
    {
        var query = ApplyDealScope(
            _db.Deals.Include(d => d.Stage).Where(d => d.CreatedAt >= start && d.CreatedAt <= end && d.Stage.IsWon),
            userId, scope, teamMemberIds);
        var count = await query.CountAsync();
        return new MetricResult(count, "Deals Won");
    }

    private async Task<MetricResult> ComputeDealsLostAsync(
        DateTimeOffset start, DateTimeOffset end, Guid userId, PermissionScope scope, List<Guid>? teamMemberIds)
    {
        var query = ApplyDealScope(
            _db.Deals.Include(d => d.Stage).Where(d => d.CreatedAt >= start && d.CreatedAt <= end && d.Stage.IsLost),
            userId, scope, teamMemberIds);
        var count = await query.CountAsync();
        return new MetricResult(count, "Deals Lost");
    }

    private async Task<MetricResult> ComputeWinRateAsync(
        DateTimeOffset start, DateTimeOffset end, Guid userId, PermissionScope scope, List<Guid>? teamMemberIds)
    {
        var baseQuery = ApplyDealScope(
            _db.Deals.Include(d => d.Stage).Where(d => d.CreatedAt >= start && d.CreatedAt <= end),
            userId, scope, teamMemberIds);

        var terminalQuery = baseQuery.Where(d => d.Stage.IsWon || d.Stage.IsLost);
        var totalTerminal = await terminalQuery.CountAsync();

        if (totalTerminal == 0)
            return new MetricResult(0, "Win Rate");

        var won = await baseQuery.Where(d => d.Stage.IsWon).CountAsync();
        var winRate = Math.Round((decimal)won / totalTerminal * 100, 1);
        return new MetricResult(winRate, "Win Rate");
    }

    private async Task<MetricResult> ComputeAverageDealValueAsync(
        DateTimeOffset start, DateTimeOffset end, Guid userId, PermissionScope scope, List<Guid>? teamMemberIds)
    {
        var query = ApplyDealScope(
            _db.Deals.Where(d => d.CreatedAt >= start && d.CreatedAt <= end && d.Value != null),
            userId, scope, teamMemberIds);

        var count = await query.CountAsync();
        if (count == 0)
            return new MetricResult(0, "Avg Deal Value");

        var avg = await query.AverageAsync(d => d.Value ?? 0);
        return new MetricResult(Math.Round(avg, 2), "Avg Deal Value");
    }

    // ========== Activity Metrics ==========

    private async Task<MetricResult> ComputeActivityCountAsync(
        DateTimeOffset start, DateTimeOffset end, Guid userId, PermissionScope scope, List<Guid>? teamMemberIds)
    {
        var query = ApplyActivityScope(_db.Activities.Where(a => a.CreatedAt >= start && a.CreatedAt <= end), userId, scope, teamMemberIds);
        var count = await query.CountAsync();
        return new MetricResult(count, "Activities");
    }

    private async Task<MetricResult> ComputeActivitiesByTypeAsync(
        DateTimeOffset start, DateTimeOffset end, Guid userId, PermissionScope scope, List<Guid>? teamMemberIds)
    {
        var query = ApplyActivityScope(_db.Activities.Where(a => a.CreatedAt >= start && a.CreatedAt <= end), userId, scope, teamMemberIds);

        var groups = await query
            .GroupBy(a => a.Type)
            .Select(g => new { Label = g.Key.ToString(), Count = g.Count() })
            .ToListAsync();

        var series = groups.Select(g => new ChartDataPoint(g.Label, g.Count)).ToList();
        var totalCount = groups.Sum(g => g.Count);
        return new MetricResult(totalCount, "Activities by Type", series);
    }

    private async Task<MetricResult> ComputeActivitiesByStatusAsync(
        DateTimeOffset start, DateTimeOffset end, Guid userId, PermissionScope scope, List<Guid>? teamMemberIds)
    {
        var query = ApplyActivityScope(_db.Activities.Where(a => a.CreatedAt >= start && a.CreatedAt <= end), userId, scope, teamMemberIds);

        var groups = await query
            .GroupBy(a => a.Status)
            .Select(g => new { Label = g.Key.ToString(), Count = g.Count() })
            .ToListAsync();

        var series = groups.Select(g => new ChartDataPoint(g.Label, g.Count)).ToList();
        var totalCount = groups.Sum(g => g.Count);
        return new MetricResult(totalCount, "Activities by Status", series);
    }

    private async Task<MetricResult> ComputeActivitiesCompletedAsync(
        DateTimeOffset start, DateTimeOffset end, Guid userId, PermissionScope scope, List<Guid>? teamMemberIds)
    {
        var query = ApplyActivityScope(
            _db.Activities.Where(a => a.Status == ActivityStatus.Done && a.CreatedAt >= start && a.CreatedAt <= end),
            userId, scope, teamMemberIds);
        var count = await query.CountAsync();
        return new MetricResult(count, "Completed");
    }

    private async Task<MetricResult> ComputeOverdueActivitiesAsync(
        Guid userId, PermissionScope scope, List<Guid>? teamMemberIds)
    {
        var now = DateTimeOffset.UtcNow;
        var query = ApplyActivityScope(
            _db.Activities.Where(a => a.DueDate < now && a.Status != ActivityStatus.Done),
            userId, scope, teamMemberIds);
        var count = await query.CountAsync();
        return new MetricResult(count, "Overdue");
    }

    // ========== Quote Metrics ==========

    private async Task<MetricResult> ComputeQuoteTotalAsync(
        DateTimeOffset start, DateTimeOffset end, Guid userId, PermissionScope scope, List<Guid>? teamMemberIds)
    {
        var query = ApplyQuoteScope(_db.Quotes.Where(q => q.CreatedAt >= start && q.CreatedAt <= end), userId, scope, teamMemberIds);
        var total = await query.SumAsync(q => q.GrandTotal);
        return new MetricResult(total, "Quote Total");
    }

    private async Task<MetricResult> ComputeQuotesByStatusAsync(
        DateTimeOffset start, DateTimeOffset end, Guid userId, PermissionScope scope, List<Guid>? teamMemberIds)
    {
        var query = ApplyQuoteScope(_db.Quotes.Where(q => q.CreatedAt >= start && q.CreatedAt <= end), userId, scope, teamMemberIds);

        var groups = await query
            .GroupBy(q => q.Status)
            .Select(g => new { Label = g.Key.ToString(), Count = g.Count() })
            .ToListAsync();

        var series = groups.Select(g => new ChartDataPoint(g.Label, g.Count)).ToList();
        var totalCount = groups.Sum(g => g.Count);
        return new MetricResult(totalCount, "Quotes by Status", series);
    }

    // ========== Contact & Company Metrics ==========

    private async Task<MetricResult> ComputeContactsCreatedAsync(
        DateTimeOffset start, DateTimeOffset end, Guid userId, PermissionScope scope, List<Guid>? teamMemberIds)
    {
        var query = ApplyContactScope(_db.Contacts.Where(c => c.CreatedAt >= start && c.CreatedAt <= end), userId, scope, teamMemberIds);
        var count = await query.CountAsync();
        return new MetricResult(count, "Contacts Created");
    }

    private async Task<MetricResult> ComputeCompaniesCreatedAsync(
        DateTimeOffset start, DateTimeOffset end, Guid userId, PermissionScope scope, List<Guid>? teamMemberIds)
    {
        var query = ApplyCompanyScope(_db.Companies.Where(c => c.CreatedAt >= start && c.CreatedAt <= end), userId, scope, teamMemberIds);
        var count = await query.CountAsync();
        return new MetricResult(count, "Companies Created");
    }

    // ========== Request Metrics ==========

    private async Task<MetricResult> ComputeRequestsByStatusAsync(
        DateTimeOffset start, DateTimeOffset end, Guid userId, PermissionScope scope, List<Guid>? teamMemberIds)
    {
        var query = ApplyRequestScope(_db.Requests.Where(r => r.CreatedAt >= start && r.CreatedAt <= end), userId, scope, teamMemberIds);

        var groups = await query
            .GroupBy(r => r.Status)
            .Select(g => new { Label = g.Key.ToString(), Count = g.Count() })
            .ToListAsync();

        var series = groups.Select(g => new ChartDataPoint(g.Label, g.Count)).ToList();
        var totalCount = groups.Sum(g => g.Count);
        return new MetricResult(totalCount, "Requests by Status", series);
    }

    private async Task<MetricResult> ComputeRequestsByPriorityAsync(
        DateTimeOffset start, DateTimeOffset end, Guid userId, PermissionScope scope, List<Guid>? teamMemberIds)
    {
        var query = ApplyRequestScope(_db.Requests.Where(r => r.CreatedAt >= start && r.CreatedAt <= end), userId, scope, teamMemberIds);

        var groups = await query
            .GroupBy(r => r.Priority)
            .Select(g => new { Label = g.Key.ToString(), Count = g.Count() })
            .ToListAsync();

        var series = groups.Select(g => new ChartDataPoint(g.Label, g.Count)).ToList();
        var totalCount = groups.Sum(g => g.Count);
        return new MetricResult(totalCount, "Requests by Priority", series);
    }

    // ========== Leaderboard Metrics ==========

    private async Task<MetricResult> ComputeSalesLeaderboardAsync(
        DateTimeOffset start, DateTimeOffset end, Guid userId, PermissionScope scope, List<Guid>? teamMemberIds)
    {
        var query = ApplyDealScope(
            _db.Deals.Include(d => d.Stage).Include(d => d.Owner)
                .Where(d => d.Stage.IsWon && d.CreatedAt >= start && d.CreatedAt <= end && d.OwnerId != null),
            userId, scope, teamMemberIds);

        var groups = await query
            .GroupBy(d => new { d.OwnerId, d.Owner!.FirstName, d.Owner.LastName })
            .Select(g => new
            {
                UserId = g.Key.OwnerId!.Value,
                Name = g.Key.FirstName + " " + g.Key.LastName,
                Count = g.Count(),
                TotalValue = g.Sum(d => d.Value ?? 0)
            })
            .OrderByDescending(g => g.TotalValue)
            .ToListAsync();

        var series = groups.Select(g => new ChartDataPoint(g.Name, g.TotalValue)).ToList();
        var totalValue = groups.Sum(g => g.TotalValue);
        return new MetricResult(totalValue, "Sales Leaderboard", series);
    }

    private async Task<MetricResult> ComputeActivityLeaderboardAsync(
        DateTimeOffset start, DateTimeOffset end, Guid userId, PermissionScope scope, List<Guid>? teamMemberIds)
    {
        var query = ApplyActivityScope(
            _db.Activities.Include(a => a.AssignedTo)
                .Where(a => a.Status == ActivityStatus.Done && a.CreatedAt >= start && a.CreatedAt <= end && a.AssignedToId != null),
            userId, scope, teamMemberIds);

        var groups = await query
            .GroupBy(a => new { a.AssignedToId, a.AssignedTo!.FirstName, a.AssignedTo.LastName })
            .Select(g => new
            {
                UserId = g.Key.AssignedToId!.Value,
                Name = g.Key.FirstName + " " + g.Key.LastName,
                Count = g.Count()
            })
            .OrderByDescending(g => g.Count)
            .ToListAsync();

        var series = groups.Select(g => new ChartDataPoint(g.Name, g.Count)).ToList();
        var totalCount = groups.Sum(g => g.Count);
        return new MetricResult(totalCount, "Activity Leaderboard", series);
    }

    // ========== Ownership Scope Helpers ==========

    /// <summary>
    /// Applies ownership scope filtering to Deal queries.
    /// All: no filter. Team: userId + team members. Own: userId only.
    /// </summary>
    private static IQueryable<Domain.Entities.Deal> ApplyDealScope(
        IQueryable<Domain.Entities.Deal> query, Guid userId, PermissionScope scope, List<Guid>? teamMemberIds)
    {
        return scope switch
        {
            PermissionScope.All => query,
            PermissionScope.Team => query.Where(d => d.OwnerId == userId || (teamMemberIds != null && teamMemberIds.Contains(d.OwnerId!.Value))),
            PermissionScope.Own => query.Where(d => d.OwnerId == userId),
            _ => query.Where(_ => false)
        };
    }

    /// <summary>
    /// Applies ownership scope filtering to Activity queries.
    /// Checks both OwnerId and AssignedToId for dual-ownership scope.
    /// </summary>
    private static IQueryable<Domain.Entities.Activity> ApplyActivityScope(
        IQueryable<Domain.Entities.Activity> query, Guid userId, PermissionScope scope, List<Guid>? teamMemberIds)
    {
        return scope switch
        {
            PermissionScope.All => query,
            PermissionScope.Team => query.Where(a =>
                a.OwnerId == userId || a.AssignedToId == userId ||
                (teamMemberIds != null && (teamMemberIds.Contains(a.OwnerId!.Value) || teamMemberIds.Contains(a.AssignedToId!.Value)))),
            PermissionScope.Own => query.Where(a => a.OwnerId == userId || a.AssignedToId == userId),
            _ => query.Where(_ => false)
        };
    }

    /// <summary>
    /// Applies ownership scope filtering to Quote queries.
    /// </summary>
    private static IQueryable<Domain.Entities.Quote> ApplyQuoteScope(
        IQueryable<Domain.Entities.Quote> query, Guid userId, PermissionScope scope, List<Guid>? teamMemberIds)
    {
        return scope switch
        {
            PermissionScope.All => query,
            PermissionScope.Team => query.Where(q => q.OwnerId == userId || (teamMemberIds != null && teamMemberIds.Contains(q.OwnerId!.Value))),
            PermissionScope.Own => query.Where(q => q.OwnerId == userId),
            _ => query.Where(_ => false)
        };
    }

    /// <summary>
    /// Applies ownership scope filtering to Contact queries.
    /// </summary>
    private static IQueryable<Domain.Entities.Contact> ApplyContactScope(
        IQueryable<Domain.Entities.Contact> query, Guid userId, PermissionScope scope, List<Guid>? teamMemberIds)
    {
        return scope switch
        {
            PermissionScope.All => query,
            PermissionScope.Team => query.Where(c => c.OwnerId == userId || (teamMemberIds != null && teamMemberIds.Contains(c.OwnerId!.Value))),
            PermissionScope.Own => query.Where(c => c.OwnerId == userId),
            _ => query.Where(_ => false)
        };
    }

    /// <summary>
    /// Applies ownership scope filtering to Company queries.
    /// </summary>
    private static IQueryable<Domain.Entities.Company> ApplyCompanyScope(
        IQueryable<Domain.Entities.Company> query, Guid userId, PermissionScope scope, List<Guid>? teamMemberIds)
    {
        return scope switch
        {
            PermissionScope.All => query,
            PermissionScope.Team => query.Where(c => c.OwnerId == userId || (teamMemberIds != null && teamMemberIds.Contains(c.OwnerId!.Value))),
            PermissionScope.Own => query.Where(c => c.OwnerId == userId),
            _ => query.Where(_ => false)
        };
    }

    /// <summary>
    /// Applies ownership scope filtering to Request queries.
    /// Checks both OwnerId and AssignedToId for dual-ownership scope.
    /// </summary>
    private static IQueryable<Domain.Entities.Request> ApplyRequestScope(
        IQueryable<Domain.Entities.Request> query, Guid userId, PermissionScope scope, List<Guid>? teamMemberIds)
    {
        return scope switch
        {
            PermissionScope.All => query,
            PermissionScope.Team => query.Where(r =>
                r.OwnerId == userId || r.AssignedToId == userId ||
                (teamMemberIds != null && (teamMemberIds.Contains(r.OwnerId!.Value) || teamMemberIds.Contains(r.AssignedToId!.Value)))),
            PermissionScope.Own => query.Where(r => r.OwnerId == userId || r.AssignedToId == userId),
            _ => query.Where(_ => false)
        };
    }
}

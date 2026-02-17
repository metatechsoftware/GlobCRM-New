using GlobCRM.Domain.Enums;

namespace GlobCRM.Domain.Entities;

/// <summary>
/// A KPI target for tracking progress against a specific metric over a time period.
/// Targets can be personal (OwnerId set) or team-wide (OwnerId null).
/// Triple-layer tenant isolation: TenantId property + global query filter + RLS policy.
/// </summary>
public class Target
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>Tenant (organization) ID for multi-tenancy isolation.</summary>
    public Guid TenantId { get; set; }

    /// <summary>
    /// Owner of this target. Null means team target (visible to all).
    /// Non-null means personal target (specific user's goal).
    /// </summary>
    public Guid? OwnerId { get; set; }

    /// <summary>The CRM metric being tracked (e.g., DealCount, WinRate).</summary>
    public MetricType MetricType { get; set; }

    /// <summary>Time period for target measurement.</summary>
    public TargetPeriod Period { get; set; }

    /// <summary>The target value to achieve.</summary>
    public decimal TargetValue { get; set; }

    /// <summary>Display name for the target.</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>Start of the target tracking period.</summary>
    public DateTimeOffset StartDate { get; set; }

    /// <summary>End of the target tracking period.</summary>
    public DateTimeOffset EndDate { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    // Navigation properties
    public ApplicationUser? Owner { get; set; }
}

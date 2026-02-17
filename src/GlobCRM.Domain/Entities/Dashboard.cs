namespace GlobCRM.Domain.Entities;

/// <summary>
/// A configurable dashboard containing widgets for CRM data visualization.
/// Dashboards can be personal (OwnerId set) or team-wide (OwnerId null).
/// Follows the SavedView ownership pattern for visibility scoping.
/// Triple-layer tenant isolation: TenantId property + global query filter + RLS policy.
/// </summary>
public class Dashboard
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>Tenant (organization) ID for multi-tenancy isolation.</summary>
    public Guid TenantId { get; set; }

    /// <summary>Display name of the dashboard.</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>Optional description of the dashboard purpose.</summary>
    public string? Description { get; set; }

    /// <summary>
    /// Owner of this dashboard. Null means team-wide (admin creates, visible to all).
    /// Non-null means personal (visible only to the owner).
    /// </summary>
    public Guid? OwnerId { get; set; }

    /// <summary>Whether this is the default dashboard for the user/team.</summary>
    public bool IsDefault { get; set; } = false;

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    // Navigation properties
    public ApplicationUser? Owner { get; set; }
    public ICollection<DashboardWidget> Widgets { get; set; } = new List<DashboardWidget>();
}

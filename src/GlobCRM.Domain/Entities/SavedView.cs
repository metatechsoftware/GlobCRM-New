namespace GlobCRM.Domain.Entities;

/// <summary>
/// A user-saved table view configuration with column layout, filters, sorting, and pagination.
/// Views can be personal (OwnerId set) or team-wide (OwnerId null).
/// Team default views are marked with IsTeamDefault.
/// Personal views override team defaults per locked decision.
/// </summary>
public class SavedView
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>Tenant that owns this view.</summary>
    public Guid TenantId { get; set; }

    /// <summary>Entity type this view applies to (e.g., "Contact", "Company").</summary>
    public string EntityType { get; set; } = string.Empty;

    /// <summary>Display name of the view.</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Owner of this view. Null means team-wide (visible to all tenant users).
    /// Non-null means personal (visible only to the owner).
    /// </summary>
    public Guid? OwnerId { get; set; }

    /// <summary>Whether this is the default view for the team. Only one per entity type per tenant.</summary>
    public bool IsTeamDefault { get; set; } = false;

    /// <summary>Column configuration stored as JSONB array.</summary>
    public List<ViewColumn> Columns { get; set; } = new();

    /// <summary>Filter conditions stored as JSONB array.</summary>
    public List<ViewFilter> Filters { get; set; } = new();

    /// <summary>Sort configuration stored as JSONB array.</summary>
    public List<ViewSort> Sorts { get; set; } = new();

    /// <summary>Number of rows per page. Default 25 per research recommendation.</summary>
    public int PageSize { get; set; } = 25;

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    // Navigation properties
    public ApplicationUser? Owner { get; set; }
}

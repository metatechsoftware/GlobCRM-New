namespace GlobCRM.Domain.Entities;

/// <summary>
/// Represents a configurable lead source (e.g., "Website", "Referral", "LinkedIn").
/// Tenant-scoped so each organization can manage their own source list.
/// Triple-layer tenant isolation: TenantId property + global query filter + RLS policy.
/// </summary>
public class LeadSource
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>
    /// Tenant (organization) ID for multi-tenancy isolation.
    /// </summary>
    public Guid TenantId { get; set; }

    /// <summary>
    /// Display name of the source (e.g., "Website", "Referral").
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Position for ordering in dropdowns and lists.
    /// </summary>
    public int SortOrder { get; set; }

    /// <summary>
    /// Whether this source is the default selection for new leads.
    /// </summary>
    public bool IsDefault { get; set; }

    /// <summary>
    /// Marks records created by TenantSeeder for bulk deletion of demo data.
    /// </summary>
    public bool IsSeedData { get; set; } = false;

    // Audit timestamps
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

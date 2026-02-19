namespace GlobCRM.Domain.Entities;

/// <summary>
/// Category for organizing reports into logical groups (e.g., "Sales", "Marketing").
/// Tenant-scoped with unique name constraint per tenant.
///
/// Triple-layer tenant isolation: TenantId property + global query filter + RLS policy.
/// </summary>
public class ReportCategory
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>
    /// Tenant (organization) ID for multi-tenancy isolation.
    /// </summary>
    public Guid TenantId { get; set; }

    /// <summary>
    /// Category name (e.g., "Sales Reports", "Marketing Analytics").
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Optional description of the category.
    /// </summary>
    public string? Description { get; set; }

    /// <summary>
    /// Display order for sorting categories in the UI.
    /// </summary>
    public int SortOrder { get; set; }

    /// <summary>
    /// Marks records created by TenantSeeder for bulk deletion of demo data.
    /// </summary>
    public bool IsSeedData { get; set; } = false;

    /// <summary>
    /// Navigation property: reports in this category.
    /// </summary>
    public List<Report> Reports { get; set; } = [];

    // Audit timestamps
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

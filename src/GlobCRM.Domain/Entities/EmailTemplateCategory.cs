namespace GlobCRM.Domain.Entities;

/// <summary>
/// Represents a category for organizing email templates (e.g., "Sales", "Support", "Marketing").
/// Tenant-scoped with sort order for consistent display ordering.
/// System categories (IsSystem = true) are seeded and cannot be deleted by users.
/// Triple-layer tenant isolation: TenantId property + global query filter + RLS policy.
/// </summary>
public class EmailTemplateCategory
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>
    /// Tenant (organization) ID for multi-tenancy isolation.
    /// </summary>
    public Guid TenantId { get; set; }

    /// <summary>
    /// Display name of the category (e.g., "Sales", "Support").
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Position for ordering in dropdowns and lists.
    /// </summary>
    public int SortOrder { get; set; }

    /// <summary>
    /// Whether this category is system-created (seeded). System categories cannot be deleted.
    /// </summary>
    public bool IsSystem { get; set; }

    /// <summary>
    /// Marks records created by TenantSeeder for bulk deletion of demo data.
    /// </summary>
    public bool IsSeedData { get; set; } = false;

    // Audit timestamps
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    /// <summary>
    /// Navigation property to templates in this category.
    /// </summary>
    public ICollection<EmailTemplate> Templates { get; set; } = new List<EmailTemplate>();
}

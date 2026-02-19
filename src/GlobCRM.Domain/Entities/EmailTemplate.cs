namespace GlobCRM.Domain.Entities;

/// <summary>
/// Represents a reusable email template with Unlayer design state and compiled HTML.
/// Tenant-scoped with optional ownership for RBAC scope filtering and category grouping.
/// Supports Liquid merge fields (via Fluid library) for dynamic content personalization.
/// Triple-layer tenant isolation: TenantId property + global query filter + RLS policy.
/// </summary>
public class EmailTemplate
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>
    /// Tenant (organization) ID for multi-tenancy isolation.
    /// </summary>
    public Guid TenantId { get; set; }

    /// <summary>
    /// Display name of the template (e.g., "Welcome Email", "Follow-up Sequence Step 1").
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Email subject line. Supports Liquid merge fields (e.g., "Hello {{ contact.first_name }}!").
    /// </summary>
    public string? Subject { get; set; }

    /// <summary>
    /// Unlayer editor design JSON state. Stored as JSONB for efficient querying.
    /// Used to restore the visual editor state when editing the template.
    /// </summary>
    public string DesignJson { get; set; } = "{}";

    /// <summary>
    /// Compiled HTML body exported from the Unlayer editor.
    /// This is the rendered output used for actual email sending.
    /// Supports Liquid merge fields for dynamic content.
    /// </summary>
    public string HtmlBody { get; set; } = string.Empty;

    /// <summary>
    /// Optional category FK for organizing templates.
    /// Set to null if the category is deleted (SET NULL on delete).
    /// </summary>
    public Guid? CategoryId { get; set; }

    /// <summary>
    /// Navigation property to the template category.
    /// </summary>
    public EmailTemplateCategory? Category { get; set; }

    /// <summary>
    /// Optional owner FK for RBAC scope-based permission filtering.
    /// Set to null if the owner is deleted (SET NULL on delete).
    /// </summary>
    public Guid? OwnerId { get; set; }

    /// <summary>
    /// Navigation property to the template owner.
    /// </summary>
    public ApplicationUser? Owner { get; set; }

    /// <summary>
    /// Whether this template is shared (visible to all users with permission).
    /// When false, the template is personal and only visible to the owner.
    /// </summary>
    public bool IsShared { get; set; } = true;

    /// <summary>
    /// Marks records created by TenantSeeder for bulk deletion of demo data.
    /// </summary>
    public bool IsSeedData { get; set; } = false;

    // Audit timestamps
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

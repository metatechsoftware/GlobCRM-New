namespace GlobCRM.Domain.Entities;

/// <summary>
/// Reusable workflow template. System templates (IsSystem=true) are prebuilt starting points
/// shown in the template gallery. Tenant users can save custom templates (IsSystem=false)
/// displayed with a "Custom" badge. Applying a template creates a full copy of the definition
/// (no link to original per locked decision).
/// Triple-layer tenant isolation: TenantId property + global query filter + RLS policy.
/// </summary>
public class WorkflowTemplate
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>
    /// Tenant (organization) ID for multi-tenancy isolation.
    /// </summary>
    public Guid TenantId { get; set; }

    /// <summary>
    /// Display name of the template.
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Optional description of the template purpose.
    /// </summary>
    public string? Description { get; set; }

    /// <summary>
    /// Template category: "sales", "engagement", "operational", "custom".
    /// </summary>
    public string Category { get; set; } = string.Empty;

    /// <summary>
    /// The target CRM entity type this template is for.
    /// </summary>
    public string EntityType { get; set; } = string.Empty;

    /// <summary>
    /// Full copy of the workflow definition (same structure as Workflow.Definition).
    /// </summary>
    public WorkflowDefinition Definition { get; set; } = new();

    /// <summary>
    /// True for prebuilt system templates, false for user-saved custom templates.
    /// System templates shown first in gallery; custom templates shown with "Custom" badge.
    /// </summary>
    public bool IsSystem { get; set; } = false;

    /// <summary>
    /// User who created this template (null for system templates).
    /// </summary>
    public Guid? CreatedByUserId { get; set; }

    /// <summary>
    /// Marks records created by TenantSeeder for bulk deletion of demo data.
    /// </summary>
    public bool IsSeedData { get; set; } = false;

    // Audit timestamps
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

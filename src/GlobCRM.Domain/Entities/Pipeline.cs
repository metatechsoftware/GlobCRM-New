namespace GlobCRM.Domain.Entities;

/// <summary>
/// Represents a configurable deal pipeline within a tenant.
/// Pipelines contain ordered stages that deals move through.
/// Tenant-scoped with optional team restriction.
/// Triple-layer tenant isolation: TenantId property + global query filter + RLS policy.
/// </summary>
public class Pipeline
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>
    /// Tenant (organization) ID for multi-tenancy isolation.
    /// </summary>
    public Guid TenantId { get; set; }

    /// <summary>
    /// Display name of the pipeline (e.g., "Sales Pipeline", "Enterprise Pipeline").
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Optional description of the pipeline's purpose or usage.
    /// </summary>
    public string? Description { get; set; }

    /// <summary>
    /// Optional team scope. When set, only team members see this pipeline.
    /// Set to null if the team is deleted (SET NULL on delete).
    /// </summary>
    public Guid? TeamId { get; set; }

    /// <summary>
    /// Navigation property to the optional team scope.
    /// </summary>
    public Team? Team { get; set; }

    /// <summary>
    /// Whether this is the default pipeline for new deals.
    /// Only one pipeline per tenant should be marked as default.
    /// </summary>
    public bool IsDefault { get; set; }

    // Audit timestamps
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    // Navigation: Pipeline has many Stages (one-to-many, cascade delete)
    public ICollection<PipelineStage> Stages { get; set; } = new List<PipelineStage>();

    // Navigation: Pipeline has many Deals (one-to-many, restrict delete)
    public ICollection<Deal> Deals { get; set; } = new List<Deal>();
}

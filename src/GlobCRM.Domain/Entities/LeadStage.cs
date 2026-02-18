namespace GlobCRM.Domain.Entities;

/// <summary>
/// Represents a configurable stage in the lead pipeline.
/// Tenant-scoped with terminal stage flags (IsConverted, IsLost) for pipeline analytics.
/// Simpler than PipelineStage -- no probability, no required fields, no team scoping.
/// Triple-layer tenant isolation: TenantId property + global query filter + RLS policy.
/// </summary>
public class LeadStage
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>
    /// Tenant (organization) ID for multi-tenancy isolation.
    /// </summary>
    public Guid TenantId { get; set; }

    /// <summary>
    /// Display name of the stage (e.g., "New", "Contacted", "Qualified").
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Position of this stage in the pipeline (0-based).
    /// </summary>
    public int SortOrder { get; set; }

    /// <summary>
    /// Hex color code for visual representation in the UI (e.g., "#2196f3").
    /// </summary>
    public string Color { get; set; } = "#1976d2";

    /// <summary>
    /// Whether this stage represents a successfully converted lead (terminal stage).
    /// </summary>
    public bool IsConverted { get; set; }

    /// <summary>
    /// Whether this stage represents a lost lead (terminal stage).
    /// </summary>
    public bool IsLost { get; set; }

    /// <summary>
    /// Marks records created by TenantSeeder for bulk deletion of demo data.
    /// </summary>
    public bool IsSeedData { get; set; } = false;

    // Audit timestamps
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

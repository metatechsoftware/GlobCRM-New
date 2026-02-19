namespace GlobCRM.Domain.Entities;

/// <summary>
/// Audit trail for merge operations. Records which entity was merged,
/// who performed it, what field values were selected, and how many
/// relationships were transferred.
/// </summary>
public class MergeAuditLog
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>
    /// Tenant (organization) ID for multi-tenancy isolation.
    /// </summary>
    public Guid TenantId { get; set; }

    /// <summary>
    /// Entity type that was merged: "Contact" or "Company".
    /// </summary>
    public string EntityType { get; set; } = string.Empty;

    /// <summary>
    /// The surviving record that received the merged data.
    /// </summary>
    public Guid SurvivorId { get; set; }

    /// <summary>
    /// The losing record that was soft-deleted after merge.
    /// </summary>
    public Guid LoserId { get; set; }

    /// <summary>
    /// User who performed the merge operation.
    /// </summary>
    public Guid MergedByUserId { get; set; }

    /// <summary>
    /// Snapshot of field selections — which values were chosen for each field.
    /// Stored as JSONB.
    /// </summary>
    public Dictionary<string, object?> FieldSelections { get; set; } = new();

    /// <summary>
    /// Summary of transferred relationships — count of each entity type transferred.
    /// e.g., { "Deals": 3, "Notes": 5, "Quotes": 1 }. Stored as JSONB.
    /// </summary>
    public Dictionary<string, int> TransferCounts { get; set; } = new();

    /// <summary>
    /// When the merge was performed.
    /// </summary>
    public DateTimeOffset MergedAt { get; set; } = DateTimeOffset.UtcNow;

    // Navigation
    public ApplicationUser? MergedByUser { get; set; }
}

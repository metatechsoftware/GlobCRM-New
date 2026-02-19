namespace GlobCRM.Domain.Entities;

/// <summary>
/// Tenant-scoped configuration for duplicate detection matching rules.
/// Each tenant can have one config per entity type (Contact, Company).
/// Controls auto-detection, similarity threshold, and which fields participate in matching.
/// </summary>
public class DuplicateMatchingConfig
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>
    /// Tenant (organization) ID for multi-tenancy isolation.
    /// </summary>
    public Guid TenantId { get; set; }

    /// <summary>
    /// Entity type this config applies to: "Contact" or "Company".
    /// </summary>
    public string EntityType { get; set; } = string.Empty;

    /// <summary>
    /// Whether auto-detection on create is enabled for this entity type.
    /// </summary>
    public bool AutoDetectionEnabled { get; set; } = true;

    /// <summary>
    /// Similarity threshold 0-100 (default 70). Records scoring above this are flagged as duplicates.
    /// </summary>
    public int SimilarityThreshold { get; set; } = 70;

    /// <summary>
    /// Which fields participate in matching. Stored as JSONB array of field names.
    /// </summary>
    public List<string> MatchingFields { get; set; } = new();

    // Audit timestamps
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

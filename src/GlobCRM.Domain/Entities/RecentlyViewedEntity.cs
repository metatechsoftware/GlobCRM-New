namespace GlobCRM.Domain.Entities;

/// <summary>
/// Tracks recently viewed CRM entities per user for the My Day dashboard.
/// Tenant-scoped with a unique constraint on (tenant, user, entity_type, entity_id) for upsert pattern.
/// Triple-layer tenant isolation: TenantId property + global query filter + RLS policy.
/// </summary>
public class RecentlyViewedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>
    /// Tenant (organization) ID for multi-tenancy isolation.
    /// </summary>
    public Guid TenantId { get; set; }

    /// <summary>
    /// The user who viewed this entity.
    /// </summary>
    public Guid UserId { get; set; }

    /// <summary>
    /// Type of the viewed entity (e.g., "Contact", "Deal", "Company").
    /// </summary>
    public string EntityType { get; set; } = string.Empty;

    /// <summary>
    /// ID of the viewed entity.
    /// </summary>
    public Guid EntityId { get; set; }

    /// <summary>
    /// Denormalized display name of the entity for quick rendering without joins.
    /// </summary>
    public string EntityName { get; set; } = string.Empty;

    /// <summary>
    /// Timestamp of the most recent view. Updated on each subsequent view.
    /// </summary>
    public DateTimeOffset ViewedAt { get; set; } = DateTimeOffset.UtcNow;

    // Navigation properties
    public ApplicationUser? User { get; set; }
}

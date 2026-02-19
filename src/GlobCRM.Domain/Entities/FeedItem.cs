using GlobCRM.Domain.Enums;

namespace GlobCRM.Domain.Entities;

/// <summary>
/// Represents an activity feed entry -- either a system event (auto-generated from CRM actions)
/// or a social post (user-authored team communication).
/// Tenant-scoped with optional entity linking for system events.
/// Triple-layer tenant isolation: TenantId property + global query filter + RLS policy.
/// </summary>
public class FeedItem
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>
    /// Tenant (organization) ID for multi-tenancy isolation.
    /// </summary>
    public Guid TenantId { get; set; }

    /// <summary>
    /// Category of the feed item: SystemEvent or SocialPost.
    /// </summary>
    public FeedItemType Type { get; set; }

    /// <summary>
    /// Text content for social posts, or description for system events.
    /// </summary>
    public string Content { get; set; } = string.Empty;

    /// <summary>
    /// Optional entity type for system events linking to source entity (e.g., "Deal", "Contact").
    /// </summary>
    public string? EntityType { get; set; }

    /// <summary>
    /// Optional entity ID for system events linking to the source entity.
    /// </summary>
    public Guid? EntityId { get; set; }

    /// <summary>
    /// Denormalized display name of the linked entity (for hover tooltips without extra API call).
    /// Populated at feed item creation time. May become stale if entity is renamed.
    /// </summary>
    public string? EntityName { get; set; }

    /// <summary>
    /// The user who authored this feed item (post author or action performer).
    /// Set to null if the author is deleted (SET NULL on delete).
    /// </summary>
    public Guid? AuthorId { get; set; }

    // Audit timestamps
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    // Navigation properties
    public ApplicationUser? Author { get; set; }
    public ICollection<FeedComment> Comments { get; set; } = new List<FeedComment>();
}

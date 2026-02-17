using GlobCRM.Domain.Enums;

namespace GlobCRM.Domain.Entities;

/// <summary>
/// Represents an in-app notification for a user.
/// Notifications are tenant-scoped with read tracking and optional entity linking.
/// Triple-layer tenant isolation: TenantId property + global query filter + RLS policy.
/// </summary>
public class Notification
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>
    /// Tenant (organization) ID for multi-tenancy isolation.
    /// </summary>
    public Guid TenantId { get; set; }

    /// <summary>
    /// The user who should receive this notification.
    /// Nullable to support SET NULL on delete when user is removed.
    /// </summary>
    public Guid? UserId { get; set; }

    /// <summary>
    /// Category of the notification for filtering and preference matching.
    /// </summary>
    public NotificationType Type { get; set; }

    /// <summary>
    /// Short display title for the notification (e.g., "New activity assigned").
    /// </summary>
    public string Title { get; set; } = string.Empty;

    /// <summary>
    /// Detailed notification message with context.
    /// </summary>
    public string Message { get; set; } = string.Empty;

    /// <summary>
    /// Optional entity type for deep linking (e.g., "Deal", "Activity").
    /// </summary>
    public string? EntityType { get; set; }

    /// <summary>
    /// Optional entity ID for deep linking to the source entity.
    /// </summary>
    public Guid? EntityId { get; set; }

    /// <summary>
    /// Whether the user has read this notification.
    /// </summary>
    public bool IsRead { get; set; } = false;

    /// <summary>
    /// Timestamp when the notification was marked as read. Null if unread.
    /// </summary>
    public DateTimeOffset? ReadAt { get; set; }

    /// <summary>
    /// Timestamp when the notification was created.
    /// </summary>
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    /// <summary>
    /// The user who triggered this notification (e.g., who assigned the activity).
    /// Set to null if the triggering user is deleted (SET NULL on delete).
    /// </summary>
    public Guid? CreatedById { get; set; }

    // Navigation properties
    public ApplicationUser? User { get; set; }
    public ApplicationUser? CreatedBy { get; set; }
}

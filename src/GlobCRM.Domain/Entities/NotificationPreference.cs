using GlobCRM.Domain.Enums;

namespace GlobCRM.Domain.Entities;

/// <summary>
/// Represents a user's notification delivery preferences per notification type.
/// Controls which channels (in-app, email) are enabled for each notification category.
/// Unique constraint on (TenantId, UserId, NotificationType) ensures one preference per type per user.
/// Triple-layer tenant isolation: TenantId property + global query filter + RLS policy.
/// </summary>
public class NotificationPreference
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>
    /// Tenant (organization) ID for multi-tenancy isolation.
    /// </summary>
    public Guid TenantId { get; set; }

    /// <summary>
    /// The user this preference belongs to.
    /// Cascade delete: preferences are removed when user is deleted.
    /// </summary>
    public Guid UserId { get; set; }

    /// <summary>
    /// The notification type this preference controls.
    /// </summary>
    public NotificationType NotificationType { get; set; }

    /// <summary>
    /// Whether in-app notifications are enabled for this type.
    /// </summary>
    public bool InAppEnabled { get; set; } = true;

    /// <summary>
    /// Whether email notifications are enabled for this type.
    /// </summary>
    public bool EmailEnabled { get; set; } = true;

    // Navigation property
    public ApplicationUser? User { get; set; }
}

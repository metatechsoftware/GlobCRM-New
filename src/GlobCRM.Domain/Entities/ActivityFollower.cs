namespace GlobCRM.Domain.Entities;

/// <summary>
/// Represents a user following an activity for notifications/updates.
/// Composite PK on (ActivityId, UserId) -- no separate Id column.
/// Child entity -- inherits tenant isolation via Activity FK (no TenantId).
/// </summary>
public class ActivityFollower
{
    /// <summary>
    /// Activity being followed.
    /// </summary>
    public Guid ActivityId { get; set; }

    /// <summary>
    /// Navigation property to the followed activity.
    /// </summary>
    public Activity Activity { get; set; } = null!;

    /// <summary>
    /// User who is following the activity.
    /// </summary>
    public Guid UserId { get; set; }

    /// <summary>
    /// Navigation property to the following user.
    /// </summary>
    public ApplicationUser User { get; set; } = null!;

    /// <summary>
    /// Timestamp when the user started following the activity.
    /// </summary>
    public DateTimeOffset FollowedAt { get; set; } = DateTimeOffset.UtcNow;
}

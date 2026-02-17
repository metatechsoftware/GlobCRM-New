using GlobCRM.Domain.Enums;

namespace GlobCRM.Domain.Entities;

/// <summary>
/// Audit trail entry recording an activity's status transition.
/// Tracks which status the activity moved from/to, who made the change, and when.
/// Child entity -- inherits tenant isolation via Activity FK (no TenantId).
/// Follows DealStageHistory pattern.
/// </summary>
public class ActivityStatusHistory
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>
    /// Activity that transitioned statuses.
    /// </summary>
    public Guid ActivityId { get; set; }

    /// <summary>
    /// Navigation property to the activity.
    /// </summary>
    public Activity Activity { get; set; } = null!;

    /// <summary>
    /// Status the activity moved from.
    /// </summary>
    public ActivityStatus FromStatus { get; set; }

    /// <summary>
    /// Status the activity moved to.
    /// </summary>
    public ActivityStatus ToStatus { get; set; }

    /// <summary>
    /// User who performed the status change. Null if system-initiated.
    /// Set to null if the user is deleted (SET NULL on delete).
    /// </summary>
    public Guid? ChangedByUserId { get; set; }

    /// <summary>
    /// Navigation property to the user who made the change.
    /// </summary>
    public ApplicationUser? ChangedByUser { get; set; }

    /// <summary>
    /// Timestamp when the status transition occurred.
    /// </summary>
    public DateTimeOffset ChangedAt { get; set; } = DateTimeOffset.UtcNow;
}

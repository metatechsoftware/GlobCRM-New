namespace GlobCRM.Domain.Entities;

/// <summary>
/// Represents a time tracking entry on an activity.
/// Child entity -- inherits tenant isolation via Activity FK (no TenantId).
/// </summary>
public class ActivityTimeEntry
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>
    /// Activity this time entry belongs to.
    /// </summary>
    public Guid ActivityId { get; set; }

    /// <summary>
    /// Navigation property to the parent activity.
    /// </summary>
    public Activity Activity { get; set; } = null!;

    /// <summary>
    /// Duration of work in minutes.
    /// </summary>
    public decimal DurationMinutes { get; set; }

    /// <summary>
    /// Optional description of work performed.
    /// </summary>
    public string? Description { get; set; }

    /// <summary>
    /// Date the work was performed.
    /// </summary>
    public DateOnly EntryDate { get; set; }

    /// <summary>
    /// User who logged the time. Null if the user is deleted (SET NULL on delete).
    /// </summary>
    public Guid? UserId { get; set; }

    /// <summary>
    /// Navigation property to the user who logged time.
    /// </summary>
    public ApplicationUser? User { get; set; }

    /// <summary>
    /// Timestamp when the time entry was created.
    /// </summary>
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

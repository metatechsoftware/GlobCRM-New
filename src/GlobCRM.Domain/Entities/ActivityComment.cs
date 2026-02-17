namespace GlobCRM.Domain.Entities;

/// <summary>
/// Represents a comment on an activity.
/// Child entity -- inherits tenant isolation via Activity FK (no TenantId).
/// </summary>
public class ActivityComment
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>
    /// Activity this comment belongs to.
    /// </summary>
    public Guid ActivityId { get; set; }

    /// <summary>
    /// Navigation property to the parent activity.
    /// </summary>
    public Activity Activity { get; set; } = null!;

    /// <summary>
    /// Text content of the comment.
    /// </summary>
    public string Content { get; set; } = string.Empty;

    /// <summary>
    /// User who authored the comment. Null if the user is deleted (SET NULL on delete).
    /// </summary>
    public Guid? AuthorId { get; set; }

    /// <summary>
    /// Navigation property to the comment author.
    /// </summary>
    public ApplicationUser? Author { get; set; }

    // Audit timestamps
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

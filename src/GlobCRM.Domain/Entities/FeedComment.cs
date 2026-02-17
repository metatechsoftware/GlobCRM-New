namespace GlobCRM.Domain.Entities;

/// <summary>
/// Represents a comment on a feed item.
/// Child entity of FeedItem -- no TenantId (inherits tenant isolation via FeedItem FK).
/// Cascade delete: comments are removed when parent feed item is deleted.
/// </summary>
public class FeedComment
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>
    /// Parent feed item this comment belongs to.
    /// Cascade delete on FeedItem deletion.
    /// </summary>
    public Guid FeedItemId { get; set; }

    /// <summary>
    /// Text content of the comment.
    /// </summary>
    public string Content { get; set; } = string.Empty;

    /// <summary>
    /// The user who authored this comment.
    /// Set to null if the author is deleted (SET NULL on delete).
    /// </summary>
    public Guid? AuthorId { get; set; }

    // Audit timestamps
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    // Navigation properties
    public FeedItem? FeedItem { get; set; }
    public ApplicationUser? Author { get; set; }
}

namespace GlobCRM.Domain.Entities;

/// <summary>
/// A comment on a Kanban card, supporting threaded replies via ParentCommentId.
/// Child entity of KanbanCard — inherits tenant isolation via Card -> Column -> Board chain (no TenantId).
/// Follows the FeedComment/ActivityComment pattern for author handling.
/// </summary>
public class KanbanCardComment
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>Parent card this comment belongs to. Cascade delete on card deletion.</summary>
    public Guid CardId { get; set; }

    /// <summary>Text content of the comment.</summary>
    public string Content { get; set; } = string.Empty;

    /// <summary>
    /// The user who authored this comment. Set to null if the author is deleted (SET NULL on delete).
    /// </summary>
    public Guid? AuthorId { get; set; }

    /// <summary>
    /// Optional parent comment ID for threading. Null for top-level comments.
    /// Restrict delete to prevent cascade cycles (parent comment cannot be deleted if it has replies).
    /// </summary>
    public Guid? ParentCommentId { get; set; }

    // Audit timestamps
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    // Navigation properties
    public KanbanCard Card { get; set; } = null!;
    public ApplicationUser? Author { get; set; }
    public KanbanCardComment? ParentComment { get; set; }
    public ICollection<KanbanCardComment> Replies { get; set; } = new List<KanbanCardComment>();
}

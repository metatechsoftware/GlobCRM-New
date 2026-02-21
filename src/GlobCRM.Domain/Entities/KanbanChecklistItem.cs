namespace GlobCRM.Domain.Entities;

/// <summary>
/// A checklist item within a Kanban card for tracking sub-tasks.
/// Child entity of KanbanCard — inherits tenant isolation via Card -> Column -> Board chain (no TenantId).
/// Uses double-based SortOrder for flexible reordering.
/// </summary>
public class KanbanChecklistItem
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>Parent card this checklist item belongs to. Cascade delete on card deletion.</summary>
    public Guid CardId { get; set; }

    /// <summary>Text description of the checklist item.</summary>
    public string Text { get; set; } = string.Empty;

    /// <summary>Whether this checklist item is completed.</summary>
    public bool IsChecked { get; set; } = false;

    /// <summary>Float-based sort order for flexible reordering within the checklist.</summary>
    public double SortOrder { get; set; }

    // Audit timestamps
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    // Navigation properties
    public KanbanCard Card { get; set; } = null!;
}

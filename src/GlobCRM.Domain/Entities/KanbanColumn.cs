namespace GlobCRM.Domain.Entities;

/// <summary>
/// A column within a Kanban board representing a workflow stage.
/// Child entity of KanbanBoard — inherits tenant isolation via BoardId FK (no TenantId).
/// Uses double-based SortOrder for float-point insertion between existing columns.
/// </summary>
public class KanbanColumn
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>Parent board this column belongs to. Cascade delete on board deletion.</summary>
    public Guid BoardId { get; set; }

    /// <summary>Display name of the column (e.g., "To Do", "In Progress", "Done").</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Float-based sort order for flexible insertion between existing columns.
    /// New columns inserted between two others get the midpoint value.
    /// </summary>
    public double SortOrder { get; set; }

    /// <summary>
    /// Optional work-in-progress limit. Null means no limit.
    /// When set, the UI highlights the column when card count exceeds this value.
    /// </summary>
    public int? WipLimit { get; set; }

    /// <summary>Optional hex color for column accent.</summary>
    public string? Color { get; set; }

    /// <summary>Whether the column is visually collapsed in the board view.</summary>
    public bool IsCollapsed { get; set; } = false;

    // Audit timestamps
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    // Navigation properties
    public KanbanBoard Board { get; set; } = null!;
    public ICollection<KanbanCard> Cards { get; set; } = new List<KanbanCard>();
}

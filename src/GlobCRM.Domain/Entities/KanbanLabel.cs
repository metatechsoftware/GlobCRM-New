namespace GlobCRM.Domain.Entities;

/// <summary>
/// A label defined at the board level for categorizing cards.
/// Child entity of KanbanBoard — inherits tenant isolation via BoardId FK (no TenantId).
/// Labels are board-scoped: each board has its own set of labels.
/// </summary>
public class KanbanLabel
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>Parent board this label belongs to. Cascade delete on board deletion.</summary>
    public Guid BoardId { get; set; }

    /// <summary>Display name of the label (e.g., "Bug", "Feature", "Urgent").</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>Hex color for the label. Defaults to the CRM orange accent color.</summary>
    public string Color { get; set; } = "#F97316";

    // Audit timestamps
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    // Navigation properties
    public KanbanBoard Board { get; set; } = null!;
    public ICollection<KanbanCardLabel> CardLabels { get; set; } = new List<KanbanCardLabel>();
}

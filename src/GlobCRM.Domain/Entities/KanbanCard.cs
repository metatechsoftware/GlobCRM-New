namespace GlobCRM.Domain.Entities;

/// <summary>
/// A card within a Kanban column representing a work item.
/// Child entity of KanbanColumn — inherits tenant isolation via Column -> Board chain (no TenantId).
/// Supports polymorphic entity linking (same pattern as Note) for connecting cards to CRM entities.
/// Uses double-based SortOrder for float-point insertion between existing cards.
/// </summary>
public class KanbanCard
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>Parent column this card belongs to. Cascade delete on column deletion.</summary>
    public Guid ColumnId { get; set; }

    /// <summary>Card title / subject line.</summary>
    public string Title { get; set; } = string.Empty;

    /// <summary>Optional rich text description (HTML from rich text editor).</summary>
    public string? Description { get; set; }

    /// <summary>Optional due date for the card.</summary>
    public DateTimeOffset? DueDate { get; set; }

    /// <summary>
    /// Float-based sort order for flexible insertion between existing cards within a column.
    /// </summary>
    public double SortOrder { get; set; }

    /// <summary>Whether the card is archived (hidden from the board view by default).</summary>
    public bool IsArchived { get; set; } = false;

    /// <summary>
    /// Type of the linked CRM entity (e.g., "Company", "Contact", "Deal").
    /// Null when the card is not linked to any entity.
    /// </summary>
    public string? LinkedEntityType { get; set; }

    /// <summary>ID of the linked CRM entity. Null when no entity is linked.</summary>
    public Guid? LinkedEntityId { get; set; }

    /// <summary>Denormalized display name of the linked entity for quick rendering.</summary>
    public string? LinkedEntityName { get; set; }

    // Audit timestamps
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    // Navigation properties
    public KanbanColumn Column { get; set; } = null!;
    public ICollection<KanbanCardAssignee> Assignees { get; set; } = new List<KanbanCardAssignee>();
    public ICollection<KanbanCardLabel> Labels { get; set; } = new List<KanbanCardLabel>();
    public ICollection<KanbanChecklistItem> ChecklistItems { get; set; } = new List<KanbanChecklistItem>();
    public ICollection<KanbanCardComment> Comments { get; set; } = new List<KanbanCardComment>();
}

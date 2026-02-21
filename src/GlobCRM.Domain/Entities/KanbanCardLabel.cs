namespace GlobCRM.Domain.Entities;

/// <summary>
/// Join table linking KanbanCard to KanbanLabel (many-to-many).
/// No TenantId — inherits tenant isolation via Label -> Board chain.
/// Composite primary key: (CardId, LabelId).
/// </summary>
public class KanbanCardLabel
{
    /// <summary>The card this label is applied to.</summary>
    public Guid CardId { get; set; }

    /// <summary>The label applied to the card.</summary>
    public Guid LabelId { get; set; }

    // Navigation properties
    public KanbanCard Card { get; set; } = null!;
    public KanbanLabel Label { get; set; } = null!;
}

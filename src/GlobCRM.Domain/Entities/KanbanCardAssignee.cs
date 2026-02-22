namespace GlobCRM.Domain.Entities;

/// <summary>
/// Join table linking KanbanCard to ApplicationUser (many-to-many assignees).
/// No TenantId — inherits tenant isolation via Card -> Column -> Board chain.
/// Composite primary key: (CardId, UserId).
/// </summary>
public class KanbanCardAssignee
{
    /// <summary>The card this user is assigned to.</summary>
    public Guid CardId { get; set; }

    /// <summary>The user assigned to the card.</summary>
    public Guid UserId { get; set; }

    // Navigation properties
    public KanbanCard Card { get; set; } = null!;
    public ApplicationUser User { get; set; } = null!;
}

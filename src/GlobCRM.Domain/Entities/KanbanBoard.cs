using GlobCRM.Domain.Enums;

namespace GlobCRM.Domain.Entities;

/// <summary>
/// A free-form Kanban board for organizing work items into columns and cards.
/// Boards are tenant-scoped with visibility levels (Private, Team, Public).
/// Follows the Dashboard ownership pattern for visibility scoping.
/// Triple-layer tenant isolation: TenantId property + global query filter + RLS policy.
/// </summary>
public class KanbanBoard
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>Tenant (organization) ID for multi-tenancy isolation.</summary>
    public Guid TenantId { get; set; }

    /// <summary>Display name of the board.</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>Optional description of the board's purpose.</summary>
    public string? Description { get; set; }

    /// <summary>Optional hex color for board accent (e.g., "#F97316").</summary>
    public string? Color { get; set; }

    /// <summary>
    /// Visibility level: Private (creator only), Team (team members), Public (all tenant users).
    /// </summary>
    public BoardVisibility Visibility { get; set; } = BoardVisibility.Private;

    /// <summary>
    /// The user who created this board. Set to null if the creator is deleted (SET NULL on delete).
    /// </summary>
    public Guid CreatorId { get; set; }

    /// <summary>
    /// Required when Visibility == Team. The team whose members can access this board.
    /// Set to null if the team is deleted (SET NULL on delete).
    /// </summary>
    public Guid? TeamId { get; set; }

    // Audit timestamps
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    /// <summary>Flag for tenant seeder-generated data.</summary>
    public bool IsSeedData { get; set; }

    // Navigation properties
    public ApplicationUser? Creator { get; set; }
    public Team? Team { get; set; }
    public ICollection<KanbanColumn> Columns { get; set; } = new List<KanbanColumn>();
    public ICollection<KanbanLabel> Labels { get; set; } = new List<KanbanLabel>();
}

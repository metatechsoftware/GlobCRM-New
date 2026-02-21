namespace GlobCRM.Domain.Enums;

/// <summary>
/// Controls who can see and access a Kanban board.
/// </summary>
public enum BoardVisibility
{
    /// <summary>Only the board creator can see and manage the board.</summary>
    Private,

    /// <summary>All members of the assigned team can see and manage the board.</summary>
    Team,

    /// <summary>All users within the tenant can see the board.</summary>
    Public
}

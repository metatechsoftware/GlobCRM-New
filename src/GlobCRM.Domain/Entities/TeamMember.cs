namespace GlobCRM.Domain.Entities;

/// <summary>
/// Represents membership of a user in a team.
/// Child record of Team -- inherits tenant isolation through the parent Team FK.
/// </summary>
public class TeamMember
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>
    /// Foreign key to the parent Team.
    /// </summary>
    public Guid TeamId { get; set; }

    /// <summary>
    /// Foreign key to the user who is a member of the team.
    /// </summary>
    public Guid UserId { get; set; }

    // Navigation properties
    public Team Team { get; set; } = null!;
    public ApplicationUser User { get; set; } = null!;
}

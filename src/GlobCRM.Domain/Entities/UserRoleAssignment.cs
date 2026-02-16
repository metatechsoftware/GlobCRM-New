namespace GlobCRM.Domain.Entities;

/// <summary>
/// Represents a direct assignment of a role to a user.
/// Child record -- inherits tenant isolation through the parent Role FK.
/// A user can have multiple role assignments; permissions are merged using "most permissive wins".
/// </summary>
public class UserRoleAssignment
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>
    /// Foreign key to the user receiving the role.
    /// </summary>
    public Guid UserId { get; set; }

    /// <summary>
    /// Foreign key to the assigned role.
    /// </summary>
    public Guid RoleId { get; set; }

    // Navigation properties
    public ApplicationUser User { get; set; } = null!;
    public Role Role { get; set; } = null!;
}

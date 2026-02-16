namespace GlobCRM.Domain.Entities;

/// <summary>
/// Represents a team within a tenant organization.
/// Teams group users together for permission scoping (Team-level access).
/// A team can have a default role that all members inherit.
/// </summary>
public class Team
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>
    /// Tenant (organization) ID for multi-tenancy isolation.
    /// </summary>
    public Guid TenantId { get; set; }

    /// <summary>
    /// Display name of the team. Unique within a tenant.
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Optional description of the team's purpose.
    /// </summary>
    public string? Description { get; set; }

    /// <summary>
    /// Optional default role inherited by all team members.
    /// Set to null if the role is deleted (SET NULL on delete).
    /// </summary>
    public Guid? DefaultRoleId { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    // Navigation properties
    public Organization Organization { get; set; } = null!;
    public Role? DefaultRole { get; set; }
    public ICollection<TeamMember> Members { get; set; } = new List<TeamMember>();
}

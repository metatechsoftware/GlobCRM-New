using GlobCRM.Domain.Enums;

namespace GlobCRM.Domain.Entities;

/// <summary>
/// Represents a per-entity CRUD permission with ownership scope.
/// Each entry grants a role a specific operation on an entity type
/// with a defined scope (None, Own, Team, All).
/// </summary>
public class RolePermission
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>
    /// Foreign key to the parent Role.
    /// </summary>
    public Guid RoleId { get; set; }

    /// <summary>
    /// The entity type this permission applies to (e.g., "Contact", "Deal").
    /// Stored as string for flexibility with future entity types.
    /// </summary>
    public string EntityType { get; set; } = string.Empty;

    /// <summary>
    /// The CRUD operation (e.g., "View", "Create", "Edit", "Delete").
    /// </summary>
    public string Operation { get; set; } = string.Empty;

    /// <summary>
    /// The ownership scope for this permission.
    /// Determines which records the user can access for this operation.
    /// </summary>
    public PermissionScope Scope { get; set; }

    // Navigation properties
    public Role Role { get; set; } = null!;
}

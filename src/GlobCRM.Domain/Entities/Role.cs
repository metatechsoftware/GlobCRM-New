namespace GlobCRM.Domain.Entities;

/// <summary>
/// Represents a custom role within a tenant organization.
/// Roles define sets of per-entity CRUD permissions with ownership scope
/// and optional field-level access controls.
/// </summary>
public class Role
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>
    /// Tenant (organization) ID for multi-tenancy isolation.
    /// </summary>
    public Guid TenantId { get; set; }

    /// <summary>
    /// Display name of the role (e.g., "Sales Manager", "Support Agent").
    /// Unique within a tenant.
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Optional description of the role's purpose and permissions.
    /// </summary>
    public string? Description { get; set; }

    /// <summary>
    /// Whether this is a built-in system role that cannot be deleted.
    /// System roles are created during tenant setup (e.g., "Admin", "Member").
    /// </summary>
    public bool IsSystem { get; set; } = false;

    /// <summary>
    /// Whether this role serves as a clonable template for creating new roles.
    /// Template roles provide a starting point that admins can customize.
    /// </summary>
    public bool IsTemplate { get; set; } = false;

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    // Navigation properties
    public Organization Organization { get; set; } = null!;
    public ICollection<RolePermission> Permissions { get; set; } = new List<RolePermission>();
    public ICollection<RoleFieldPermission> FieldPermissions { get; set; } = new List<RoleFieldPermission>();
}

using GlobCRM.Domain.Enums;

namespace GlobCRM.Domain.Entities;

/// <summary>
/// Represents field-level access control for a specific entity type within a role.
/// Allows fine-grained control over which fields a user can see or edit.
/// </summary>
public class RoleFieldPermission
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>
    /// Foreign key to the parent Role.
    /// </summary>
    public Guid RoleId { get; set; }

    /// <summary>
    /// The entity type this field permission applies to (e.g., "Contact", "Deal").
    /// Stored as string for flexibility with future entity types.
    /// </summary>
    public string EntityType { get; set; } = string.Empty;

    /// <summary>
    /// The field name this permission controls.
    /// Can be a core field name (e.g., "Email") or a custom field ID as string.
    /// </summary>
    public string FieldName { get; set; } = string.Empty;

    /// <summary>
    /// The access level for this field (Hidden, ReadOnly, Editable).
    /// Defaults to Editable for backwards compatibility.
    /// </summary>
    public FieldAccessLevel AccessLevel { get; set; } = FieldAccessLevel.Editable;

    // Navigation properties
    public Role Role { get; set; } = null!;
}

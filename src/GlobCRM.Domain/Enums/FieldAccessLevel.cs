namespace GlobCRM.Domain.Enums;

/// <summary>
/// Defines the access level for a specific field within an entity type.
/// Used by RoleFieldPermission to control field-level visibility and editability.
/// </summary>
public enum FieldAccessLevel : short
{
    /// <summary>Field is not visible to the user.</summary>
    Hidden = 0,

    /// <summary>Field is visible but cannot be edited.</summary>
    ReadOnly = 1,

    /// <summary>Field is visible and editable.</summary>
    Editable = 2
}

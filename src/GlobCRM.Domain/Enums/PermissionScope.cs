namespace GlobCRM.Domain.Enums;

/// <summary>
/// Defines the scope of a CRUD permission on an entity type.
/// Values are ordered so that Max() returns the most permissive scope,
/// enabling "most permissive wins" resolution when a user has multiple roles.
/// </summary>
public enum PermissionScope : short
{
    /// <summary>No access to this operation.</summary>
    None = 0,

    /// <summary>Access only to records owned by the user.</summary>
    Own = 1,

    /// <summary>Access to records owned by the user or any team member.</summary>
    Team = 2,

    /// <summary>Access to all records within the tenant.</summary>
    All = 3
}

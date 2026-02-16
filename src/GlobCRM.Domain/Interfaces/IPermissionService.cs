using GlobCRM.Domain.Enums;

namespace GlobCRM.Domain.Interfaces;

/// <summary>
/// Effective permission resolved from unioning all roles (direct + team-inherited).
/// Uses "most permissive wins" strategy.
/// </summary>
public record EffectivePermission(string EntityType, string Operation, PermissionScope Scope);

/// <summary>
/// Service for resolving effective permissions from direct roles and team-inherited roles.
/// Implements "most permissive wins" conflict resolution with caching.
/// </summary>
public interface IPermissionService
{
    /// <summary>
    /// Gets the effective permission for a user on a specific entity type and operation.
    /// Resolves by unioning all roles (direct + team-inherited) and returning the most permissive scope.
    /// Results are cached for 5 minutes.
    /// </summary>
    Task<EffectivePermission> GetEffectivePermissionAsync(Guid userId, string entityType, string operation);

    /// <summary>
    /// Gets all effective permissions for a user across all entity types and operations.
    /// Used by the frontend to load the complete permission map.
    /// Results are cached for 5 minutes.
    /// </summary>
    Task<IReadOnlyList<EffectivePermission>> GetAllPermissionsAsync(Guid userId);

    /// <summary>
    /// Gets the field access level for a user on a specific entity type and field.
    /// Resolves by unioning all roles and returning the most permissive access level.
    /// Defaults to Editable if no field permissions are defined.
    /// </summary>
    Task<FieldAccessLevel> GetFieldAccessLevelAsync(Guid userId, string entityType, string fieldName);

    /// <summary>
    /// Invalidates all cached permissions for a user.
    /// Should be called when user roles, team memberships, or role permissions change.
    /// </summary>
    void InvalidateUserPermissions(Guid userId);
}

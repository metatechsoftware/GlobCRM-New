using GlobCRM.Domain.Enums;
using GlobCRM.Domain.Interfaces;
using GlobCRM.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace GlobCRM.Infrastructure.Authorization;

/// <summary>
/// Resolves effective permissions by unioning all roles (direct + team-inherited)
/// and applying "most permissive wins" conflict resolution.
/// Results are cached in IMemoryCache with a 5-minute TTL.
///
/// Per research pitfall #2: uses a single query to load all role IDs to avoid N+1.
/// Per research pitfall #1: 5-minute cache TTL balances freshness with performance.
/// </summary>
public class PermissionService : IPermissionService
{
    private readonly ApplicationDbContext _db;
    private readonly IMemoryCache _cache;

    private static readonly TimeSpan CacheTtl = TimeSpan.FromMinutes(5);

    // Cache key prefixes
    private const string PermissionKeyPrefix = "perm";
    private const string AllPermissionsKeyPrefix = "perm-all";
    private const string FieldPermissionKeyPrefix = "perm-field";
    private const string UserKeysPrefix = "perm-keys";

    public PermissionService(ApplicationDbContext db, IMemoryCache cache)
    {
        _db = db;
        _cache = cache;
    }

    /// <inheritdoc />
    public async Task<EffectivePermission> GetEffectivePermissionAsync(
        Guid userId, string entityType, string operation)
    {
        var cacheKey = $"{PermissionKeyPrefix}:{userId}:{entityType}:{operation}";

        if (_cache.TryGetValue(cacheKey, out EffectivePermission? cached) && cached is not null)
            return cached;

        // Get all role IDs for this user in a SINGLE query (direct + team-inherited)
        var allRoleIds = await GetAllRoleIdsAsync(userId);

        if (allRoleIds.Count == 0)
            return CacheAndTrack(userId, cacheKey, new EffectivePermission(entityType, operation, PermissionScope.None));

        // Query matching permissions and apply "most permissive wins"
        var maxScope = await _db.RolePermissions
            .Where(rp => allRoleIds.Contains(rp.RoleId)
                         && rp.EntityType == entityType
                         && rp.Operation == operation)
            .Select(rp => (PermissionScope?)rp.Scope)
            .MaxAsync();

        var scope = maxScope ?? PermissionScope.None;
        var result = new EffectivePermission(entityType, operation, scope);

        return CacheAndTrack(userId, cacheKey, result);
    }

    /// <inheritdoc />
    public async Task<IReadOnlyList<EffectivePermission>> GetAllPermissionsAsync(Guid userId)
    {
        var cacheKey = $"{AllPermissionsKeyPrefix}:{userId}";

        if (_cache.TryGetValue(cacheKey, out IReadOnlyList<EffectivePermission>? cached) && cached is not null)
            return cached;

        // Get all role IDs for this user in a SINGLE query (direct + team-inherited)
        var allRoleIds = await GetAllRoleIdsAsync(userId);

        if (allRoleIds.Count == 0)
        {
            var empty = Array.Empty<EffectivePermission>() as IReadOnlyList<EffectivePermission>;
            return CacheAndTrack(userId, cacheKey, empty);
        }

        // Load all permissions for all user roles, grouped by entity+operation
        var permissions = await _db.RolePermissions
            .Where(rp => allRoleIds.Contains(rp.RoleId))
            .GroupBy(rp => new { rp.EntityType, rp.Operation })
            .Select(g => new EffectivePermission(
                g.Key.EntityType,
                g.Key.Operation,
                g.Max(rp => rp.Scope)))
            .ToListAsync();

        var result = permissions.AsReadOnly() as IReadOnlyList<EffectivePermission>;
        return CacheAndTrack(userId, cacheKey, result);
    }

    /// <inheritdoc />
    public async Task<FieldAccessLevel> GetFieldAccessLevelAsync(
        Guid userId, string entityType, string fieldName)
    {
        var cacheKey = $"{FieldPermissionKeyPrefix}:{userId}:{entityType}:{fieldName}";

        if (_cache.TryGetValue(cacheKey, out FieldAccessLevel cached))
            return cached;

        // Get all role IDs for this user in a SINGLE query (direct + team-inherited)
        var allRoleIds = await GetAllRoleIdsAsync(userId);

        if (allRoleIds.Count == 0)
            return CacheAndTrack(userId, cacheKey, FieldAccessLevel.Editable);

        // Query field permissions and apply "most permissive wins"
        var maxAccess = await _db.RoleFieldPermissions
            .Where(rfp => allRoleIds.Contains(rfp.RoleId)
                          && rfp.EntityType == entityType
                          && rfp.FieldName == fieldName)
            .Select(rfp => (FieldAccessLevel?)rfp.AccessLevel)
            .MaxAsync();

        // Default to Editable if no field permissions are defined
        var result = maxAccess ?? FieldAccessLevel.Editable;

        return CacheAndTrack(userId, cacheKey, result);
    }

    /// <inheritdoc />
    public void InvalidateUserPermissions(Guid userId)
    {
        var userKeysKey = $"{UserKeysPrefix}:{userId}";

        if (_cache.TryGetValue(userKeysKey, out HashSet<string>? keys) && keys is not null)
        {
            foreach (var key in keys)
            {
                _cache.Remove(key);
            }

            _cache.Remove(userKeysKey);
        }
    }

    /// <summary>
    /// Gets all role IDs for a user from both direct assignments and team default roles.
    /// Executes as a SINGLE database query using UNION to avoid N+1.
    /// </summary>
    private async Task<List<Guid>> GetAllRoleIdsAsync(Guid userId)
    {
        // Direct role IDs from UserRoleAssignments
        var directRoleIds = _db.UserRoleAssignments
            .Where(ura => ura.UserId == userId)
            .Select(ura => ura.RoleId);

        // Team default role IDs from TeamMembers -> Teams
        var teamRoleIds = _db.TeamMembers
            .Where(tm => tm.UserId == userId)
            .Join(
                _db.Teams.Where(t => t.DefaultRoleId != null),
                tm => tm.TeamId,
                t => t.Id,
                (tm, t) => t.DefaultRoleId!.Value);

        // Union both sets in a single query
        var allRoleIds = await directRoleIds
            .Union(teamRoleIds)
            .Distinct()
            .ToListAsync();

        return allRoleIds;
    }

    /// <summary>
    /// Caches a value and tracks the cache key for the user so it can be invalidated later.
    /// </summary>
    private T CacheAndTrack<T>(Guid userId, string cacheKey, T value)
    {
        _cache.Set(cacheKey, value, CacheTtl);

        // Track all cache keys per user for invalidation
        var userKeysKey = $"{UserKeysPrefix}:{userId}";
        var keys = _cache.GetOrCreate(userKeysKey, _ => new HashSet<string>());
        keys!.Add(cacheKey);

        return value;
    }
}

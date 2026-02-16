using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Enums;
using GlobCRM.Domain.Interfaces;
using GlobCRM.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace GlobCRM.Api.Controllers;

/// <summary>
/// REST endpoints for role management: CRUD, permission matrix, field access,
/// role cloning, user assignment, and current-user permissions.
/// Admin-only except for the my-permissions endpoint which is accessible by any authenticated user.
/// </summary>
[ApiController]
[Route("api/roles")]
[Authorize(Roles = "Admin")]
public class RolesController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly IPermissionService _permissionService;
    private readonly ITenantProvider _tenantProvider;
    private readonly ILogger<RolesController> _logger;

    public RolesController(
        ApplicationDbContext db,
        IPermissionService permissionService,
        ITenantProvider tenantProvider,
        ILogger<RolesController> logger)
    {
        _db = db;
        _permissionService = permissionService;
        _tenantProvider = tenantProvider;
        _logger = logger;
    }

    // ---- Role CRUD ----

    /// <summary>
    /// Lists all roles for the current tenant with permission count and user count.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(List<RoleDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll()
    {
        var roles = await _db.Roles
            .Include(r => r.Permissions)
            .Select(r => new RoleDto
            {
                Id = r.Id,
                Name = r.Name,
                Description = r.Description,
                IsSystem = r.IsSystem,
                IsTemplate = r.IsTemplate,
                PermissionCount = r.Permissions.Count,
                AssignedUserCount = _db.UserRoleAssignments.Count(ura => ura.RoleId == r.Id)
                    + _db.TeamMembers.Count(tm => tm.Team.DefaultRoleId == r.Id),
                CreatedAt = r.CreatedAt
            })
            .OrderBy(r => r.Name)
            .ToListAsync();

        return Ok(roles);
    }

    /// <summary>
    /// Gets a role with full permission matrix and field permissions.
    /// </summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(RoleDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var role = await _db.Roles
            .Include(r => r.Permissions)
            .Include(r => r.FieldPermissions)
            .FirstOrDefaultAsync(r => r.Id == id);

        if (role is null)
            return NotFound(new { error = "Role not found." });

        return Ok(RoleDetailDto.FromEntity(role));
    }

    /// <summary>
    /// Creates a new custom role with permissions and optional field permissions.
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(RoleDetailDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Create([FromBody] CreateRoleRequest request)
    {
        // Validate name
        if (string.IsNullOrWhiteSpace(request.Name) || request.Name.Length > 100)
            return BadRequest(new { error = "Name is required and must be 1-100 characters." });

        var tenantId = _tenantProvider.GetTenantId()
            ?? throw new InvalidOperationException("No tenant context.");

        // Check name uniqueness within tenant
        var nameExists = await _db.Roles
            .AnyAsync(r => r.Name == request.Name);

        if (nameExists)
            return BadRequest(new { error = "A role with this name already exists." });

        var role = new Role
        {
            TenantId = tenantId,
            Name = request.Name,
            Description = request.Description,
            IsSystem = false,
            IsTemplate = false
        };

        // Add permissions
        if (request.Permissions is not null)
        {
            foreach (var p in request.Permissions)
            {
                role.Permissions.Add(new RolePermission
                {
                    RoleId = role.Id,
                    EntityType = p.EntityType,
                    Operation = p.Operation,
                    Scope = p.Scope
                });
            }
        }

        // Add field permissions
        if (request.FieldPermissions is not null)
        {
            foreach (var fp in request.FieldPermissions)
            {
                role.FieldPermissions.Add(new RoleFieldPermission
                {
                    RoleId = role.Id,
                    EntityType = fp.EntityType,
                    FieldName = fp.FieldName,
                    AccessLevel = fp.AccessLevel
                });
            }
        }

        _db.Roles.Add(role);
        await _db.SaveChangesAsync();

        _logger.LogInformation("Role created: {RoleName} ({RoleId})", role.Name, role.Id);

        return CreatedAtAction(
            nameof(GetById),
            new { id = role.Id },
            RoleDetailDto.FromEntity(role));
    }

    /// <summary>
    /// Updates a role's name, description, permissions, and/or field permissions.
    /// System roles cannot be modified. Permissions use full replacement strategy.
    /// Cache is invalidated for all users assigned to this role.
    /// </summary>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(RoleDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateRoleRequest request)
    {
        var role = await _db.Roles
            .Include(r => r.Permissions)
            .Include(r => r.FieldPermissions)
            .FirstOrDefaultAsync(r => r.Id == id);

        if (role is null)
            return NotFound(new { error = "Role not found." });

        if (role.IsSystem)
            return BadRequest(new { error = "System roles cannot be modified." });

        // Update name (with uniqueness check)
        if (request.Name is not null)
        {
            if (string.IsNullOrWhiteSpace(request.Name) || request.Name.Length > 100)
                return BadRequest(new { error = "Name must be 1-100 characters." });

            var nameExists = await _db.Roles
                .AnyAsync(r => r.Name == request.Name && r.Id != id);

            if (nameExists)
                return BadRequest(new { error = "A role with this name already exists." });

            role.Name = request.Name;
        }

        if (request.Description is not null)
            role.Description = request.Description;

        // Full replacement of permissions if provided
        if (request.Permissions is not null)
        {
            _db.RolePermissions.RemoveRange(role.Permissions);
            role.Permissions.Clear();

            foreach (var p in request.Permissions)
            {
                role.Permissions.Add(new RolePermission
                {
                    RoleId = role.Id,
                    EntityType = p.EntityType,
                    Operation = p.Operation,
                    Scope = p.Scope
                });
            }
        }

        // Full replacement of field permissions if provided
        if (request.FieldPermissions is not null)
        {
            _db.RoleFieldPermissions.RemoveRange(role.FieldPermissions);
            role.FieldPermissions.Clear();

            foreach (var fp in request.FieldPermissions)
            {
                role.FieldPermissions.Add(new RoleFieldPermission
                {
                    RoleId = role.Id,
                    EntityType = fp.EntityType,
                    FieldName = fp.FieldName,
                    AccessLevel = fp.AccessLevel
                });
            }
        }

        role.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync();

        // Invalidate permissions for all users assigned to this role
        await InvalidateRoleUsersAsync(id);

        _logger.LogInformation("Role updated: {RoleName} ({RoleId})", role.Name, role.Id);

        return Ok(RoleDetailDto.FromEntity(role));
    }

    /// <summary>
    /// Deletes a role. System roles cannot be deleted.
    /// Roles with assigned users cannot be deleted.
    /// </summary>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var role = await _db.Roles
            .FirstOrDefaultAsync(r => r.Id == id);

        if (role is null)
            return NotFound(new { error = "Role not found." });

        if (role.IsSystem)
            return BadRequest(new { error = "System roles cannot be deleted." });

        // Check if any users are assigned
        var hasDirectAssignments = await _db.UserRoleAssignments
            .AnyAsync(ura => ura.RoleId == id);

        var isTeamDefault = await _db.Teams
            .AnyAsync(t => t.DefaultRoleId == id);

        if (hasDirectAssignments || isTeamDefault)
            return BadRequest(new { error = "Cannot delete role with assigned users." });

        _db.Roles.Remove(role);
        await _db.SaveChangesAsync();

        _logger.LogInformation("Role deleted: {RoleName} ({RoleId})", role.Name, role.Id);

        return NoContent();
    }

    // ---- Role Cloning ----

    /// <summary>
    /// Clones a role including all permissions and field permissions.
    /// Creates a new non-system, non-template role with the specified name.
    /// </summary>
    [HttpPost("{id:guid}/clone")]
    [ProducesResponseType(typeof(RoleDetailDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Clone(Guid id, [FromBody] CloneRoleRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name) || request.Name.Length > 100)
            return BadRequest(new { error = "Name is required and must be 1-100 characters." });

        var tenantId = _tenantProvider.GetTenantId()
            ?? throw new InvalidOperationException("No tenant context.");

        // Check name uniqueness
        var nameExists = await _db.Roles
            .AnyAsync(r => r.Name == request.Name);

        if (nameExists)
            return BadRequest(new { error = "A role with this name already exists." });

        var sourceRole = await _db.Roles
            .Include(r => r.Permissions)
            .Include(r => r.FieldPermissions)
            .FirstOrDefaultAsync(r => r.Id == id);

        if (sourceRole is null)
            return NotFound(new { error = "Source role not found." });

        var clonedRole = new Role
        {
            TenantId = tenantId,
            Name = request.Name,
            Description = sourceRole.Description,
            IsSystem = false,
            IsTemplate = false
        };

        // Copy all permissions
        foreach (var p in sourceRole.Permissions)
        {
            clonedRole.Permissions.Add(new RolePermission
            {
                RoleId = clonedRole.Id,
                EntityType = p.EntityType,
                Operation = p.Operation,
                Scope = p.Scope
            });
        }

        // Copy all field permissions
        foreach (var fp in sourceRole.FieldPermissions)
        {
            clonedRole.FieldPermissions.Add(new RoleFieldPermission
            {
                RoleId = clonedRole.Id,
                EntityType = fp.EntityType,
                FieldName = fp.FieldName,
                AccessLevel = fp.AccessLevel
            });
        }

        _db.Roles.Add(clonedRole);
        await _db.SaveChangesAsync();

        _logger.LogInformation(
            "Role cloned: {SourceRole} -> {ClonedRole} ({ClonedRoleId})",
            sourceRole.Name, clonedRole.Name, clonedRole.Id);

        return CreatedAtAction(
            nameof(GetById),
            new { id = clonedRole.Id },
            RoleDetailDto.FromEntity(clonedRole));
    }

    // ---- User Assignment ----

    /// <summary>
    /// Lists users assigned to a role via direct assignment or team default role.
    /// </summary>
    [HttpGet("{id:guid}/users")]
    [ProducesResponseType(typeof(List<RoleUserDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetUsers(Guid id)
    {
        var roleExists = await _db.Roles.AnyAsync(r => r.Id == id);
        if (!roleExists)
            return NotFound(new { error = "Role not found." });

        // Direct assignments
        var directUsers = await _db.UserRoleAssignments
            .Where(ura => ura.RoleId == id)
            .Include(ura => ura.User)
            .Select(ura => new RoleUserDto
            {
                UserId = ura.UserId,
                FirstName = ura.User.FirstName,
                LastName = ura.User.LastName,
                Email = ura.User.Email ?? string.Empty,
                AssignmentType = "direct"
            })
            .ToListAsync();

        // Team-inherited assignments (via team default role)
        var teamUsers = await _db.TeamMembers
            .Where(tm => tm.Team.DefaultRoleId == id)
            .Include(tm => tm.User)
            .Include(tm => tm.Team)
            .Select(tm => new RoleUserDto
            {
                UserId = tm.UserId,
                FirstName = tm.User.FirstName,
                LastName = tm.User.LastName,
                Email = tm.User.Email ?? string.Empty,
                AssignmentType = $"team:{tm.Team.Name}"
            })
            .ToListAsync();

        var allUsers = directUsers.Concat(teamUsers).ToList();

        return Ok(allUsers);
    }

    /// <summary>
    /// Assigns a role directly to a user. Invalidates the user's permission cache.
    /// </summary>
    [HttpPost("{id:guid}/assign")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Assign(Guid id, [FromBody] AssignRoleRequest request)
    {
        var roleExists = await _db.Roles.AnyAsync(r => r.Id == id);
        if (!roleExists)
            return NotFound(new { error = "Role not found." });

        var userExists = await _db.Users.AnyAsync(u => u.Id == request.UserId);
        if (!userExists)
            return NotFound(new { error = "User not found." });

        // Check if already assigned
        var alreadyAssigned = await _db.UserRoleAssignments
            .AnyAsync(ura => ura.RoleId == id && ura.UserId == request.UserId);

        if (alreadyAssigned)
            return BadRequest(new { error = "Role is already assigned to this user." });

        var assignment = new UserRoleAssignment
        {
            UserId = request.UserId,
            RoleId = id
        };

        _db.UserRoleAssignments.Add(assignment);
        await _db.SaveChangesAsync();

        _permissionService.InvalidateUserPermissions(request.UserId);

        _logger.LogInformation(
            "Role {RoleId} assigned to user {UserId}", id, request.UserId);

        return Ok(new { message = "Role assigned successfully." });
    }

    /// <summary>
    /// Removes a direct role assignment from a user. Invalidates the user's permission cache.
    /// </summary>
    [HttpDelete("{id:guid}/assign/{userId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Unassign(Guid id, Guid userId)
    {
        var assignment = await _db.UserRoleAssignments
            .FirstOrDefaultAsync(ura => ura.RoleId == id && ura.UserId == userId);

        if (assignment is null)
            return NotFound(new { error = "Role assignment not found." });

        _db.UserRoleAssignments.Remove(assignment);
        await _db.SaveChangesAsync();

        _permissionService.InvalidateUserPermissions(userId);

        _logger.LogInformation(
            "Role {RoleId} unassigned from user {UserId}", id, userId);

        return NoContent();
    }

    // ---- Current User Permissions ----

    /// <summary>
    /// Gets the current user's effective permissions for the frontend PermissionStore.
    /// Accessible by any authenticated user (not admin-only).
    /// </summary>
    [HttpGet("my-permissions")]
    [Authorize]
    [ProducesResponseType(typeof(List<EffectivePermissionDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetMyPermissions()
    {
        var userId = GetCurrentUserId();
        var permissions = await _permissionService.GetAllPermissionsAsync(userId);

        var dtos = permissions.Select(p => new EffectivePermissionDto
        {
            EntityType = p.EntityType,
            Operation = p.Operation,
            Scope = p.Scope.ToString().ToLowerInvariant()
        }).ToList();

        return Ok(dtos);
    }

    // ---- Helper Methods ----

    private Guid GetCurrentUserId()
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? throw new InvalidOperationException("User ID not found in claims.");
        return Guid.Parse(userIdClaim);
    }

    /// <summary>
    /// Invalidates permission cache for all users assigned to a role
    /// (both direct assignments and team members via default role).
    /// </summary>
    private async Task InvalidateRoleUsersAsync(Guid roleId)
    {
        // Direct assignments
        var directUserIds = await _db.UserRoleAssignments
            .Where(ura => ura.RoleId == roleId)
            .Select(ura => ura.UserId)
            .ToListAsync();

        // Team members via default role
        var teamUserIds = await _db.TeamMembers
            .Where(tm => tm.Team.DefaultRoleId == roleId)
            .Select(tm => tm.UserId)
            .ToListAsync();

        var allUserIds = directUserIds.Union(teamUserIds).Distinct();

        foreach (var userId in allUserIds)
        {
            _permissionService.InvalidateUserPermissions(userId);
        }
    }
}

// ---- DTOs ----

/// <summary>
/// Summary DTO for role listing.
/// </summary>
public record RoleDto
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string? Description { get; init; }
    public bool IsSystem { get; init; }
    public bool IsTemplate { get; init; }
    public int PermissionCount { get; init; }
    public int AssignedUserCount { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
}

/// <summary>
/// Detailed DTO for role with full permission matrix and field permissions.
/// </summary>
public record RoleDetailDto
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string? Description { get; init; }
    public bool IsSystem { get; init; }
    public bool IsTemplate { get; init; }
    public List<RolePermissionDto> Permissions { get; init; } = new();
    public List<RoleFieldPermissionDto> FieldPermissions { get; init; } = new();

    public static RoleDetailDto FromEntity(Role entity) => new()
    {
        Id = entity.Id,
        Name = entity.Name,
        Description = entity.Description,
        IsSystem = entity.IsSystem,
        IsTemplate = entity.IsTemplate,
        Permissions = entity.Permissions.Select(p => new RolePermissionDto
        {
            EntityType = p.EntityType,
            Operation = p.Operation,
            Scope = p.Scope.ToString().ToLowerInvariant()
        }).ToList(),
        FieldPermissions = entity.FieldPermissions.Select(fp => new RoleFieldPermissionDto
        {
            EntityType = fp.EntityType,
            FieldName = fp.FieldName,
            AccessLevel = fp.AccessLevel.ToString().ToLowerInvariant()
        }).ToList()
    };
}

/// <summary>
/// DTO for a single entity-operation permission entry.
/// </summary>
public record RolePermissionDto
{
    public string EntityType { get; init; } = string.Empty;
    public string Operation { get; init; } = string.Empty;
    public string Scope { get; init; } = string.Empty;
}

/// <summary>
/// DTO for a single field permission entry.
/// </summary>
public record RoleFieldPermissionDto
{
    public string EntityType { get; init; } = string.Empty;
    public string FieldName { get; init; } = string.Empty;
    public string AccessLevel { get; init; } = string.Empty;
}

/// <summary>
/// DTO for users assigned to a role.
/// </summary>
public record RoleUserDto
{
    public Guid UserId { get; init; }
    public string FirstName { get; init; } = string.Empty;
    public string LastName { get; init; } = string.Empty;
    public string Email { get; init; } = string.Empty;
    public string AssignmentType { get; init; } = string.Empty;
}

/// <summary>
/// DTO for the current user's effective permissions.
/// </summary>
public record EffectivePermissionDto
{
    public string EntityType { get; init; } = string.Empty;
    public string Operation { get; init; } = string.Empty;
    public string Scope { get; init; } = string.Empty;
}

// ---- Request DTOs ----

/// <summary>
/// Request body for creating a role with permissions and field permissions.
/// </summary>
public record CreateRoleRequest
{
    public string Name { get; init; } = string.Empty;
    public string? Description { get; init; }
    public List<PermissionEntry>? Permissions { get; init; }
    public List<FieldPermissionEntry>? FieldPermissions { get; init; }
}

/// <summary>
/// Request body for updating a role. All fields optional (partial update).
/// Permissions and FieldPermissions use full replacement when provided.
/// </summary>
public record UpdateRoleRequest
{
    public string? Name { get; init; }
    public string? Description { get; init; }
    public List<PermissionEntry>? Permissions { get; init; }
    public List<FieldPermissionEntry>? FieldPermissions { get; init; }
}

/// <summary>
/// Request body for cloning a role.
/// </summary>
public record CloneRoleRequest
{
    public string Name { get; init; } = string.Empty;
}

/// <summary>
/// Request body for assigning a role to a user.
/// </summary>
public record AssignRoleRequest
{
    public Guid UserId { get; init; }
}

/// <summary>
/// Permission entry for creating/updating role permissions.
/// </summary>
public record PermissionEntry
{
    public string EntityType { get; init; } = string.Empty;
    public string Operation { get; init; } = string.Empty;
    public PermissionScope Scope { get; init; }
}

/// <summary>
/// Field permission entry for creating/updating role field permissions.
/// </summary>
public record FieldPermissionEntry
{
    public string EntityType { get; init; } = string.Empty;
    public string FieldName { get; init; } = string.Empty;
    public FieldAccessLevel AccessLevel { get; init; }
}

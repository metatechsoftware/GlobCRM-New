using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Interfaces;
using GlobCRM.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace GlobCRM.Api.Controllers;

/// <summary>
/// REST endpoints for team management: CRUD, member management (add, remove, bulk add),
/// and default role assignment. Admin-only.
/// Cache invalidation is triggered on every membership change and default role change.
/// </summary>
[ApiController]
[Route("api/teams")]
[Authorize(Roles = "Admin")]
public class TeamsController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly IPermissionService _permissionService;
    private readonly ITenantProvider _tenantProvider;
    private readonly ILogger<TeamsController> _logger;

    public TeamsController(
        ApplicationDbContext db,
        IPermissionService permissionService,
        ITenantProvider tenantProvider,
        ILogger<TeamsController> logger)
    {
        _db = db;
        _permissionService = permissionService;
        _tenantProvider = tenantProvider;
        _logger = logger;
    }

    // ---- Team CRUD ----

    /// <summary>
    /// Lists all teams for the current tenant with member count and default role name.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(List<TeamDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll()
    {
        var teams = await _db.Teams
            .Include(t => t.DefaultRole)
            .Include(t => t.Members)
            .Select(t => new TeamDto
            {
                Id = t.Id,
                Name = t.Name,
                Description = t.Description,
                DefaultRoleName = t.DefaultRole != null ? t.DefaultRole.Name : null,
                MemberCount = t.Members.Count,
                CreatedAt = t.CreatedAt
            })
            .OrderBy(t => t.Name)
            .ToListAsync();

        return Ok(teams);
    }

    /// <summary>
    /// Gets a team with full member list and user details.
    /// </summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(TeamDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var team = await _db.Teams
            .Include(t => t.DefaultRole)
            .Include(t => t.Members)
                .ThenInclude(m => m.User)
            .FirstOrDefaultAsync(t => t.Id == id);

        if (team is null)
            return NotFound(new { error = "Team not found." });

        return Ok(TeamDetailDto.FromEntity(team));
    }

    /// <summary>
    /// Creates a new team. If DefaultRoleId is provided, verifies the role exists in this tenant.
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(TeamDetailDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Create([FromBody] CreateTeamRequest request)
    {
        // Validate name
        if (string.IsNullOrWhiteSpace(request.Name) || request.Name.Length > 100)
            return BadRequest(new { error = "Name is required and must be 1-100 characters." });

        var tenantId = _tenantProvider.GetTenantId()
            ?? throw new InvalidOperationException("No tenant context.");

        // Check name uniqueness within tenant
        var nameExists = await _db.Teams
            .AnyAsync(t => t.Name == request.Name);

        if (nameExists)
            return BadRequest(new { error = "A team with this name already exists." });

        // Validate DefaultRoleId if provided
        if (request.DefaultRoleId.HasValue)
        {
            var roleExists = await _db.Roles
                .AnyAsync(r => r.Id == request.DefaultRoleId.Value);

            if (!roleExists)
                return BadRequest(new { error = "Default role not found." });
        }

        var team = new Team
        {
            TenantId = tenantId,
            Name = request.Name,
            Description = request.Description,
            DefaultRoleId = request.DefaultRoleId
        };

        _db.Teams.Add(team);
        await _db.SaveChangesAsync();

        _logger.LogInformation("Team created: {TeamName} ({TeamId})", team.Name, team.Id);

        // Re-fetch with includes for the DTO
        var created = await _db.Teams
            .Include(t => t.DefaultRole)
            .Include(t => t.Members)
                .ThenInclude(m => m.User)
            .FirstAsync(t => t.Id == team.Id);

        return CreatedAtAction(
            nameof(GetById),
            new { id = team.Id },
            TeamDetailDto.FromEntity(created));
    }

    /// <summary>
    /// Updates a team's name, description, and/or default role.
    /// When the default role changes, invalidates permissions for all team members.
    /// </summary>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(TeamDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateTeamRequest request)
    {
        var team = await _db.Teams
            .Include(t => t.Members)
            .FirstOrDefaultAsync(t => t.Id == id);

        if (team is null)
            return NotFound(new { error = "Team not found." });

        // Update name (with uniqueness check)
        if (request.Name is not null)
        {
            if (string.IsNullOrWhiteSpace(request.Name) || request.Name.Length > 100)
                return BadRequest(new { error = "Name must be 1-100 characters." });

            var nameExists = await _db.Teams
                .AnyAsync(t => t.Name == request.Name && t.Id != id);

            if (nameExists)
                return BadRequest(new { error = "A team with this name already exists." });

            team.Name = request.Name;
        }

        if (request.Description is not null)
            team.Description = request.Description;

        // Track whether default role changed for cache invalidation
        var defaultRoleChanged = false;

        if (request.DefaultRoleId is not null)
        {
            if (request.DefaultRoleId.Value == Guid.Empty)
            {
                // Null to remove default role
                if (team.DefaultRoleId != null)
                {
                    team.DefaultRoleId = null;
                    defaultRoleChanged = true;
                }
            }
            else
            {
                // Validate the role exists
                var roleExists = await _db.Roles
                    .AnyAsync(r => r.Id == request.DefaultRoleId.Value);

                if (!roleExists)
                    return BadRequest(new { error = "Default role not found." });

                if (team.DefaultRoleId != request.DefaultRoleId.Value)
                {
                    team.DefaultRoleId = request.DefaultRoleId.Value;
                    defaultRoleChanged = true;
                }
            }
        }

        team.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync();

        // If default role changed, invalidate permissions for ALL team members
        if (defaultRoleChanged)
        {
            foreach (var member in team.Members)
            {
                _permissionService.InvalidateUserPermissions(member.UserId);
            }
        }

        _logger.LogInformation("Team updated: {TeamName} ({TeamId})", team.Name, team.Id);

        // Re-fetch with includes for the DTO
        var updated = await _db.Teams
            .Include(t => t.DefaultRole)
            .Include(t => t.Members)
                .ThenInclude(m => m.User)
            .FirstAsync(t => t.Id == id);

        return Ok(TeamDetailDto.FromEntity(updated));
    }

    /// <summary>
    /// Deletes a team. Invalidates permissions for all team members before deletion.
    /// Team members are cascade deleted via the database.
    /// </summary>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var team = await _db.Teams
            .Include(t => t.Members)
            .FirstOrDefaultAsync(t => t.Id == id);

        if (team is null)
            return NotFound(new { error = "Team not found." });

        // Invalidate permissions for all team members before deletion
        foreach (var member in team.Members)
        {
            _permissionService.InvalidateUserPermissions(member.UserId);
        }

        _db.Teams.Remove(team);
        await _db.SaveChangesAsync();

        _logger.LogInformation("Team deleted: {TeamName} ({TeamId})", team.Name, team.Id);

        return NoContent();
    }

    // ---- Member Management ----

    /// <summary>
    /// Adds a member to a team. Validates user exists in the same tenant and is not already a member.
    /// Invalidates the user's permission cache (they now inherit the team's default role).
    /// </summary>
    [HttpPost("{id:guid}/members")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> AddMember(Guid id, [FromBody] AddMemberRequest request)
    {
        var teamExists = await _db.Teams.AnyAsync(t => t.Id == id);
        if (!teamExists)
            return NotFound(new { error = "Team not found." });

        var userExists = await _db.Users.AnyAsync(u => u.Id == request.UserId);
        if (!userExists)
            return NotFound(new { error = "User not found." });

        // Check if already a member
        var alreadyMember = await _db.TeamMembers
            .AnyAsync(tm => tm.TeamId == id && tm.UserId == request.UserId);

        if (alreadyMember)
            return BadRequest(new { error = "User is already a member of this team." });

        var member = new TeamMember
        {
            TeamId = id,
            UserId = request.UserId
        };

        _db.TeamMembers.Add(member);
        await _db.SaveChangesAsync();

        _permissionService.InvalidateUserPermissions(request.UserId);

        _logger.LogInformation(
            "User {UserId} added to team {TeamId}", request.UserId, id);

        return Ok(new { message = "Member added successfully." });
    }

    /// <summary>
    /// Removes a member from a team. Invalidates the user's permission cache.
    /// </summary>
    [HttpDelete("{id:guid}/members/{userId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> RemoveMember(Guid id, Guid userId)
    {
        var member = await _db.TeamMembers
            .FirstOrDefaultAsync(tm => tm.TeamId == id && tm.UserId == userId);

        if (member is null)
            return NotFound(new { error = "Team member not found." });

        _db.TeamMembers.Remove(member);
        await _db.SaveChangesAsync();

        _permissionService.InvalidateUserPermissions(userId);

        _logger.LogInformation(
            "User {UserId} removed from team {TeamId}", userId, id);

        return NoContent();
    }

    /// <summary>
    /// Adds multiple members to a team at once. Skips duplicates.
    /// Invalidates permissions for all newly added users.
    /// </summary>
    [HttpPost("{id:guid}/members/bulk")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> BulkAddMembers(Guid id, [FromBody] BulkAddMembersRequest request)
    {
        var teamExists = await _db.Teams.AnyAsync(t => t.Id == id);
        if (!teamExists)
            return NotFound(new { error = "Team not found." });

        if (request.UserIds is null || request.UserIds.Count == 0)
            return BadRequest(new { error = "UserIds is required and must not be empty." });

        // Get existing member user IDs for this team
        var existingMemberIds = await _db.TeamMembers
            .Where(tm => tm.TeamId == id)
            .Select(tm => tm.UserId)
            .ToHashSetAsync();

        var added = 0;
        var skipped = 0;
        var addedUserIds = new List<Guid>();

        foreach (var userId in request.UserIds.Distinct())
        {
            if (existingMemberIds.Contains(userId))
            {
                skipped++;
                continue;
            }

            // Verify user exists in the same tenant
            var userExists = await _db.Users.AnyAsync(u => u.Id == userId);
            if (!userExists)
            {
                skipped++;
                continue;
            }

            _db.TeamMembers.Add(new TeamMember
            {
                TeamId = id,
                UserId = userId
            });

            addedUserIds.Add(userId);
            added++;
        }

        await _db.SaveChangesAsync();

        // Invalidate permissions for all newly added users
        foreach (var userId in addedUserIds)
        {
            _permissionService.InvalidateUserPermissions(userId);
        }

        _logger.LogInformation(
            "Bulk add to team {TeamId}: {Added} added, {Skipped} skipped",
            id, added, skipped);

        return Ok(new { added, skipped });
    }
}

// ---- DTOs ----

/// <summary>
/// Summary DTO for team listing.
/// </summary>
public record TeamDto
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string? Description { get; init; }
    public string? DefaultRoleName { get; init; }
    public int MemberCount { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
}

/// <summary>
/// Detailed DTO for team with full member list.
/// </summary>
public record TeamDetailDto
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string? Description { get; init; }
    public Guid? DefaultRoleId { get; init; }
    public string? DefaultRoleName { get; init; }
    public List<TeamMemberInfoDto> Members { get; init; } = new();
    public DateTimeOffset CreatedAt { get; init; }

    public static TeamDetailDto FromEntity(Team entity) => new()
    {
        Id = entity.Id,
        Name = entity.Name,
        Description = entity.Description,
        DefaultRoleId = entity.DefaultRoleId,
        DefaultRoleName = entity.DefaultRole?.Name,
        Members = entity.Members.Select(m => new TeamMemberInfoDto
        {
            UserId = m.UserId,
            FirstName = m.User.FirstName,
            LastName = m.User.LastName,
            Email = m.User.Email ?? string.Empty,
            AvatarUrl = m.User.AvatarUrl,
            AvatarColor = m.User.AvatarColor
        }).ToList(),
        CreatedAt = entity.CreatedAt
    };
}

/// <summary>
/// DTO for a team member with user details (within team management context).
/// Named TeamMemberInfoDto to avoid conflict with TeamMemberDto in TeamDirectoryController.
/// </summary>
public record TeamMemberInfoDto
{
    public Guid UserId { get; init; }
    public string FirstName { get; init; } = string.Empty;
    public string LastName { get; init; } = string.Empty;
    public string Email { get; init; } = string.Empty;
    public string? AvatarUrl { get; init; }
    public string? AvatarColor { get; init; }
}

// ---- Request DTOs ----

/// <summary>
/// Request body for creating a team.
/// </summary>
public record CreateTeamRequest
{
    public string Name { get; init; } = string.Empty;
    public string? Description { get; init; }
    public Guid? DefaultRoleId { get; init; }
}

/// <summary>
/// Request body for updating a team. All fields optional.
/// Set DefaultRoleId to Guid.Empty to remove the default role.
/// </summary>
public record UpdateTeamRequest
{
    public string? Name { get; init; }
    public string? Description { get; init; }
    public Guid? DefaultRoleId { get; init; }
}

/// <summary>
/// Request body for adding a single member to a team.
/// </summary>
public record AddMemberRequest
{
    public Guid UserId { get; init; }
}

/// <summary>
/// Request body for bulk adding members to a team.
/// </summary>
public record BulkAddMembersRequest
{
    public List<Guid> UserIds { get; init; } = new();
}

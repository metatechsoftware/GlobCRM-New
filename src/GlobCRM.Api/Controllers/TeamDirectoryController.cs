using System.Security.Claims;
using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Enums;
using GlobCRM.Domain.Interfaces;
using GlobCRM.Infrastructure.Persistence;
using GlobCRM.Infrastructure.Storage;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace GlobCRM.Api.Controllers;

// ---- DTOs ----

/// <summary>
/// Summary DTO for team directory listing.
/// </summary>
public record TeamMemberDto
{
    public Guid Id { get; init; }
    public string FirstName { get; init; } = string.Empty;
    public string LastName { get; init; } = string.Empty;
    public string Email { get; init; } = string.Empty;
    public string? JobTitle { get; init; }
    public string? Department { get; init; }
    public string? AvatarUrl { get; init; }
    public string? AvatarColor { get; init; }
    public string? Phone { get; init; }
    public bool IsActive { get; init; }

    public static TeamMemberDto FromUser(ApplicationUser user)
    {
        return new TeamMemberDto
        {
            Id = user.Id,
            FirstName = user.FirstName,
            LastName = user.LastName,
            Email = user.Email ?? string.Empty,
            JobTitle = user.JobTitle,
            Department = user.Department,
            AvatarUrl = user.AvatarUrl,
            AvatarColor = user.AvatarColor,
            Phone = user.Phone,
            IsActive = user.IsActive
        };
    }
}

/// <summary>
/// Detailed profile DTO for team member detail view (all public fields, no preferences).
/// </summary>
public record TeamMemberDetailDto
{
    public Guid Id { get; init; }
    public string FirstName { get; init; } = string.Empty;
    public string LastName { get; init; } = string.Empty;
    public string Email { get; init; } = string.Empty;
    public string? Phone { get; init; }
    public string? JobTitle { get; init; }
    public string? Department { get; init; }
    public string? Timezone { get; init; }
    public string? Language { get; init; }
    public string? Bio { get; init; }
    public string? AvatarUrl { get; init; }
    public string? AvatarColor { get; init; }
    public Dictionary<string, string>? SocialLinks { get; init; }
    public WorkSchedule? WorkSchedule { get; init; }
    public Guid? ReportingManagerId { get; init; }
    public string? ReportingManagerName { get; init; }
    public List<string>? Skills { get; init; }
    public bool IsActive { get; init; }
    public DateTimeOffset CreatedAt { get; init; }

    public static TeamMemberDetailDto FromUser(ApplicationUser user, ApplicationUser? manager = null)
    {
        return new TeamMemberDetailDto
        {
            Id = user.Id,
            FirstName = user.FirstName,
            LastName = user.LastName,
            Email = user.Email ?? string.Empty,
            Phone = user.Phone,
            JobTitle = user.JobTitle,
            Department = user.Department,
            Timezone = user.Timezone,
            Language = user.Language,
            Bio = user.Bio,
            AvatarUrl = user.AvatarUrl,
            AvatarColor = user.AvatarColor,
            SocialLinks = user.SocialLinks,
            WorkSchedule = user.WorkSchedule,
            ReportingManagerId = user.ReportingManagerId,
            ReportingManagerName = manager?.FullName ?? user.ReportingManager?.FullName,
            Skills = user.Skills,
            IsActive = user.IsActive,
            CreatedAt = user.CreatedAt
        };
    }
}

/// <summary>
/// Activity stats DTO for user preview popover.
/// </summary>
public record UserActivityStatsDto
{
    public int DealsAssigned { get; init; }
    public int TasksCompletedToday { get; init; }
    public DateTimeOffset? LastActive { get; init; }
}

/// <summary>
/// Paginated response wrapper.
/// </summary>
public record PaginatedResult<T>
{
    public List<T> Items { get; init; } = new();
    public int TotalCount { get; init; }
    public int Page { get; init; }
    public int PageSize { get; init; }
}

// ---- Controller ----

/// <summary>
/// REST endpoints for the team directory.
/// Any authenticated user can browse all users in their organization.
/// GET /api/team-directory              - List all org members (paginated, searchable)
/// GET /api/team-directory/{userId}     - Get detailed profile of a team member
/// GET /api/team-directory/avatar/{userId} - Serve avatar file with tenant isolation
/// </summary>
[ApiController]
[Route("api/team-directory")]
[Authorize]
public class TeamDirectoryController : ControllerBase
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly ApplicationDbContext _dbContext;
    private readonly ITenantProvider _tenantProvider;
    private readonly IFileStorageService _fileStorage;
    private readonly ILogger<TeamDirectoryController> _logger;

    private const int DefaultPageSize = 25;
    private const int MaxPageSize = 100;

    public TeamDirectoryController(
        UserManager<ApplicationUser> userManager,
        ApplicationDbContext dbContext,
        ITenantProvider tenantProvider,
        IFileStorageService fileStorage,
        ILogger<TeamDirectoryController> logger)
    {
        _userManager = userManager;
        _dbContext = dbContext;
        _tenantProvider = tenantProvider;
        _fileStorage = fileStorage;
        _logger = logger;
    }

    /// <summary>
    /// Lists all active users in the current organization with pagination and optional search/filter.
    /// Per locked decision: "Team directory: all users in the organization can view each other's profiles."
    /// </summary>
    /// <param name="search">Optional search term (filters by first name, last name, or email). Case-insensitive.</param>
    /// <param name="department">Optional department filter.</param>
    /// <param name="page">Page number (default 1).</param>
    /// <param name="pageSize">Items per page (default 25, max 100).</param>
    [HttpGet]
    [ProducesResponseType(typeof(PaginatedResult<TeamMemberDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> ListMembers(
        [FromQuery] string? search,
        [FromQuery] string? department,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = DefaultPageSize,
        CancellationToken cancellationToken = default)
    {
        if (page < 1) page = 1;
        if (pageSize < 1) pageSize = DefaultPageSize;
        if (pageSize > MaxPageSize) pageSize = MaxPageSize;

        // Build query -- global query filter already scopes to current tenant's OrganizationId
        var query = _dbContext.Users
            .AsNoTracking()
            .Where(u => u.IsActive);

        // Apply search filter (case-insensitive across FirstName, LastName, Email)
        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchLower = search.ToLower();
            query = query.Where(u =>
                u.FirstName.ToLower().Contains(searchLower) ||
                u.LastName.ToLower().Contains(searchLower) ||
                (u.Email != null && u.Email.ToLower().Contains(searchLower)));
        }

        // Apply department filter
        if (!string.IsNullOrWhiteSpace(department))
        {
            query = query.Where(u => u.Department != null && u.Department == department);
        }

        // Get total count before pagination
        var totalCount = await query.CountAsync(cancellationToken);

        // Apply ordering and pagination
        var items = await query
            .OrderBy(u => u.FirstName)
            .ThenBy(u => u.LastName)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(u => new TeamMemberDto
            {
                Id = u.Id,
                FirstName = u.FirstName,
                LastName = u.LastName,
                Email = u.Email ?? string.Empty,
                JobTitle = u.JobTitle,
                Department = u.Department,
                AvatarUrl = u.AvatarUrl,
                AvatarColor = u.AvatarColor,
                Phone = u.Phone,
                IsActive = u.IsActive
            })
            .ToListAsync(cancellationToken);

        return Ok(new PaginatedResult<TeamMemberDto>
        {
            Items = items,
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize
        });
    }

    /// <summary>
    /// Gets the detailed public profile of a team member.
    /// Verifies the target user is in the same organization (tenant isolation via query filter).
    /// </summary>
    [HttpGet("{userId:guid}")]
    [ProducesResponseType(typeof(TeamMemberDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetMemberDetail(Guid userId, CancellationToken cancellationToken)
    {
        // Query filter already ensures tenant isolation
        var user = await _dbContext.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);

        if (user == null)
        {
            return NotFound(new { error = "User not found." });
        }

        // Resolve reporting manager name if set
        ApplicationUser? manager = null;
        if (user.ReportingManagerId != null)
        {
            manager = await _dbContext.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(u => u.Id == user.ReportingManagerId, cancellationToken);
        }

        return Ok(TeamMemberDetailDto.FromUser(user, manager));
    }

    /// <summary>
    /// Gets activity stats for a team member: deals assigned, tasks completed today, last active time.
    /// All queries run sequentially (DbContext is not thread-safe).
    /// </summary>
    [HttpGet("{userId:guid}/activity-stats")]
    [ProducesResponseType(typeof(UserActivityStatsDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetActivityStats(Guid userId, CancellationToken ct)
    {
        // Verify user exists in tenant
        var userExists = await _dbContext.Users
            .AsNoTracking()
            .AnyAsync(u => u.Id == userId, ct);

        if (!userExists)
            return NotFound(new { error = "User not found." });

        var today = DateTimeOffset.UtcNow.Date;

        // Run all stat queries sequentially (DbContext is not thread-safe)
        var dealsAssigned = await _dbContext.Deals
            .CountAsync(d => d.OwnerId == userId, ct);

        var tasksCompletedToday = await _dbContext.Activities
            .CountAsync(a => a.AssignedToId == userId
                          && a.Status == ActivityStatus.Done
                          && a.CompletedAt.HasValue
                          && a.CompletedAt.Value >= today, ct);

        var lastActive = await _dbContext.FeedItems
            .Where(f => f.AuthorId == userId)
            .OrderByDescending(f => f.CreatedAt)
            .Select(f => (DateTimeOffset?)f.CreatedAt)
            .FirstOrDefaultAsync(ct);

        return Ok(new UserActivityStatsDto
        {
            DealsAssigned = dealsAssigned,
            TasksCompletedToday = tasksCompletedToday,
            LastActive = lastActive
        });
    }

    /// <summary>
    /// Serves an avatar file for a user. Enforces tenant isolation by verifying
    /// the requested user belongs to the same organization as the authenticated user.
    /// This approach is more secure than static file serving as it prevents cross-tenant access.
    /// </summary>
    [HttpGet("avatar/{userId:guid}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetAvatar(Guid userId, CancellationToken cancellationToken)
    {
        // Query filter ensures tenant isolation
        var user = await _dbContext.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);

        if (user == null || string.IsNullOrEmpty(user.AvatarUrl))
        {
            return NotFound(new { error = "Avatar not found." });
        }

        var fileData = await _fileStorage.GetFileAsync(user.AvatarUrl, cancellationToken);
        if (fileData == null)
        {
            return NotFound(new { error = "Avatar file not found." });
        }

        return File(fileData, "image/webp");
    }
}

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
/// REST endpoint for unified calendar data. Returns activities within a date range
/// for efficient calendar rendering. Optimized for calendar: no pagination, just
/// date-range bounded, lightweight DTOs with color coding by priority.
/// </summary>
[ApiController]
[Route("api/calendar")]
[Authorize]
public class CalendarController : ControllerBase
{
    private readonly IPermissionService _permissionService;
    private readonly ApplicationDbContext _db;
    private readonly ILogger<CalendarController> _logger;

    public CalendarController(
        IPermissionService permissionService,
        ApplicationDbContext db,
        ILogger<CalendarController> logger)
    {
        _permissionService = permissionService;
        _db = db;
        _logger = logger;
    }

    /// <summary>
    /// Gets activities within a date range for calendar rendering.
    /// Optional filters: type (Task, Call, Meeting), ownerId, entityType, entityId.
    /// Applies RBAC ownership scope matching ActivitiesController pattern
    /// (checks both OwnerId and AssignedToId for scope).
    /// Returns lightweight CalendarEventDto with priority-based color coding.
    /// </summary>
    [HttpGet]
    [Authorize(Policy = "Permission:Activity:View")]
    [ProducesResponseType(typeof(List<CalendarEventDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> GetEvents(
        [FromQuery] DateTimeOffset start,
        [FromQuery] DateTimeOffset end,
        [FromQuery] string? type = null,
        [FromQuery] Guid? ownerId = null,
        [FromQuery] string? entityType = null,
        [FromQuery] Guid? entityId = null)
    {
        if (start >= end)
            return BadRequest(new { error = "Start date must be before end date." });

        var userId = GetCurrentUserId();
        var permission = await _permissionService.GetEffectivePermissionAsync(userId, "Activity", "View");
        var teamMemberIds = await GetTeamMemberIds(userId, permission.Scope);

        // Base query: activities with DueDate between start and end
        var query = _db.Activities
            .Include(a => a.Owner)
            .Include(a => a.AssignedTo)
            .Where(a => a.DueDate.HasValue && a.DueDate.Value >= start && a.DueDate.Value <= end);

        // Apply RBAC ownership scope (matching ActivitiesController dual-ownership pattern)
        query = ApplyOwnershipScope(query, permission.Scope, userId, teamMemberIds);

        // Optional filter: activity type
        if (!string.IsNullOrWhiteSpace(type))
        {
            if (Enum.TryParse<ActivityType>(type, true, out var activityType))
            {
                query = query.Where(a => a.Type == activityType);
            }
        }

        // Optional filter: owner
        if (ownerId.HasValue)
        {
            query = query.Where(a => a.OwnerId == ownerId.Value || a.AssignedToId == ownerId.Value);
        }

        // Optional filter: linked entity
        if (!string.IsNullOrWhiteSpace(entityType) && entityId.HasValue)
        {
            var et = entityType;
            var eid = entityId.Value;
            query = query.Where(a =>
                a.Links.Any(l => l.EntityType == et && l.EntityId == eid));
        }

        var activities = await query.ToListAsync();

        var events = activities.Select(a => new CalendarEventDto
        {
            Id = a.Id,
            Title = a.Subject,
            Start = a.DueDate!.Value.ToString("o"),
            End = a.DueDate!.Value.ToString("o"),
            Color = GetPriorityColor(a.Priority),
            ExtendedProps = new CalendarEventExtendedProps
            {
                Type = a.Type.ToString(),
                Status = a.Status.ToString(),
                Priority = a.Priority.ToString(),
                AssignedToName = a.AssignedTo != null
                    ? $"{a.AssignedTo.FirstName} {a.AssignedTo.LastName}".Trim()
                    : null,
                OwnerName = a.Owner != null
                    ? $"{a.Owner.FirstName} {a.Owner.LastName}".Trim()
                    : null
            }
        }).ToList();

        return Ok(events);
    }

    // ---- Helper Methods ----

    private Guid GetCurrentUserId()
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? throw new InvalidOperationException("User ID not found in claims.");
        return Guid.Parse(userIdClaim);
    }

    /// <summary>
    /// Priority-based color mapping for calendar events.
    /// Matches frontend color scheme: Low=green, Medium=blue, High=orange, Urgent=red.
    /// </summary>
    private static string GetPriorityColor(ActivityPriority priority)
    {
        return priority switch
        {
            ActivityPriority.Low => "#4caf50",
            ActivityPriority.Medium => "#2196f3",
            ActivityPriority.High => "#ff9800",
            ActivityPriority.Urgent => "#f44336",
            _ => "#9e9e9e"
        };
    }

    /// <summary>
    /// Applies ownership scope filtering to the query.
    /// Activity dual-ownership: checks both OwnerId AND AssignedToId.
    /// </summary>
    private static IQueryable<Activity> ApplyOwnershipScope(
        IQueryable<Activity> query,
        PermissionScope scope,
        Guid userId,
        List<Guid>? teamMemberIds)
    {
        return scope switch
        {
            PermissionScope.All => query,
            PermissionScope.Team => query.Where(a =>
                a.OwnerId == userId ||
                a.AssignedToId == userId ||
                (teamMemberIds != null && a.OwnerId.HasValue && teamMemberIds.Contains(a.OwnerId.Value)) ||
                (teamMemberIds != null && a.AssignedToId.HasValue && teamMemberIds.Contains(a.AssignedToId.Value))),
            PermissionScope.Own => query.Where(a =>
                a.OwnerId == userId || a.AssignedToId == userId),
            PermissionScope.None => query.Where(_ => false),
            _ => query.Where(_ => false)
        };
    }

    /// <summary>
    /// Gets team member user IDs for Team scope filtering.
    /// </summary>
    private async Task<List<Guid>?> GetTeamMemberIds(Guid userId, PermissionScope scope)
    {
        if (scope != PermissionScope.Team)
            return null;

        var userTeamIds = await _db.TeamMembers
            .Where(tm => tm.UserId == userId)
            .Select(tm => tm.TeamId)
            .ToListAsync();

        if (userTeamIds.Count == 0)
            return new List<Guid>();

        var memberIds = await _db.TeamMembers
            .Where(tm => userTeamIds.Contains(tm.TeamId))
            .Select(tm => tm.UserId)
            .Distinct()
            .ToListAsync();

        return memberIds;
    }
}

// ---- DTOs ----

/// <summary>
/// Calendar event DTO optimized for FullCalendar rendering.
/// </summary>
public record CalendarEventDto
{
    public Guid Id { get; init; }
    public string Title { get; init; } = string.Empty;
    public string Start { get; init; } = string.Empty;
    public string End { get; init; } = string.Empty;
    public string Color { get; init; } = string.Empty;
    public CalendarEventExtendedProps ExtendedProps { get; init; } = new();
}

/// <summary>
/// Extended properties for calendar events (activity metadata).
/// </summary>
public record CalendarEventExtendedProps
{
    public string Type { get; init; } = string.Empty;
    public string Status { get; init; } = string.Empty;
    public string Priority { get; init; } = string.Empty;
    public string? AssignedToName { get; init; }
    public string? OwnerName { get; init; }
}

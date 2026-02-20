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
/// Aggregation endpoints for the My Day personal dashboard.
/// GET /api/my-day returns all widget data in a single batched response.
/// POST /api/my-day/track-view records recently viewed entities.
/// PATCH /api/my-day/tasks/{taskId}/complete marks tasks as done inline.
/// </summary>
[ApiController]
[Route("api/my-day")]
[Authorize]
public class MyDayController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly ITenantProvider _tenantProvider;

    public MyDayController(
        ApplicationDbContext db,
        ITenantProvider tenantProvider)
    {
        _db = db;
        _tenantProvider = tenantProvider;
    }

    // ---- Endpoints ----

    /// <summary>
    /// Returns all My Day widget data for the current user in a single batched response.
    /// Includes tasks, upcoming events, pipeline, emails, feed, notifications, and recent records.
    /// All queries are sequential (EF Core DbContext is not thread-safe).
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(MyDayDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetMyDay()
    {
        var userId = GetCurrentUserId();
        var now = DateTimeOffset.UtcNow;
        var todayStart = new DateTimeOffset(now.Date, TimeSpan.Zero);
        var todayEnd = todayStart.AddDays(1);
        var upcomingEnd = todayStart.AddDays(3);

        // ---- Tasks: today + overdue, not Done ----
        var tasksRaw = await _db.Activities
            .Include(a => a.Links)
            .Where(a =>
                (a.AssignedToId == userId || a.OwnerId == userId) &&
                a.Status != ActivityStatus.Done &&
                a.DueDate != null &&
                a.DueDate < todayEnd)
            .OrderBy(a => a.DueDate)
            .Take(20)
            .Select(a => new
            {
                a.Id,
                a.Subject,
                a.Type,
                a.Status,
                a.Priority,
                a.DueDate,
                FirstLink = a.Links.OrderBy(l => l.LinkedAt).Select(l => new
                {
                    l.EntityType,
                    l.EntityId,
                    l.EntityName
                }).FirstOrDefault()
            })
            .ToListAsync();

        var tasks = tasksRaw.Select(a =>
        {
            var isOverdue = a.DueDate!.Value < todayStart;
            var daysOverdue = isOverdue
                ? (int)(todayStart - a.DueDate.Value.Date).TotalDays
                : 0;

            return new MyDayTaskDto
            {
                Id = a.Id,
                Subject = a.Subject,
                Type = a.Type.ToString(),
                Status = a.Status.ToString(),
                Priority = a.Priority.ToString(),
                DueDate = a.DueDate,
                IsOverdue = isOverdue,
                DaysOverdue = daysOverdue,
                LinkedEntityType = a.FirstLink?.EntityType,
                LinkedEntityId = a.FirstLink?.EntityId,
                LinkedEntityName = a.FirstLink?.EntityName
            };
        }).ToList();

        // ---- Upcoming events: meetings + calls, today through 3 days out ----
        var eventsRaw = await _db.Activities
            .Where(a =>
                (a.AssignedToId == userId || a.OwnerId == userId) &&
                (a.Type == ActivityType.Meeting || a.Type == ActivityType.Call) &&
                a.Status != ActivityStatus.Done &&
                a.DueDate != null &&
                a.DueDate >= todayStart &&
                a.DueDate < upcomingEnd)
            .OrderBy(a => a.DueDate)
            .Take(8)
            .Select(a => new
            {
                a.Id,
                a.Subject,
                a.Type,
                a.DueDate,
                AssignedToName = a.AssignedTo != null
                    ? (a.AssignedTo.FirstName + " " + a.AssignedTo.LastName).Trim()
                    : null
            })
            .ToListAsync();

        var upcomingEvents = eventsRaw.Select(a => new MyDayEventDto
        {
            Id = a.Id,
            Subject = a.Subject,
            Type = a.Type.ToString(),
            DueDate = a.DueDate,
            AssignedToName = a.AssignedToName
        }).ToList();

        // ---- Pipeline: active deals grouped by stage ----
        var dealStageData = await _db.Deals
            .Include(d => d.Stage)
            .Where(d => d.OwnerId == userId && !d.Stage.IsWon && !d.Stage.IsLost)
            .Select(d => new
            {
                StageName = d.Stage.Name,
                StageColor = d.Stage.Color,
                d.Value
            })
            .ToListAsync();

        var pipelineStages = dealStageData
            .GroupBy(d => new { d.StageName, d.StageColor })
            .Select(g => new MyDayPipelineStageDto
            {
                StageName = g.Key.StageName,
                Color = g.Key.StageColor,
                DealCount = g.Count(),
                TotalValue = g.Sum(d => d.Value ?? 0)
            })
            .ToList();

        var pipelineTotalValue = dealStageData.Sum(d => d.Value ?? 0);
        var pipelineDealCount = dealStageData.Count;

        // ---- Emails: recent + unread count ----
        var userEmailAccountIds = await _db.EmailAccounts
            .Where(ea => ea.UserId == userId)
            .Select(ea => ea.Id)
            .ToListAsync();

        var recentEmails = new List<MyDayEmailDto>();
        var unreadEmailCount = 0;

        if (userEmailAccountIds.Count > 0)
        {
            recentEmails = await _db.EmailMessages
                .Where(e => userEmailAccountIds.Contains(e.EmailAccountId))
                .OrderByDescending(e => e.SentAt)
                .Take(5)
                .Select(e => new MyDayEmailDto
                {
                    Id = e.Id,
                    Subject = e.Subject,
                    FromName = e.FromName,
                    SentAt = e.SentAt,
                    IsInbound = e.IsInbound,
                    IsRead = e.IsRead
                })
                .ToListAsync();

            unreadEmailCount = await _db.EmailMessages
                .Where(e => userEmailAccountIds.Contains(e.EmailAccountId) && !e.IsRead)
                .CountAsync();
        }

        // ---- Feed: recent items ----
        var feedRaw = await _db.FeedItems
            .Include(f => f.Author)
            .OrderByDescending(f => f.CreatedAt)
            .Take(5)
            .Select(f => new
            {
                f.Id,
                f.Type,
                f.Content,
                f.EntityType,
                f.EntityId,
                f.EntityName,
                AuthorName = f.Author != null
                    ? (f.Author.FirstName + " " + f.Author.LastName).Trim()
                    : null,
                f.CreatedAt
            })
            .ToListAsync();

        var recentFeedItems = feedRaw.Select(f => new MyDayFeedItemDto
        {
            Id = f.Id,
            Type = f.Type.ToString(),
            Content = f.Content,
            EntityType = f.EntityType,
            EntityId = f.EntityId,
            EntityName = f.EntityName,
            AuthorName = f.AuthorName,
            CreatedAt = f.CreatedAt
        }).ToList();

        // ---- Notifications: today, grouped by type ----
        var notificationsRaw = await _db.Notifications
            .Where(n => n.UserId == userId && n.CreatedAt >= todayStart)
            .OrderByDescending(n => n.CreatedAt)
            .ToListAsync();

        var notificationGroups = notificationsRaw
            .GroupBy(n => n.Type)
            .Select(g => new MyDayNotificationGroupDto
            {
                Type = g.Key.ToString(),
                Count = g.Count(),
                Items = g.Take(3).Select(n => new MyDayNotificationDto
                {
                    Id = n.Id,
                    Title = n.Title,
                    Message = n.Message,
                    EntityType = n.EntityType,
                    EntityId = n.EntityId,
                    IsRead = n.IsRead,
                    CreatedAt = n.CreatedAt
                }).ToList()
            })
            .ToList();

        var todayNotificationCount = notificationsRaw.Count;

        // ---- Recent records ----
        var recentRecords = await _db.RecentlyViewedEntities
            .Where(r => r.UserId == userId)
            .OrderByDescending(r => r.ViewedAt)
            .Take(8)
            .Select(r => new MyDayRecentRecordDto
            {
                EntityType = r.EntityType,
                EntityId = r.EntityId,
                EntityName = r.EntityName,
                ViewedAt = r.ViewedAt
            })
            .ToListAsync();

        // ---- Greeting stats ----
        var tasksTodayCount = tasks.Count(t => !t.IsOverdue);
        var overdueCount = tasks.Count(t => t.IsOverdue);
        var upcomingMeetingsCount = upcomingEvents.Count;

        var dto = new MyDayDto
        {
            TasksTodayCount = tasksTodayCount,
            OverdueCount = overdueCount,
            UpcomingMeetingsCount = upcomingMeetingsCount,
            Tasks = tasks,
            UpcomingEvents = upcomingEvents,
            PipelineStages = pipelineStages,
            PipelineTotalValue = pipelineTotalValue,
            PipelineDealCount = pipelineDealCount,
            UnreadEmailCount = unreadEmailCount,
            RecentEmails = recentEmails,
            RecentFeedItems = recentFeedItems,
            NotificationGroups = notificationGroups,
            TodayNotificationCount = todayNotificationCount,
            RecentRecords = recentRecords
        };

        return Ok(dto);
    }

    /// <summary>
    /// Records a recently viewed entity for the current user (upsert pattern).
    /// If the entity was already tracked, updates ViewedAt and EntityName.
    /// </summary>
    [HttpPost("track-view")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> TrackView([FromBody] TrackViewRequest request)
    {
        var userId = GetCurrentUserId();
        var tenantId = _tenantProvider.GetTenantId()
            ?? throw new InvalidOperationException("No tenant context.");

        var existing = await _db.RecentlyViewedEntities
            .FirstOrDefaultAsync(r =>
                r.UserId == userId &&
                r.EntityType == request.EntityType &&
                r.EntityId == request.EntityId);

        if (existing is not null)
        {
            existing.ViewedAt = DateTimeOffset.UtcNow;
            existing.EntityName = request.EntityName;
        }
        else
        {
            _db.RecentlyViewedEntities.Add(new RecentlyViewedEntity
            {
                TenantId = tenantId,
                UserId = userId,
                EntityType = request.EntityType,
                EntityId = request.EntityId,
                EntityName = request.EntityName,
                ViewedAt = DateTimeOffset.UtcNow
            });
        }

        await _db.SaveChangesAsync();
        return Ok();
    }

    /// <summary>
    /// Marks a task (activity) as completed from the My Day dashboard.
    /// Only works for activities assigned to or owned by the current user.
    /// </summary>
    [HttpPatch("tasks/{taskId:guid}/complete")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> CompleteTask(Guid taskId)
    {
        var userId = GetCurrentUserId();

        var activity = await _db.Activities
            .FirstOrDefaultAsync(a =>
                a.Id == taskId &&
                (a.AssignedToId == userId || a.OwnerId == userId));

        if (activity is null)
            return NotFound(new { error = "Task not found or not assigned to you." });

        activity.Status = ActivityStatus.Done;
        activity.CompletedAt = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync();
        return Ok();
    }

    // ---- Helper Methods ----

    private Guid GetCurrentUserId()
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? throw new InvalidOperationException("User ID not found in claims.");
        return Guid.Parse(userIdClaim);
    }
}

// ---- DTOs ----

/// <summary>
/// Top-level My Day response containing all widget data for the dashboard.
/// </summary>
public record MyDayDto
{
    // Greeting stats
    public int TasksTodayCount { get; init; }
    public int OverdueCount { get; init; }
    public int UpcomingMeetingsCount { get; init; }

    // Tasks widget (today + overdue)
    public List<MyDayTaskDto> Tasks { get; init; } = new();

    // Upcoming events widget (today + next 2 days)
    public List<MyDayEventDto> UpcomingEvents { get; init; } = new();

    // Pipeline widget
    public List<MyDayPipelineStageDto> PipelineStages { get; init; } = new();
    public decimal PipelineTotalValue { get; init; }
    public int PipelineDealCount { get; init; }

    // Emails widget
    public int UnreadEmailCount { get; init; }
    public List<MyDayEmailDto> RecentEmails { get; init; } = new();

    // Feed widget
    public List<MyDayFeedItemDto> RecentFeedItems { get; init; } = new();

    // Notifications widget
    public List<MyDayNotificationGroupDto> NotificationGroups { get; init; } = new();
    public int TodayNotificationCount { get; init; }

    // Recent records widget
    public List<MyDayRecentRecordDto> RecentRecords { get; init; } = new();
}

/// <summary>
/// Task (activity) DTO with overdue indicators for the My Day tasks widget.
/// </summary>
public record MyDayTaskDto
{
    public Guid Id { get; init; }
    public string Subject { get; init; } = string.Empty;
    public string Type { get; init; } = string.Empty;
    public string Status { get; init; } = string.Empty;
    public string Priority { get; init; } = string.Empty;
    public DateTimeOffset? DueDate { get; init; }
    public bool IsOverdue { get; init; }
    public int DaysOverdue { get; init; }
    public string? LinkedEntityType { get; init; }
    public Guid? LinkedEntityId { get; init; }
    public string? LinkedEntityName { get; init; }
}

/// <summary>
/// Upcoming event (meeting/call) DTO for the My Day calendar widget.
/// </summary>
public record MyDayEventDto
{
    public Guid Id { get; init; }
    public string Subject { get; init; } = string.Empty;
    public string Type { get; init; } = string.Empty;
    public DateTimeOffset? DueDate { get; init; }
    public string? AssignedToName { get; init; }
}

/// <summary>
/// Pipeline stage summary with deal count and total value.
/// </summary>
public record MyDayPipelineStageDto
{
    public string StageName { get; init; } = string.Empty;
    public string Color { get; init; } = string.Empty;
    public int DealCount { get; init; }
    public decimal TotalValue { get; init; }
}

/// <summary>
/// Recent email DTO for the My Day emails widget.
/// </summary>
public record MyDayEmailDto
{
    public Guid Id { get; init; }
    public string Subject { get; init; } = string.Empty;
    public string FromName { get; init; } = string.Empty;
    public DateTimeOffset SentAt { get; init; }
    public bool IsInbound { get; init; }
    public bool IsRead { get; init; }
}

/// <summary>
/// Feed item DTO for the My Day activity feed widget.
/// </summary>
public record MyDayFeedItemDto
{
    public Guid Id { get; init; }
    public string Type { get; init; } = string.Empty;
    public string Content { get; init; } = string.Empty;
    public string? EntityType { get; init; }
    public Guid? EntityId { get; init; }
    public string? EntityName { get; init; }
    public string? AuthorName { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
}

/// <summary>
/// Notification group (by type) for the My Day notifications widget.
/// </summary>
public record MyDayNotificationGroupDto
{
    public string Type { get; init; } = string.Empty;
    public int Count { get; init; }
    public List<MyDayNotificationDto> Items { get; init; } = new();
}

/// <summary>
/// Individual notification DTO within a notification group.
/// </summary>
public record MyDayNotificationDto
{
    public Guid Id { get; init; }
    public string Title { get; init; } = string.Empty;
    public string Message { get; init; } = string.Empty;
    public string? EntityType { get; init; }
    public Guid? EntityId { get; init; }
    public bool IsRead { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
}

/// <summary>
/// Recently viewed entity DTO for the My Day recent records widget.
/// </summary>
public record MyDayRecentRecordDto
{
    public string EntityType { get; init; } = string.Empty;
    public Guid EntityId { get; init; }
    public string EntityName { get; init; } = string.Empty;
    public DateTimeOffset ViewedAt { get; init; }
}

/// <summary>
/// Request body for tracking a recently viewed entity.
/// </summary>
public record TrackViewRequest
{
    public string EntityType { get; init; } = string.Empty;
    public Guid EntityId { get; init; }
    public string EntityName { get; init; } = string.Empty;
}

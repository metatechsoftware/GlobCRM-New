using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Enums;
using GlobCRM.Domain.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace GlobCRM.Api.Controllers;

/// <summary>
/// REST endpoints for notification operations: paged listing, unread count,
/// mark-as-read/unread, mark-all-read, and per-type notification preferences.
/// All endpoints require authentication and operate on the current user's notifications.
/// </summary>
[ApiController]
[Route("api/notifications")]
[Authorize]
public class NotificationsController : ControllerBase
{
    private readonly INotificationRepository _notificationRepository;
    private readonly ITenantProvider _tenantProvider;
    private readonly ILogger<NotificationsController> _logger;

    public NotificationsController(
        INotificationRepository notificationRepository,
        ITenantProvider tenantProvider,
        ILogger<NotificationsController> logger)
    {
        _notificationRepository = notificationRepository;
        _tenantProvider = tenantProvider;
        _logger = logger;
    }

    // ---- Notification List / Count ----

    /// <summary>
    /// Gets a paged list of notifications for the current user, ordered by CreatedAt descending.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(NotificationPagedResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetList([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var userId = GetCurrentUserId();
        var pagedResult = await _notificationRepository.GetPagedAsync(userId, page, pageSize);

        var response = new NotificationPagedResponse
        {
            Items = pagedResult.Items.Select(NotificationDto.FromEntity).ToList(),
            TotalCount = pagedResult.TotalCount,
            Page = pagedResult.Page,
            PageSize = pagedResult.PageSize
        };

        return Ok(response);
    }

    /// <summary>
    /// Gets the count of unread notifications for the current user.
    /// </summary>
    [HttpGet("unread-count")]
    [ProducesResponseType(typeof(UnreadCountResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetUnreadCount()
    {
        var userId = GetCurrentUserId();
        var count = await _notificationRepository.GetUnreadCountAsync(userId);

        return Ok(new UnreadCountResponse { Count = count });
    }

    // ---- Read / Unread State ----

    /// <summary>
    /// Marks a single notification as read.
    /// </summary>
    [HttpPatch("{id:guid}/read")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> MarkAsRead(Guid id)
    {
        var notification = await _notificationRepository.GetByIdAsync(id);
        if (notification is null)
            return NotFound(new { error = "Notification not found." });

        // Ensure user owns this notification
        var userId = GetCurrentUserId();
        if (notification.UserId != userId)
            return NotFound(new { error = "Notification not found." });

        await _notificationRepository.MarkAsReadAsync(id);
        return NoContent();
    }

    /// <summary>
    /// Marks a single notification as unread.
    /// </summary>
    [HttpPatch("{id:guid}/unread")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> MarkAsUnread(Guid id)
    {
        var notification = await _notificationRepository.GetByIdAsync(id);
        if (notification is null)
            return NotFound(new { error = "Notification not found." });

        // Ensure user owns this notification
        var userId = GetCurrentUserId();
        if (notification.UserId != userId)
            return NotFound(new { error = "Notification not found." });

        await _notificationRepository.MarkAsUnreadAsync(id);
        return NoContent();
    }

    /// <summary>
    /// Marks all unread notifications as read for the current user.
    /// </summary>
    [HttpPost("mark-all-read")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> MarkAllAsRead()
    {
        var userId = GetCurrentUserId();
        await _notificationRepository.MarkAllAsReadAsync(userId);
        return NoContent();
    }

    // ---- Preferences ----

    /// <summary>
    /// Gets notification preferences for the current user.
    /// Returns defaults (all types with InApp=true, Email=true) if user has no preferences.
    /// </summary>
    [HttpGet("preferences")]
    [ProducesResponseType(typeof(List<NotificationPreferenceDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetPreferences()
    {
        var userId = GetCurrentUserId();
        var preferences = await _notificationRepository.GetPreferencesAsync(userId);

        // Build a map of existing preferences
        var prefMap = preferences.ToDictionary(p => p.NotificationType);

        // Return all notification types, using stored preference or default
        var allTypes = Enum.GetValues<NotificationType>();
        var result = allTypes.Select(type =>
        {
            if (prefMap.TryGetValue(type, out var pref))
            {
                return new NotificationPreferenceDto
                {
                    NotificationType = type,
                    InAppEnabled = pref.InAppEnabled,
                    EmailEnabled = pref.EmailEnabled
                };
            }
            // Default: both channels enabled
            return new NotificationPreferenceDto
            {
                NotificationType = type,
                InAppEnabled = true,
                EmailEnabled = true
            };
        }).ToList();

        return Ok(result);
    }

    /// <summary>
    /// Updates notification preferences for the current user.
    /// Upserts each preference by notification type.
    /// </summary>
    [HttpPut("preferences")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> UpdatePreferences([FromBody] List<NotificationPreferenceDto> preferences)
    {
        var userId = GetCurrentUserId();
        var tenantId = _tenantProvider.GetTenantId()
            ?? throw new InvalidOperationException("Tenant context not available.");

        foreach (var dto in preferences)
        {
            var preference = new NotificationPreference
            {
                TenantId = tenantId,
                UserId = userId,
                NotificationType = dto.NotificationType,
                InAppEnabled = dto.InAppEnabled,
                EmailEnabled = dto.EmailEnabled
            };

            await _notificationRepository.UpdatePreferenceAsync(preference);
        }

        return Ok();
    }

    // ---- Helpers ----

    private Guid GetCurrentUserId()
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? throw new InvalidOperationException("User ID not found in claims.");
        return Guid.Parse(userIdClaim);
    }
}

// ---- DTOs ----

/// <summary>
/// DTO for notification list items.
/// </summary>
public record NotificationDto
{
    public Guid Id { get; init; }
    public NotificationType Type { get; init; }
    public string Title { get; init; } = string.Empty;
    public string Message { get; init; } = string.Empty;
    public string? EntityType { get; init; }
    public Guid? EntityId { get; init; }
    public bool IsRead { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
    public string? CreatedByName { get; init; }

    public static NotificationDto FromEntity(Notification entity) => new()
    {
        Id = entity.Id,
        Type = entity.Type,
        Title = entity.Title,
        Message = entity.Message,
        EntityType = entity.EntityType,
        EntityId = entity.EntityId,
        IsRead = entity.IsRead,
        CreatedAt = entity.CreatedAt,
        CreatedByName = entity.CreatedBy?.FullName
    };
}

/// <summary>
/// DTO for notification preferences per type.
/// </summary>
public record NotificationPreferenceDto
{
    public NotificationType NotificationType { get; init; }
    public bool InAppEnabled { get; init; }
    public bool EmailEnabled { get; init; }
}

/// <summary>
/// Response wrapper for paged notification list.
/// </summary>
public record NotificationPagedResponse
{
    public List<NotificationDto> Items { get; init; } = new();
    public int TotalCount { get; init; }
    public int Page { get; init; }
    public int PageSize { get; init; }
}

/// <summary>
/// Response for unread notification count.
/// </summary>
public record UnreadCountResponse
{
    public int Count { get; init; }
}

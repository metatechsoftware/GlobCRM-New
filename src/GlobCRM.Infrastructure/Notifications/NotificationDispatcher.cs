using GlobCRM.Application.Common;
using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Enums;
using GlobCRM.Infrastructure.Persistence;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace GlobCRM.Infrastructure.Notifications;

/// <summary>
/// Request object for dispatching a notification through the notification pipeline.
/// </summary>
public record NotificationRequest
{
    public Guid RecipientId { get; init; }
    public NotificationType Type { get; init; }
    public string Title { get; init; } = string.Empty;
    public string Message { get; init; } = string.Empty;
    public string? EntityType { get; init; }
    public Guid? EntityId { get; init; }
    public Guid? CreatedById { get; init; }
}

/// <summary>
/// Central service for notification delivery coordination.
/// Dispatches notifications through 3 channels: DB persistence, SignalR push, and optional email.
/// Email failures are caught and logged (fire-and-forget) to avoid failing the entire dispatch.
/// </summary>
public class NotificationDispatcher
{
    private readonly ApplicationDbContext _db;
    private readonly IHubContext<CrmHub> _hubContext;
    private readonly IEmailService _emailService;
    private readonly ILogger<NotificationDispatcher> _logger;

    public NotificationDispatcher(
        ApplicationDbContext db,
        IHubContext<CrmHub> hubContext,
        IEmailService emailService,
        ILogger<NotificationDispatcher> logger)
    {
        _db = db;
        _hubContext = hubContext;
        _emailService = emailService;
        _logger = logger;
    }

    /// <summary>
    /// Dispatches a notification: persists to DB, pushes via SignalR, and optionally sends email.
    /// </summary>
    public async Task DispatchAsync(NotificationRequest request)
    {
        // 1. Create and persist notification entity
        var notification = new Notification
        {
            TenantId = GetTenantId(),
            UserId = request.RecipientId,
            Type = request.Type,
            Title = request.Title,
            Message = request.Message,
            EntityType = request.EntityType,
            EntityId = request.EntityId,
            CreatedById = request.CreatedById,
            CreatedAt = DateTimeOffset.UtcNow
        };

        _db.Notifications.Add(notification);
        await _db.SaveChangesAsync();

        // 2. Push via SignalR to user group
        var dto = new
        {
            notification.Id,
            notification.Type,
            notification.Title,
            notification.Message,
            notification.EntityType,
            notification.EntityId,
            notification.CreatedAt,
            notification.IsRead
        };

        await _hubContext.Clients
            .Group($"user_{request.RecipientId}")
            .SendAsync("ReceiveNotification", dto);

        _logger.LogInformation(
            "Notification dispatched: Id={Id}, Type={Type}, RecipientId={RecipientId}",
            notification.Id, request.Type, request.RecipientId);

        // 3. Check user preferences and optionally send email
        try
        {
            var preference = await _db.NotificationPreferences
                .FirstOrDefaultAsync(p =>
                    p.UserId == request.RecipientId
                    && p.NotificationType == request.Type);

            // Default: email enabled if no preference exists
            var emailEnabled = preference?.EmailEnabled ?? true;

            if (emailEnabled)
            {
                var user = await _db.Users
                    .FirstOrDefaultAsync(u => u.Id == request.RecipientId);

                if (user?.Email != null)
                {
                    var entityUrl = request.EntityType != null && request.EntityId != null
                        ? $"/{request.EntityType.ToLower()}s/{request.EntityId}"
                        : null;

                    await _emailService.SendNotificationEmailAsync(
                        user.Email,
                        user.FullName ?? user.Email,
                        request.Title,
                        request.Message,
                        entityUrl);
                }
            }
        }
        catch (Exception ex)
        {
            // Fire-and-forget: email failure should not fail the notification dispatch
            _logger.LogError(ex,
                "Failed to send notification email: NotificationId={Id}, RecipientId={RecipientId}",
                notification.Id, request.RecipientId);
        }
    }

    /// <summary>
    /// Sends a "FeedUpdate" event to all clients in the tenant group for real-time feed updates.
    /// </summary>
    public async Task DispatchToTenantFeedAsync(Guid tenantId, object feedUpdate)
    {
        await _hubContext.Clients
            .Group($"tenant_{tenantId}")
            .SendAsync("FeedUpdate", feedUpdate);

        _logger.LogInformation(
            "Feed update dispatched to tenant: TenantId={TenantId}",
            tenantId);
    }

    /// <summary>
    /// Gets the current tenant ID from the DbContext's tenant info.
    /// </summary>
    private Guid GetTenantId()
    {
        var tenantInfo = _db.TenantInfo;
        if (tenantInfo?.Id != null && Guid.TryParse(tenantInfo.Id, out var tenantId))
        {
            return tenantId;
        }

        throw new InvalidOperationException("Tenant context not available for notification dispatch.");
    }
}

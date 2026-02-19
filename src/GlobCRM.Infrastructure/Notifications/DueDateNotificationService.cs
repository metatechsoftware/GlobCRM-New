using System.Diagnostics;
using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Enums;
using GlobCRM.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace GlobCRM.Infrastructure.Notifications;

/// <summary>
/// Background service that periodically checks for activities with approaching due dates
/// and dispatches DueDateApproaching notifications to the owner and assignee.
/// Runs as a hosted service, creating a new DI scope per check cycle to resolve scoped services.
/// Configurable interval via Notifications:DueDateCheckIntervalHours (default 1 hour).
/// Never crashes the host -- all exceptions are caught and logged.
/// Follows EmailSyncBackgroundService pattern exactly.
/// </summary>
public class DueDateNotificationService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<DueDateNotificationService> _logger;
    private readonly TimeSpan _checkInterval;

    public DueDateNotificationService(
        IServiceScopeFactory scopeFactory,
        ILogger<DueDateNotificationService> logger,
        IConfiguration configuration)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;

        var intervalHours = configuration.GetValue("Notifications:DueDateCheckIntervalHours", 1);
        _checkInterval = TimeSpan.FromHours(intervalHours);
    }

    /// <summary>
    /// Main execution loop. Runs check cycles at the configured interval until cancellation.
    /// Each cycle creates a new DI scope, resolves ApplicationDbContext and NotificationDispatcher,
    /// queries activities due within 24 hours, and dispatches notifications without duplicates.
    /// </summary>
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation(
            "Due date notification service started. Interval: {Interval} hours",
            _checkInterval.TotalHours);

        while (!stoppingToken.IsCancellationRequested)
        {
            var sw = Stopwatch.StartNew();

            try
            {
                _logger.LogInformation("Due date check cycle started");

                using var scope = _scopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
                var dispatcher = scope.ServiceProvider.GetRequiredService<NotificationDispatcher>();

                await CheckDueDatesAsync(db, dispatcher, stoppingToken);

                sw.Stop();
                _logger.LogInformation(
                    "Due date check cycle completed in {Elapsed}ms",
                    sw.ElapsedMilliseconds);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                // Graceful shutdown -- do not log as error
                _logger.LogInformation("Due date notification service shutting down");
                break;
            }
            catch (Exception ex)
            {
                sw.Stop();
                _logger.LogError(ex, "Due date check cycle failed: {Message}", ex.Message);
            }

            try
            {
                await Task.Delay(_checkInterval, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                // Graceful shutdown during delay
                break;
            }
        }

        _logger.LogInformation("Due date notification service stopped");
    }

    /// <summary>
    /// Queries activities with due dates within the next 24 hours that have not been
    /// completed/cancelled and have not already had a DueDateApproaching notification
    /// sent in the last 24 hours. Dispatches notifications to both OwnerId and AssignedToId.
    /// Also creates a SystemEvent feed item for each qualifying activity.
    /// </summary>
    private async Task CheckDueDatesAsync(
        ApplicationDbContext db,
        NotificationDispatcher dispatcher,
        CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;
        var twentyFourHoursFromNow = now.AddHours(24);
        var twentyFourHoursAgo = now.AddHours(-24);

        // Get all activities due within 24 hours that are not Done or completed
        // Use IgnoreQueryFilters to check across all tenants (background service has no tenant context)
        var activities = await db.Activities
            .IgnoreQueryFilters()
            .Where(a => a.DueDate != null
                && a.DueDate <= twentyFourHoursFromNow
                && a.DueDate > now
                && a.Status != ActivityStatus.Done)
            .ToListAsync(cancellationToken);

        _logger.LogInformation("Found {Count} activities with approaching due dates", activities.Count);

        foreach (var activity in activities)
        {
            // Check for existing DueDateApproaching notification for this activity in last 24h
            var alreadyNotified = await db.Notifications
                .IgnoreQueryFilters()
                .AnyAsync(n => n.EntityId == activity.Id
                    && n.Type == NotificationType.DueDateApproaching
                    && n.CreatedAt > twentyFourHoursAgo,
                    cancellationToken);

            if (alreadyNotified)
                continue;

            // Collect recipient user IDs (owner and assignee if different)
            var recipientIds = new HashSet<Guid>();
            if (activity.OwnerId.HasValue)
                recipientIds.Add(activity.OwnerId.Value);
            if (activity.AssignedToId.HasValue)
                recipientIds.Add(activity.AssignedToId.Value);

            if (recipientIds.Count == 0)
                continue;

            // Dispatch notification to each recipient
            foreach (var recipientId in recipientIds)
            {
                try
                {
                    await dispatcher.DispatchAsync(new NotificationRequest
                    {
                        RecipientId = recipientId,
                        Type = NotificationType.DueDateApproaching,
                        Title = "Activity due soon",
                        Message = $"Activity '{activity.Subject}' is due {activity.DueDate:g}",
                        EntityType = "Activity",
                        EntityId = activity.Id,
                        CreatedById = null // System-generated
                    });
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex,
                        "Failed to dispatch due date notification for Activity {ActivityId} to user {UserId}",
                        activity.Id, recipientId);
                }
            }

            // Create a SystemEvent feed item
            try
            {
                var feedItem = new FeedItem
                {
                    TenantId = activity.TenantId,
                    Type = FeedItemType.SystemEvent,
                    Content = $"Activity '{activity.Subject}' is due soon",
                    EntityType = "Activity",
                    EntityId = activity.Id,
                    EntityName = activity.Subject,
                    AuthorId = null, // System-generated
                    CreatedAt = DateTimeOffset.UtcNow,
                    UpdatedAt = DateTimeOffset.UtcNow
                };

                db.FeedItems.Add(feedItem);
                await db.SaveChangesAsync(cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex,
                    "Failed to create feed item for due date activity {ActivityId}",
                    activity.Id);
            }
        }
    }
}

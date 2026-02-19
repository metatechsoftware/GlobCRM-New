using System.Text.Json;
using GlobCRM.Domain.Enums;
using GlobCRM.Infrastructure.Notifications;
using GlobCRM.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace GlobCRM.Infrastructure.Workflows.Actions;

/// <summary>
/// Workflow action that sends in-app notifications via the NotificationDispatcher.
/// Supports dynamic recipient resolution: record owner, deal owner, specific user, or team.
/// </summary>
public class SendNotificationAction
{
    private readonly NotificationDispatcher _notificationDispatcher;
    private readonly ApplicationDbContext _db;
    private readonly ILogger<SendNotificationAction> _logger;

    public SendNotificationAction(
        NotificationDispatcher notificationDispatcher,
        ApplicationDbContext db,
        ILogger<SendNotificationAction> logger)
    {
        _notificationDispatcher = notificationDispatcher;
        _db = db;
        _logger = logger;
    }

    /// <summary>
    /// Executes the send notification action.
    /// </summary>
    /// <param name="configJson">JSON config: { Title, Message, RecipientType, RecipientId }</param>
    /// <param name="entityData">Current entity data dictionary for recipient resolution.</param>
    /// <param name="context">Trigger context with entity and tenant information.</param>
    public async Task ExecuteAsync(
        string configJson,
        Dictionary<string, object?> entityData,
        WorkflowTriggerContext context)
    {
        var config = JsonSerializer.Deserialize<SendNotificationConfig>(configJson,
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

        if (config is null || string.IsNullOrEmpty(config.Title))
            throw new InvalidOperationException("SendNotification action requires Title in config");

        // Resolve recipient(s) based on RecipientType
        var recipientIds = await ResolveRecipientsAsync(
            config.RecipientType, config.RecipientId, entityData, context);

        if (recipientIds.Count == 0)
        {
            _logger.LogWarning(
                "SendNotification action: no recipients resolved for type {RecipientType}",
                config.RecipientType);
            return;
        }

        // Resolve merge fields in title and message
        var title = ResolveMergeFields(config.Title, entityData);
        var message = ResolveMergeFields(config.Message ?? "", entityData);

        foreach (var recipientId in recipientIds)
        {
            await _notificationDispatcher.DispatchAsync(new NotificationRequest
            {
                RecipientId = recipientId,
                Type = NotificationType.WorkflowAction,
                Title = title,
                Message = message,
                EntityType = context.EntityType,
                EntityId = context.EntityId
            }, context.TenantId);
        }

        _logger.LogDebug(
            "SendNotification action: dispatched to {Count} recipients",
            recipientIds.Count);
    }

    /// <summary>
    /// Resolves recipient user IDs based on the configured recipient type.
    /// </summary>
    private async Task<List<Guid>> ResolveRecipientsAsync(
        string? recipientType,
        Guid? recipientId,
        Dictionary<string, object?> entityData,
        WorkflowTriggerContext context)
    {
        var recipients = new List<Guid>();

        switch (recipientType?.ToLowerInvariant())
        {
            case "record_owner":
            {
                if (entityData.TryGetValue("owner_id", out var ownerId) && ownerId is Guid ownerGuid)
                    recipients.Add(ownerGuid);
                else if (ownerId is string ownerStr && Guid.TryParse(ownerStr, out var parsed))
                    recipients.Add(parsed);
                break;
            }

            case "deal_owner":
            {
                // If entity IS a deal, use its owner
                if (context.EntityType == "Deal" && entityData.TryGetValue("owner_id", out var dealOwner))
                {
                    if (dealOwner is Guid dOwnerGuid)
                        recipients.Add(dOwnerGuid);
                    else if (dealOwner is string dOwnerStr && Guid.TryParse(dOwnerStr, out var parsed))
                        recipients.Add(parsed);
                }
                break;
            }

            case "specific_user":
            {
                if (recipientId.HasValue)
                    recipients.Add(recipientId.Value);
                break;
            }

            case "team":
            {
                if (recipientId.HasValue)
                {
                    var teamMembers = await _db.TeamMembers
                        .Where(tm => tm.TeamId == recipientId.Value)
                        .Select(tm => tm.UserId)
                        .ToListAsync();
                    recipients.AddRange(teamMembers);
                }
                break;
            }
        }

        return recipients;
    }

    /// <summary>
    /// Simple merge field replacement for notification text.
    /// Replaces {{field_name}} patterns with entity data values.
    /// </summary>
    private static string ResolveMergeFields(string template, Dictionary<string, object?> entityData)
    {
        foreach (var kvp in entityData)
        {
            if (kvp.Value is not null && kvp.Value is not Dictionary<string, object?>)
            {
                template = template.Replace($"{{{{{kvp.Key}}}}}", kvp.Value.ToString(),
                    StringComparison.OrdinalIgnoreCase);
            }
        }
        return template;
    }

    private class SendNotificationConfig
    {
        public string Title { get; set; } = string.Empty;
        public string? Message { get; set; }
        public string? RecipientType { get; set; }
        public Guid? RecipientId { get; set; }
    }
}

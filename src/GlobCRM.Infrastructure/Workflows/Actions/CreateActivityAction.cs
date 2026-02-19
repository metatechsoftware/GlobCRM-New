using System.Text.Json;
using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Enums;
using GlobCRM.Infrastructure.Persistence;
using Microsoft.Extensions.Logging;

namespace GlobCRM.Infrastructure.Workflows.Actions;

/// <summary>
/// Workflow action that creates a new Activity entity linked to the triggering entity.
/// Supports dynamic assignment (record owner, deal owner, specific user).
/// Merge field placeholders in subject are resolved from entity data.
/// </summary>
public class CreateActivityAction
{
    private readonly ApplicationDbContext _db;
    private readonly ILogger<CreateActivityAction> _logger;

    public CreateActivityAction(ApplicationDbContext db, ILogger<CreateActivityAction> logger)
    {
        _db = db;
        _logger = logger;
    }

    /// <summary>
    /// Executes the create activity action.
    /// </summary>
    /// <param name="configJson">JSON config: { Subject, Type, Priority, DueDateOffsetDays, AssigneeType, AssigneeId }</param>
    /// <param name="entityData">Current entity data for merge field resolution and assignee lookup.</param>
    /// <param name="context">Trigger context with entity type, ID, and tenant.</param>
    public async Task ExecuteAsync(
        string configJson,
        Dictionary<string, object?> entityData,
        WorkflowTriggerContext context)
    {
        var config = JsonSerializer.Deserialize<CreateActivityConfig>(configJson,
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

        if (config is null || string.IsNullOrEmpty(config.Subject))
            throw new InvalidOperationException("CreateActivity action requires Subject in config");

        // Resolve assignee
        var assigneeId = ResolveAssignee(
            config.AssigneeType, config.AssigneeId, entityData, context);

        // Resolve merge fields in subject
        var subject = ResolveMergeFields(config.Subject, entityData);

        // Parse activity type and priority
        var activityType = Enum.TryParse<ActivityType>(config.Type, true, out var parsedType)
            ? parsedType
            : ActivityType.Task;

        var priority = Enum.TryParse<ActivityPriority>(config.Priority, true, out var parsedPriority)
            ? parsedPriority
            : ActivityPriority.Medium;

        // Create the activity
        var activity = new Activity
        {
            TenantId = context.TenantId,
            Subject = subject,
            Type = activityType,
            Priority = priority,
            Status = ActivityStatus.Assigned,
            DueDate = DateTimeOffset.UtcNow.AddDays(config.DueDateOffsetDays),
            OwnerId = assigneeId,
            AssignedToId = assigneeId
        };

        _db.Activities.Add(activity);
        await _db.SaveChangesAsync();

        // Link activity to triggering entity via ActivityLink
        var activityLink = new ActivityLink
        {
            ActivityId = activity.Id,
            EntityType = context.EntityType,
            EntityId = context.EntityId,
            EntityName = GetEntityDisplayName(entityData, context.EntityType),
            LinkedAt = DateTimeOffset.UtcNow
        };

        _db.ActivityLinks.Add(activityLink);
        await _db.SaveChangesAsync();

        _logger.LogDebug(
            "CreateActivity action: created activity {ActivityId} linked to {EntityType}/{EntityId}",
            activity.Id, context.EntityType, context.EntityId);
    }

    /// <summary>
    /// Resolves the assignee user ID based on the configured assignee type.
    /// </summary>
    private static Guid? ResolveAssignee(
        string? assigneeType,
        Guid? assigneeId,
        Dictionary<string, object?> entityData,
        WorkflowTriggerContext context)
    {
        switch (assigneeType?.ToLowerInvariant())
        {
            case "record_owner":
            {
                if (entityData.TryGetValue("owner_id", out var ownerId))
                {
                    if (ownerId is Guid ownerGuid)
                        return ownerGuid;
                    if (ownerId is string ownerStr && Guid.TryParse(ownerStr, out var parsed))
                        return parsed;
                }
                return null;
            }

            case "deal_owner":
            {
                if (context.EntityType == "Deal" && entityData.TryGetValue("owner_id", out var dealOwner))
                {
                    if (dealOwner is Guid dOwnerGuid)
                        return dOwnerGuid;
                    if (dealOwner is string dOwnerStr && Guid.TryParse(dOwnerStr, out var parsed))
                        return parsed;
                }
                return null;
            }

            case "specific_user":
                return assigneeId;

            default:
                return null;
        }
    }

    /// <summary>
    /// Gets a display name for the entity based on its type and data.
    /// </summary>
    private static string? GetEntityDisplayName(
        Dictionary<string, object?> entityData, string entityType)
    {
        return entityType switch
        {
            "Contact" => $"{entityData.GetValueOrDefault("first_name")} {entityData.GetValueOrDefault("last_name")}".Trim(),
            "Company" => entityData.GetValueOrDefault("name")?.ToString(),
            "Deal" => entityData.GetValueOrDefault("title")?.ToString(),
            "Lead" => $"{entityData.GetValueOrDefault("first_name")} {entityData.GetValueOrDefault("last_name")}".Trim(),
            "Activity" => entityData.GetValueOrDefault("subject")?.ToString(),
            _ => null
        };
    }

    /// <summary>
    /// Simple merge field replacement for activity subject.
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

    private class CreateActivityConfig
    {
        public string Subject { get; set; } = string.Empty;
        public string? Type { get; set; }
        public string? Priority { get; set; }
        public int DueDateOffsetDays { get; set; } = 1;
        public string? AssigneeType { get; set; }
        public Guid? AssigneeId { get; set; }
    }
}

using System.Text.Json;
using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Enums;
using GlobCRM.Domain.Interfaces;
using Hangfire;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;

namespace GlobCRM.Infrastructure.Workflows;

/// <summary>
/// Domain event handler that matches CRM entity lifecycle events to active workflows
/// and enqueues Hangfire execution jobs. Mirrors the WebhookDomainEventHandler pattern.
///
/// Design priorities:
/// - FAST: Only check cache, match triggers, serialize context, enqueue. No heavy computation.
/// - Workflows cached per tenant+entityType (60-second TTL) to avoid DB query on every SaveChanges.
/// - Loop guard prevents infinite cascading when workflow actions trigger further domain events.
/// - Cache can be invalidated from the API controller on workflow CRUD.
/// </summary>
public class WorkflowDomainEventHandler : IDomainEventHandler
{
    private readonly IBackgroundJobClient _jobClient;
    private readonly IWorkflowRepository _workflowRepository;
    private readonly ITenantProvider _tenantProvider;
    private readonly WorkflowLoopGuard _loopGuard;
    private readonly IMemoryCache _cache;
    private readonly ILogger<WorkflowDomainEventHandler> _logger;

    /// <summary>
    /// The set of entity types eligible for workflow triggers.
    /// Per locked decision: core 5 entities, same as webhooks.
    /// </summary>
    private static readonly HashSet<string> EligibleEntities =
    [
        "Contact", "Company", "Deal", "Lead", "Activity"
    ];

    /// <summary>
    /// Cache duration for active workflows per tenant+entityType.
    /// 60-second TTL balances performance with freshness.
    /// </summary>
    private static readonly TimeSpan CacheDuration = TimeSpan.FromSeconds(60);

    public WorkflowDomainEventHandler(
        IBackgroundJobClient jobClient,
        IWorkflowRepository workflowRepository,
        ITenantProvider tenantProvider,
        WorkflowLoopGuard loopGuard,
        IMemoryCache cache,
        ILogger<WorkflowDomainEventHandler> logger)
    {
        _jobClient = jobClient;
        _workflowRepository = workflowRepository;
        _tenantProvider = tenantProvider;
        _loopGuard = loopGuard;
        _cache = cache;
        _logger = logger;
    }

    /// <summary>
    /// Handles a domain event by matching it to active workflows and enqueuing
    /// Hangfire execution jobs for each match. One workflow failure doesn't block others.
    /// </summary>
    public async Task HandleAsync(DomainEvent domainEvent, CancellationToken ct)
    {
        // 1. Check if entity is eligible (early return if not)
        if (!EligibleEntities.Contains(domainEvent.EntityName))
            return;

        // 2. Get tenant ID (early return if null)
        var tenantId = _tenantProvider.GetTenantId();
        if (!tenantId.HasValue)
            return;

        // 3. Check loop guard depth (early return if at limit)
        if (!_loopGuard.CanExecute())
        {
            _logger.LogWarning(
                "Workflow loop guard blocked execution for tenant {TenantId}, entity {EntityName} — depth {Depth} >= {MaxDepth}",
                tenantId.Value, domainEvent.EntityName, _loopGuard.CurrentDepth, WorkflowLoopGuard.MaxDepth);
            return;
        }

        // 4. Load active workflows from cache (60-second TTL per tenant+entityType)
        var cacheKey = $"workflow_active_{tenantId.Value}_{domainEvent.EntityName}";
        var workflows = await _cache.GetOrCreateAsync(cacheKey, async entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = CacheDuration;
            return await _workflowRepository.GetActiveWorkflowsAsync(domainEvent.EntityName, ct);
        });

        if (workflows is null or { Count: 0 })
            return;

        // 5. Match triggers and enqueue execution jobs
        foreach (var workflow in workflows)
        {
            try
            {
                if (!MatchesTrigger(workflow, domainEvent))
                    continue;

                // Determine the trigger type string for context
                var triggerType = DetermineTriggerType(workflow, domainEvent);

                // Serialize changed properties for Hangfire (avoids DbContext disposal issues)
                var changedPropertiesJson = domainEvent.ChangedProperties is not null
                    ? JsonSerializer.Serialize(domainEvent.ChangedProperties)
                    : null;

                var oldPropertyValuesJson = domainEvent.OldPropertyValues is not null
                    ? JsonSerializer.Serialize(domainEvent.OldPropertyValues)
                    : null;

                var context = new WorkflowTriggerContext(
                    WorkflowId: workflow.Id,
                    EntityId: domainEvent.EntityId ?? Guid.Empty,
                    EntityType: domainEvent.EntityName,
                    TenantId: tenantId.Value,
                    TriggerType: triggerType,
                    EventType: domainEvent.EventType,
                    ChangedPropertiesJson: changedPropertiesJson,
                    OldPropertyValuesJson: oldPropertyValuesJson,
                    CurrentDepth: _loopGuard.CurrentDepth);

                _jobClient.Enqueue<WorkflowExecutionService>(
                    WorkflowExecutionService.QueueName,
                    svc => svc.ExecuteAsync(context));

                _logger.LogDebug(
                    "Workflow job enqueued: workflow {WorkflowId} ({WorkflowName}), entity {EntityType}.{EventType}",
                    workflow.Id, workflow.Name, domainEvent.EntityName, domainEvent.EventType);
            }
            catch (Exception ex)
            {
                // Don't let one workflow failure block others
                _logger.LogError(ex,
                    "Failed to enqueue workflow {WorkflowId} for event {EntityName}.{EventType}",
                    workflow.Id, domainEvent.EntityName, domainEvent.EventType);
            }
        }
    }

    /// <summary>
    /// Checks if any trigger on the workflow matches the domain event.
    /// DateBased triggers are handled by DateTriggerScanService, not here.
    /// </summary>
    private static bool MatchesTrigger(Workflow workflow, DomainEvent domainEvent)
    {
        foreach (var trigger in workflow.Definition.Triggers)
        {
            switch (trigger.TriggerType)
            {
                case WorkflowTriggerType.RecordCreated:
                    if (domainEvent.EventType == "Created")
                        return true;
                    break;

                case WorkflowTriggerType.RecordUpdated:
                    if (domainEvent.EventType == "Updated")
                        return true;
                    break;

                case WorkflowTriggerType.RecordDeleted:
                    if (domainEvent.EventType == "Deleted")
                        return true;
                    break;

                case WorkflowTriggerType.FieldChanged:
                    if (domainEvent.EventType == "Updated" &&
                        !string.IsNullOrEmpty(trigger.FieldName) &&
                        domainEvent.ChangedProperties?.ContainsKey(trigger.FieldName) == true)
                        return true;
                    break;

                // DateBased triggers are handled by DateTriggerScanService, skip here
                case WorkflowTriggerType.DateBased:
                    break;
            }
        }

        return false;
    }

    /// <summary>
    /// Determines the trigger type string for the matching trigger.
    /// </summary>
    private static string DetermineTriggerType(Workflow workflow, DomainEvent domainEvent)
    {
        foreach (var trigger in workflow.Definition.Triggers)
        {
            switch (trigger.TriggerType)
            {
                case WorkflowTriggerType.RecordCreated when domainEvent.EventType == "Created":
                    return "RecordCreated";

                case WorkflowTriggerType.RecordUpdated when domainEvent.EventType == "Updated":
                    return "RecordUpdated";

                case WorkflowTriggerType.RecordDeleted when domainEvent.EventType == "Deleted":
                    return "RecordDeleted";

                case WorkflowTriggerType.FieldChanged
                    when domainEvent.EventType == "Updated"
                    && !string.IsNullOrEmpty(trigger.FieldName)
                    && domainEvent.ChangedProperties?.ContainsKey(trigger.FieldName) == true:
                    return $"FieldChanged:{trigger.FieldName}";
            }
        }

        return domainEvent.EventType;
    }

    /// <summary>
    /// Invalidates the cached workflow list for a tenant.
    /// Call this from the API controller on workflow create/update/delete/toggle.
    /// Removes all cache keys matching the tenant prefix pattern.
    /// </summary>
    public void InvalidateCache(Guid tenantId)
    {
        foreach (var entityType in EligibleEntities)
        {
            var cacheKey = $"workflow_active_{tenantId}_{entityType}";
            _cache.Remove(cacheKey);
        }

        _logger.LogDebug("Workflow cache invalidated for tenant {TenantId}", tenantId);
    }
}

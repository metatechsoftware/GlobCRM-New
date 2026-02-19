using GlobCRM.Domain.Enums;
using GlobCRM.Domain.Interfaces;
using GlobCRM.Infrastructure.BackgroundJobs;
using GlobCRM.Infrastructure.Persistence;
using Hangfire;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace GlobCRM.Infrastructure.Workflows;

/// <summary>
/// Hangfire recurring job that scans for workflows with DateBased triggers.
/// Runs hourly and checks if any entity's date field matches the trigger's
/// date offset + preferred time window. When matched, enqueues the workflow
/// for execution via WorkflowExecutionService.
///
/// Duplicate prevention: checks WorkflowExecutionLog to ensure each workflow+entity
/// pair is only fired once per trigger window (prevents re-firing on repeated scans).
///
/// Follows the DueDateNotificationService pattern: scans across all tenants using
/// IgnoreQueryFilters, then sets TenantScope for each workflow's tenant.
/// </summary>
public class DateTriggerScanService
{
    /// <summary>
    /// Unique Hangfire recurring job ID.
    /// </summary>
    public const string JobId = "workflow-date-trigger-scan";

    /// <summary>
    /// Hangfire queue name — same as other workflow jobs.
    /// </summary>
    public const string QueueName = "workflows";

    private readonly IWorkflowRepository _workflowRepository;
    private readonly ApplicationDbContext _db;
    private readonly IBackgroundJobClient _jobClient;
    private readonly ILogger<DateTriggerScanService> _logger;

    public DateTriggerScanService(
        IWorkflowRepository workflowRepository,
        ApplicationDbContext db,
        IBackgroundJobClient jobClient,
        ILogger<DateTriggerScanService> logger)
    {
        _workflowRepository = workflowRepository;
        _db = db;
        _jobClient = jobClient;
        _logger = logger;
    }

    /// <summary>
    /// Scans all active workflows with DateBased triggers and enqueues matching entities
    /// for workflow execution. Called hourly by Hangfire recurring job.
    /// </summary>
    [Queue(QueueName)]
    [AutomaticRetry(Attempts = 1)]
    public async Task ScanAsync()
    {
        _logger.LogInformation("Starting date trigger scan...");

        var workflows = await _workflowRepository.GetActiveWorkflowsWithDateTriggersAsync();

        if (workflows.Count == 0)
        {
            _logger.LogDebug("No active workflows with date-based triggers found");
            return;
        }

        var now = DateTimeOffset.UtcNow;
        var scanWindowStart = now.AddHours(-1); // Last hour for hourly scan
        var processedCount = 0;

        foreach (var workflow in workflows)
        {
            try
            {
                // Set tenant scope for each workflow's tenant
                TenantScope.SetCurrentTenant(workflow.TenantId);

                var dateTriggers = workflow.Definition.Triggers
                    .Where(t => t.TriggerType == WorkflowTriggerType.DateBased)
                    .ToList();

                foreach (var trigger in dateTriggers)
                {
                    if (string.IsNullOrWhiteSpace(trigger.FieldName))
                        continue;

                    // Check preferred time window (if set, only fire within +/- 30 min of preferred time)
                    if (trigger.PreferredTime.HasValue)
                    {
                        var currentTime = TimeOnly.FromDateTime(now.UtcDateTime);
                        var preferredTime = trigger.PreferredTime.Value;
                        var diffMinutes = Math.Abs((currentTime.ToTimeSpan() - preferredTime.ToTimeSpan()).TotalMinutes);
                        if (diffMinutes > 30)
                            continue;
                    }

                    // Calculate the target date based on the offset
                    var offsetDays = trigger.DateOffsetDays ?? 0;
                    var targetDate = DateOnly.FromDateTime(now.AddDays(-offsetDays).UtcDateTime);

                    // Query entities where the date field matches the target date
                    var matchingEntityIds = await FindMatchingEntitiesAsync(
                        workflow.EntityType, trigger.FieldName, targetDate, workflow.TenantId);

                    foreach (var entityId in matchingEntityIds)
                    {
                        // Duplicate prevention: check if already fired within the scan window
                        var alreadyFired = await _db.WorkflowExecutionLogs
                            .IgnoreQueryFilters()
                            .AnyAsync(l =>
                                l.WorkflowId == workflow.Id &&
                                l.EntityId == entityId &&
                                l.TriggerType == "DateBased" &&
                                l.StartedAt >= scanWindowStart);

                        if (alreadyFired)
                            continue;

                        // Enqueue workflow execution
                        var context = new WorkflowTriggerContext(
                            WorkflowId: workflow.Id,
                            EntityId: entityId,
                            EntityType: workflow.EntityType,
                            TenantId: workflow.TenantId,
                            TriggerType: "DateBased",
                            EventType: $"DateBased:{trigger.FieldName}",
                            ChangedPropertiesJson: null,
                            OldPropertyValuesJson: null,
                            CurrentDepth: 0);

                        _jobClient.Enqueue<WorkflowExecutionService>(
                            WorkflowExecutionService.QueueName,
                            svc => svc.ExecuteAsync(context));

                        processedCount++;

                        _logger.LogDebug(
                            "Date trigger fired: workflow {WorkflowId}, entity {EntityType}/{EntityId}, field {FieldName}",
                            workflow.Id, workflow.EntityType, entityId, trigger.FieldName);
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex,
                    "Error processing date triggers for workflow {WorkflowId} ({WorkflowName})",
                    workflow.Id, workflow.Name);
            }
        }

        _logger.LogInformation(
            "Date trigger scan completed. Processed {WorkflowCount} workflows, enqueued {ExecutionCount} executions",
            workflows.Count, processedCount);
    }

    /// <summary>
    /// Finds entities whose date field matches the target date.
    /// Queries the appropriate entity table based on entity type.
    /// </summary>
    private async Task<List<Guid>> FindMatchingEntitiesAsync(
        string entityType, string fieldName, DateOnly targetDate, Guid tenantId)
    {
        // For standard date fields, query the entity table directly
        // For custom fields, query the JSONB CustomFields column
        try
        {
            return entityType switch
            {
                "Deal" when fieldName.Equals("ExpectedCloseDate", StringComparison.OrdinalIgnoreCase) =>
                    await _db.Deals
                        .IgnoreQueryFilters()
                        .Where(d => d.TenantId == tenantId && d.ExpectedCloseDate == targetDate)
                        .Select(d => d.Id)
                        .ToListAsync(),

                "Activity" when fieldName.Equals("DueDate", StringComparison.OrdinalIgnoreCase) =>
                    await _db.Activities
                        .IgnoreQueryFilters()
                        .Where(a => a.TenantId == tenantId &&
                                    a.DueDate.HasValue &&
                                    DateOnly.FromDateTime(a.DueDate.Value.UtcDateTime) == targetDate)
                        .Select(a => a.Id)
                        .ToListAsync(),

                // For custom date fields or unsupported standard fields,
                // skip (custom field date querying via JSONB requires more complex handling)
                _ => []
            };
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex,
                "Failed to query {EntityType}.{FieldName} for date trigger scan",
                entityType, fieldName);
            return [];
        }
    }
}

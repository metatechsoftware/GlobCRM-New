using System.Diagnostics;
using System.Text.Json;
using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Enums;
using GlobCRM.Domain.Interfaces;
using GlobCRM.Infrastructure.BackgroundJobs;
using GlobCRM.Infrastructure.Persistence;
using Hangfire;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace GlobCRM.Infrastructure.Workflows;

/// <summary>
/// Hangfire job that executes a workflow: loads the workflow, evaluates conditions,
/// traverses the action graph (with branch/wait support), and logs execution results.
/// Called by WorkflowDomainEventHandler via Hangfire enqueue on the "workflows" queue.
///
/// Graph traversal supports:
/// - Sequential action chains (following connections from trigger node)
/// - Branch (if/else) nodes: evaluate branch condition, follow "yes" or "no" path
/// - Wait (delay) nodes: schedule remaining actions as a new delayed Hangfire job
/// - ContinueOnError per action: if false and action fails, halt; if true, continue
/// </summary>
public class WorkflowExecutionService
{
    /// <summary>
    /// Hangfire queue name for workflow execution jobs.
    /// </summary>
    public const string QueueName = "workflows";

    private readonly IWorkflowRepository _workflowRepository;
    private readonly WorkflowConditionEvaluator _conditionEvaluator;
    private readonly WorkflowActionExecutor _actionExecutor;
    private readonly WorkflowLoopGuard _loopGuard;
    private readonly ApplicationDbContext _db;
    private readonly IBackgroundJobClient _jobClient;
    private readonly ILogger<WorkflowExecutionService> _logger;

    public WorkflowExecutionService(
        IWorkflowRepository workflowRepository,
        WorkflowConditionEvaluator conditionEvaluator,
        WorkflowActionExecutor actionExecutor,
        WorkflowLoopGuard loopGuard,
        ApplicationDbContext db,
        IBackgroundJobClient jobClient,
        ILogger<WorkflowExecutionService> logger)
    {
        _workflowRepository = workflowRepository;
        _conditionEvaluator = conditionEvaluator;
        _actionExecutor = actionExecutor;
        _loopGuard = loopGuard;
        _db = db;
        _jobClient = jobClient;
        _logger = logger;
    }

    /// <summary>
    /// Executes a workflow triggered by a domain event.
    /// Called by Hangfire on the "workflows" queue.
    /// </summary>
    [Queue(QueueName)]
    [AutomaticRetry(Attempts = 2)]
    public async Task ExecuteAsync(WorkflowTriggerContext context)
    {
        var stopwatch = Stopwatch.StartNew();

        // 1. Set tenant scope for DbContext in Hangfire job
        TenantScope.SetCurrentTenant(context.TenantId);

        // 2. Restore loop guard depth from Hangfire job parameter
        _loopGuard.SetDepth(context.CurrentDepth);

        // 3. Increment depth (disposable decrements on exit)
        using var depthScope = _loopGuard.IncrementDepth();

        // 4. Check duplicate processing
        if (!_loopGuard.TryMarkProcessed(context.WorkflowId, context.EntityId))
        {
            _logger.LogDebug(
                "Workflow {WorkflowId} already processed for entity {EntityId}, skipping",
                context.WorkflowId, context.EntityId);
            return;
        }

        // 5. Load workflow
        var workflow = await _workflowRepository.GetByIdAsync(context.WorkflowId);
        if (workflow is null || workflow.Status != WorkflowStatus.Active || !workflow.IsActive)
        {
            _logger.LogInformation(
                "Workflow {WorkflowId} not found, inactive, or paused — skipping execution",
                context.WorkflowId);
            return;
        }

        // 6. Create execution log
        var executionLog = new WorkflowExecutionLog
        {
            TenantId = context.TenantId,
            WorkflowId = workflow.Id,
            TriggerType = context.TriggerType,
            TriggerEvent = context.EventType,
            EntityId = context.EntityId,
            EntityType = context.EntityType,
            StartedAt = DateTimeOffset.UtcNow
        };

        try
        {
            // 7. Deserialize changed properties from JSON strings
            var changedProperties = !string.IsNullOrEmpty(context.ChangedPropertiesJson)
                ? JsonSerializer.Deserialize<Dictionary<string, object?>>(context.ChangedPropertiesJson,
                    new JsonSerializerOptions { PropertyNameCaseInsensitive = true })
                : null;

            var oldPropertyValues = !string.IsNullOrEmpty(context.OldPropertyValuesJson)
                ? JsonSerializer.Deserialize<Dictionary<string, object?>>(context.OldPropertyValuesJson,
                    new JsonSerializerOptions { PropertyNameCaseInsensitive = true })
                : null;

            // 8. Build entity data by loading the actual entity
            var entityData = await LoadEntityDataAsync(context.EntityType, context.EntityId);
            if (entityData is null)
            {
                _logger.LogWarning(
                    "Entity {EntityType}/{EntityId} not found — skipping workflow execution",
                    context.EntityType, context.EntityId);
                executionLog.Status = WorkflowExecutionStatus.Failed;
                executionLog.ErrorMessage = $"Entity {context.EntityType}/{context.EntityId} not found";
                await SaveExecutionLog(executionLog, workflow, stopwatch);
                return;
            }

            // 9. Evaluate conditions
            executionLog.ConditionsEvaluated = workflow.Definition.Conditions.Count > 0;
            var conditionsPassed = _conditionEvaluator.Evaluate(
                workflow.Definition.Conditions, entityData, changedProperties, oldPropertyValues);
            executionLog.ConditionsPassed = conditionsPassed;

            if (!conditionsPassed)
            {
                _logger.LogDebug(
                    "Workflow {WorkflowId} conditions not met for entity {EntityId} — skipping",
                    workflow.Id, context.EntityId);
                executionLog.Status = WorkflowExecutionStatus.Skipped;
                await SaveExecutionLog(executionLog, workflow, stopwatch);
                return;
            }

            // 10. Execute actions by traversing the workflow graph
            var actionResults = await TraverseAndExecuteAsync(
                workflow, entityData, context, executionLog);

            // 11. Determine final status
            var allSucceeded = actionResults.All(r => r.Succeeded);
            var anySucceeded = actionResults.Any(r => r.Succeeded);

            executionLog.Status = actionResults.Count == 0
                ? WorkflowExecutionStatus.Succeeded // No actions = success
                : allSucceeded
                    ? WorkflowExecutionStatus.Succeeded
                    : anySucceeded
                        ? WorkflowExecutionStatus.PartiallyFailed
                        : WorkflowExecutionStatus.Failed;

            _logger.LogInformation(
                "Workflow {WorkflowId} execution completed: status={Status}, actions={ActionCount}",
                workflow.Id, executionLog.Status, actionResults.Count);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "Workflow {WorkflowId} execution failed with unhandled error",
                workflow.Id);
            executionLog.Status = WorkflowExecutionStatus.Failed;
            executionLog.ErrorMessage = ex.Message;
        }

        // 12. Save execution log and update workflow stats
        await SaveExecutionLog(executionLog, workflow, stopwatch);
    }

    /// <summary>
    /// Continues workflow execution from a specific node after a wait/delay.
    /// Called by Hangfire as a delayed job scheduled by a Wait node.
    /// </summary>
    [Queue(QueueName)]
    [AutomaticRetry(Attempts = 2)]
    public async Task ContinueFromNodeAsync(
        WorkflowTriggerContext context,
        Guid executionLogId,
        string startNodeId)
    {
        TenantScope.SetCurrentTenant(context.TenantId);
        _loopGuard.SetDepth(context.CurrentDepth);
        using var depthScope = _loopGuard.IncrementDepth();

        var workflow = await _workflowRepository.GetByIdAsync(context.WorkflowId);
        if (workflow is null || workflow.Status != WorkflowStatus.Active || !workflow.IsActive)
            return;

        var entityData = await LoadEntityDataAsync(context.EntityType, context.EntityId);
        if (entityData is null)
            return;

        // Load or create execution log
        var executionLog = await _db.WorkflowExecutionLogs
            .FirstOrDefaultAsync(l => l.Id == executionLogId);

        if (executionLog is null)
        {
            executionLog = new WorkflowExecutionLog
            {
                TenantId = context.TenantId,
                WorkflowId = workflow.Id,
                TriggerType = context.TriggerType,
                TriggerEvent = context.EventType,
                EntityId = context.EntityId,
                EntityType = context.EntityType,
                StartedAt = DateTimeOffset.UtcNow,
                ConditionsEvaluated = false,
                ConditionsPassed = true
            };
        }

        var stopwatch = Stopwatch.StartNew();

        try
        {
            // Continue traversal from the specified node
            var results = await TraverseFromNodeAsync(
                workflow, entityData, context, executionLog, startNodeId);

            var allSucceeded = results.All(r => r.Succeeded);
            var anySucceeded = results.Any(r => r.Succeeded);

            executionLog.Status = results.Count == 0
                ? WorkflowExecutionStatus.Succeeded
                : allSucceeded
                    ? WorkflowExecutionStatus.Succeeded
                    : anySucceeded
                        ? WorkflowExecutionStatus.PartiallyFailed
                        : WorkflowExecutionStatus.Failed;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "Workflow {WorkflowId} continuation from node {NodeId} failed",
                workflow.Id, startNodeId);
            executionLog.Status = WorkflowExecutionStatus.Failed;
            executionLog.ErrorMessage = ex.Message;
        }

        await SaveExecutionLog(executionLog, workflow, stopwatch);
    }

    /// <summary>
    /// Traverses the workflow graph starting from trigger nodes and executes actions.
    /// </summary>
    private async Task<List<ActionResult>> TraverseAndExecuteAsync(
        Workflow workflow,
        Dictionary<string, object?> entityData,
        WorkflowTriggerContext context,
        WorkflowExecutionLog executionLog)
    {
        var results = new List<ActionResult>();
        var definition = workflow.Definition;

        // Find trigger nodes
        var triggerNodes = definition.Nodes
            .Where(n => n.Type == "trigger")
            .ToList();

        if (triggerNodes.Count == 0)
        {
            // Fallback: execute actions in order
            foreach (var action in definition.Actions.OrderBy(a => a.Order))
            {
                var result = await ExecuteActionWithLogging(action, entityData, context, executionLog);
                results.Add(result);

                if (!result.Succeeded && !action.ContinueOnError)
                    break;
            }
            return results;
        }

        // Traverse from each trigger node
        foreach (var triggerNode in triggerNodes)
        {
            var nextNodeIds = GetConnectedNodeIds(definition, triggerNode.Id, null);
            foreach (var nextNodeId in nextNodeIds)
            {
                var nodeResults = await TraverseFromNodeAsync(
                    workflow, entityData, context, executionLog, nextNodeId);
                results.AddRange(nodeResults);
            }
        }

        return results;
    }

    /// <summary>
    /// Traverses the workflow graph from a specific node onward.
    /// </summary>
    private async Task<List<ActionResult>> TraverseFromNodeAsync(
        Workflow workflow,
        Dictionary<string, object?> entityData,
        WorkflowTriggerContext context,
        WorkflowExecutionLog executionLog,
        string currentNodeId)
    {
        var results = new List<ActionResult>();
        var definition = workflow.Definition;
        var visited = new HashSet<string>();

        var queue = new Queue<string>();
        queue.Enqueue(currentNodeId);

        while (queue.Count > 0)
        {
            var nodeId = queue.Dequeue();

            // Prevent infinite loops in graph traversal
            if (!visited.Add(nodeId))
                continue;

            var node = definition.Nodes.FirstOrDefault(n => n.Id == nodeId);
            if (node is null)
                continue;

            switch (node.Type)
            {
                case "action":
                {
                    // Find matching action config
                    var action = definition.Actions.FirstOrDefault(a => a.NodeId == nodeId);
                    if (action is not null)
                    {
                        var result = await ExecuteActionWithLogging(action, entityData, context, executionLog);
                        results.Add(result);

                        if (!result.Succeeded && !action.ContinueOnError)
                            return results; // Halt on failure
                    }

                    // Continue to connected nodes
                    var nextNodes = GetConnectedNodeIds(definition, nodeId, null);
                    foreach (var next in nextNodes)
                        queue.Enqueue(next);
                    break;
                }

                case "branch":
                {
                    // Evaluate branch condition from node config
                    var branchResult = EvaluateBranchCondition(node, entityData, context);
                    var branchPath = branchResult ? "yes" : "no";

                    // Follow the matching output path ("yes" or "no")
                    var branchNext = GetConnectedNodeIds(definition, nodeId, branchPath);
                    foreach (var next in branchNext)
                        queue.Enqueue(next);
                    break;
                }

                case "wait":
                {
                    // Parse wait configuration
                    var delay = ParseWaitDelay(node);

                    // Find nodes after the wait
                    var waitNext = GetConnectedNodeIds(definition, nodeId, null);

                    if (waitNext.Count > 0 && delay > TimeSpan.Zero)
                    {
                        // Schedule continuation as a delayed Hangfire job
                        foreach (var nextNode in waitNext)
                        {
                            _jobClient.Schedule<WorkflowExecutionService>(
                                QueueName,
                                svc => svc.ContinueFromNodeAsync(context, executionLog.Id, nextNode),
                                delay);

                            _logger.LogInformation(
                                "Workflow {WorkflowId} wait node: scheduled continuation to node {NextNode} after {Delay}",
                                workflow.Id, nextNode, delay);
                        }

                        return results; // Stop current traversal — continuation handles the rest
                    }

                    // No delay or no next nodes — continue normally
                    foreach (var next in waitNext)
                        queue.Enqueue(next);
                    break;
                }

                case "condition":
                {
                    // Condition nodes are evaluated as part of the main condition evaluation
                    // Just continue to connected nodes
                    var condNext = GetConnectedNodeIds(definition, nodeId, null);
                    foreach (var next in condNext)
                        queue.Enqueue(next);
                    break;
                }

                default:
                {
                    // Unknown node type — skip and continue
                    var defaultNext = GetConnectedNodeIds(definition, nodeId, null);
                    foreach (var next in defaultNext)
                        queue.Enqueue(next);
                    break;
                }
            }
        }

        return results;
    }

    /// <summary>
    /// Executes an action and creates an action log entry.
    /// </summary>
    private async Task<ActionResult> ExecuteActionWithLogging(
        WorkflowActionConfig action,
        Dictionary<string, object?> entityData,
        WorkflowTriggerContext context,
        WorkflowExecutionLog executionLog)
    {
        var actionLog = new WorkflowActionLog
        {
            TenantId = context.TenantId,
            ExecutionLogId = executionLog.Id,
            ActionType = action.ActionType.ToString(),
            ActionNodeId = action.NodeId,
            Order = action.Order,
            StartedAt = DateTimeOffset.UtcNow
        };

        var sw = Stopwatch.StartNew();

        try
        {
            await _actionExecutor.ExecuteAsync(action, entityData, context);

            sw.Stop();
            actionLog.Status = "Succeeded";
            actionLog.CompletedAt = DateTimeOffset.UtcNow;
            actionLog.DurationMs = (int)sw.ElapsedMilliseconds;
            executionLog.ActionLogs.Add(actionLog);

            return new ActionResult(true, null);
        }
        catch (Exception ex)
        {
            sw.Stop();
            actionLog.Status = "Failed";
            actionLog.ErrorMessage = ex.Message;
            actionLog.CompletedAt = DateTimeOffset.UtcNow;
            actionLog.DurationMs = (int)sw.ElapsedMilliseconds;
            executionLog.ActionLogs.Add(actionLog);

            _logger.LogWarning(ex,
                "Workflow action {ActionType} (node {NodeId}) failed: {Error}",
                action.ActionType, action.NodeId, ex.Message);

            return new ActionResult(false, ex.Message);
        }
    }

    /// <summary>
    /// Gets the IDs of nodes connected to the specified source node.
    /// If sourceOutput is specified (e.g., "yes"/"no" for branches), filters by that output.
    /// </summary>
    private static List<string> GetConnectedNodeIds(
        WorkflowDefinition definition, string sourceNodeId, string? sourceOutput)
    {
        return definition.Connections
            .Where(c => c.SourceNodeId == sourceNodeId &&
                        (sourceOutput is null || c.SourceOutput == sourceOutput))
            .Select(c => c.TargetNodeId)
            .ToList();
    }

    /// <summary>
    /// Evaluates a branch node's condition to determine the output path ("yes" or "no").
    /// </summary>
    private bool EvaluateBranchCondition(
        WorkflowNode branchNode,
        Dictionary<string, object?> entityData,
        WorkflowTriggerContext context)
    {
        if (string.IsNullOrEmpty(branchNode.Config))
            return false; // Default to "no" path

        try
        {
            // Parse branch config which contains condition groups
            var branchConfig = JsonSerializer.Deserialize<BranchNodeConfig>(branchNode.Config,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

            if (branchConfig?.ConditionGroups is null or { Count: 0 })
                return true; // No conditions = take "yes" path

            var changedProperties = !string.IsNullOrEmpty(context.ChangedPropertiesJson)
                ? JsonSerializer.Deserialize<Dictionary<string, object?>>(context.ChangedPropertiesJson,
                    new JsonSerializerOptions { PropertyNameCaseInsensitive = true })
                : null;

            var oldPropertyValues = !string.IsNullOrEmpty(context.OldPropertyValuesJson)
                ? JsonSerializer.Deserialize<Dictionary<string, object?>>(context.OldPropertyValuesJson,
                    new JsonSerializerOptions { PropertyNameCaseInsensitive = true })
                : null;

            return _conditionEvaluator.Evaluate(
                branchConfig.ConditionGroups, entityData, changedProperties, oldPropertyValues);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex,
                "Failed to evaluate branch condition for node {NodeId}: {Error}",
                branchNode.Id, ex.Message);
            return false; // Default to "no" path on error
        }
    }

    /// <summary>
    /// Parses the wait/delay configuration from a wait node.
    /// </summary>
    private static TimeSpan ParseWaitDelay(WorkflowNode waitNode)
    {
        if (string.IsNullOrEmpty(waitNode.Config))
            return TimeSpan.Zero;

        try
        {
            var config = JsonSerializer.Deserialize<WaitNodeConfig>(waitNode.Config,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

            if (config is null)
                return TimeSpan.Zero;

            return TimeSpan.FromMinutes(config.DelayMinutes)
                   + TimeSpan.FromHours(config.DelayHours)
                   + TimeSpan.FromDays(config.DelayDays);
        }
        catch
        {
            return TimeSpan.Zero;
        }
    }

    /// <summary>
    /// Loads entity data as a flat dictionary from the database.
    /// Uses the MergeFieldService pattern for consistency.
    /// </summary>
    private async Task<Dictionary<string, object?>?> LoadEntityDataAsync(
        string entityType, Guid entityId)
    {
        return entityType switch
        {
            "Contact" => await LoadContactDataAsync(entityId),
            "Company" => await LoadCompanyDataAsync(entityId),
            "Deal" => await LoadDealDataAsync(entityId),
            "Lead" => await LoadLeadDataAsync(entityId),
            "Activity" => await LoadActivityDataAsync(entityId),
            _ => null
        };
    }

    private async Task<Dictionary<string, object?>?> LoadContactDataAsync(Guid entityId)
    {
        var entity = await _db.Contacts
            .Include(c => c.Company)
            .FirstOrDefaultAsync(c => c.Id == entityId);

        if (entity is null) return null;

        return new Dictionary<string, object?>
        {
            ["id"] = entity.Id,
            ["first_name"] = entity.FirstName,
            ["last_name"] = entity.LastName,
            ["email"] = entity.Email,
            ["phone"] = entity.Phone,
            ["job_title"] = entity.JobTitle,
            ["owner_id"] = entity.OwnerId,
            ["company_id"] = entity.CompanyId,
            ["company"] = entity.Company != null ? new Dictionary<string, object?>
            {
                ["name"] = entity.Company.Name
            } : null,
            ["custom"] = entity.CustomFields
        };
    }

    private async Task<Dictionary<string, object?>?> LoadCompanyDataAsync(Guid entityId)
    {
        var entity = await _db.Companies
            .FirstOrDefaultAsync(c => c.Id == entityId);

        if (entity is null) return null;

        return new Dictionary<string, object?>
        {
            ["id"] = entity.Id,
            ["name"] = entity.Name,
            ["industry"] = entity.Industry,
            ["website"] = entity.Website,
            ["phone"] = entity.Phone,
            ["address"] = entity.Address,
            ["owner_id"] = entity.OwnerId,
            ["custom"] = entity.CustomFields
        };
    }

    private async Task<Dictionary<string, object?>?> LoadDealDataAsync(Guid entityId)
    {
        var entity = await _db.Deals
            .Include(d => d.Company)
            .Include(d => d.Stage)
            .FirstOrDefaultAsync(d => d.Id == entityId);

        if (entity is null) return null;

        return new Dictionary<string, object?>
        {
            ["id"] = entity.Id,
            ["title"] = entity.Title,
            ["value"] = entity.Value,
            ["stage"] = entity.Stage?.Name,
            ["stage_id"] = entity.PipelineStageId,
            ["probability"] = entity.Stage?.DefaultProbability,
            ["close_date"] = entity.ExpectedCloseDate?.ToString("yyyy-MM-dd"),
            ["description"] = entity.Description,
            ["owner_id"] = entity.OwnerId,
            ["company_id"] = entity.CompanyId,
            ["company"] = entity.Company != null ? new Dictionary<string, object?>
            {
                ["name"] = entity.Company.Name
            } : null,
            ["custom"] = entity.CustomFields
        };
    }

    private async Task<Dictionary<string, object?>?> LoadLeadDataAsync(Guid entityId)
    {
        var entity = await _db.Leads
            .Include(l => l.Source)
            .FirstOrDefaultAsync(l => l.Id == entityId);

        if (entity is null) return null;

        return new Dictionary<string, object?>
        {
            ["id"] = entity.Id,
            ["first_name"] = entity.FirstName,
            ["last_name"] = entity.LastName,
            ["email"] = entity.Email,
            ["phone"] = entity.Phone,
            ["company_name"] = entity.CompanyName,
            ["title"] = entity.JobTitle,
            ["owner_id"] = entity.OwnerId,
            ["source"] = entity.Source != null ? new Dictionary<string, object?>
            {
                ["name"] = entity.Source.Name
            } : null,
            ["custom"] = entity.CustomFields
        };
    }

    private async Task<Dictionary<string, object?>?> LoadActivityDataAsync(Guid entityId)
    {
        var entity = await _db.Activities
            .FirstOrDefaultAsync(a => a.Id == entityId);

        if (entity is null) return null;

        return new Dictionary<string, object?>
        {
            ["id"] = entity.Id,
            ["subject"] = entity.Subject,
            ["description"] = entity.Description,
            ["type"] = entity.Type.ToString(),
            ["status"] = entity.Status.ToString(),
            ["priority"] = entity.Priority.ToString(),
            ["due_date"] = entity.DueDate?.ToString("yyyy-MM-dd"),
            ["owner_id"] = entity.OwnerId,
            ["assigned_to_id"] = entity.AssignedToId,
            ["custom"] = entity.CustomFields
        };
    }

    /// <summary>
    /// Saves the execution log and updates workflow statistics.
    /// </summary>
    private async Task SaveExecutionLog(
        WorkflowExecutionLog executionLog,
        Workflow workflow,
        Stopwatch stopwatch)
    {
        stopwatch.Stop();
        executionLog.CompletedAt = DateTimeOffset.UtcNow;
        executionLog.DurationMs = (int)stopwatch.ElapsedMilliseconds;

        try
        {
            _db.WorkflowExecutionLogs.Add(executionLog);

            workflow.ExecutionCount++;
            workflow.LastExecutedAt = DateTimeOffset.UtcNow;
            _db.Workflows.Update(workflow);

            await _db.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "Failed to save workflow execution log for workflow {WorkflowId}",
                workflow.Id);
        }
    }

    /// <summary>
    /// Internal result type for tracking action execution outcomes.
    /// </summary>
    private record ActionResult(bool Succeeded, string? ErrorMessage);

    /// <summary>
    /// Branch node configuration parsed from the node's Config JSON string.
    /// </summary>
    private class BranchNodeConfig
    {
        public List<WorkflowConditionGroup> ConditionGroups { get; set; } = [];
    }

    /// <summary>
    /// Wait node configuration parsed from the node's Config JSON string.
    /// </summary>
    private class WaitNodeConfig
    {
        public int DelayMinutes { get; set; }
        public int DelayHours { get; set; }
        public int DelayDays { get; set; }
    }
}

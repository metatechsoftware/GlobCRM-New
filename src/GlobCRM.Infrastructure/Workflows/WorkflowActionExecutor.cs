using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Enums;
using GlobCRM.Infrastructure.Workflows.Actions;
using Microsoft.Extensions.Logging;

namespace GlobCRM.Infrastructure.Workflows;

/// <summary>
/// Dispatches workflow action execution to the appropriate action implementation
/// based on the ActionType. Each action reuses existing infrastructure services.
/// Branch and Wait node types are handled by the WorkflowExecutionService graph traversal,
/// not by this executor.
/// </summary>
public class WorkflowActionExecutor
{
    private readonly UpdateFieldAction _updateFieldAction;
    private readonly SendNotificationAction _sendNotificationAction;
    private readonly CreateActivityAction _createActivityAction;
    private readonly SendEmailAction _sendEmailAction;
    private readonly FireWebhookAction _fireWebhookAction;
    private readonly EnrollInSequenceAction _enrollInSequenceAction;
    private readonly ILogger<WorkflowActionExecutor> _logger;

    public WorkflowActionExecutor(
        UpdateFieldAction updateFieldAction,
        SendNotificationAction sendNotificationAction,
        CreateActivityAction createActivityAction,
        SendEmailAction sendEmailAction,
        FireWebhookAction fireWebhookAction,
        EnrollInSequenceAction enrollInSequenceAction,
        ILogger<WorkflowActionExecutor> logger)
    {
        _updateFieldAction = updateFieldAction;
        _sendNotificationAction = sendNotificationAction;
        _createActivityAction = createActivityAction;
        _sendEmailAction = sendEmailAction;
        _fireWebhookAction = fireWebhookAction;
        _enrollInSequenceAction = enrollInSequenceAction;
        _logger = logger;
    }

    /// <summary>
    /// Executes a single workflow action by dispatching to the appropriate implementation.
    /// </summary>
    /// <param name="action">The action configuration from the workflow definition.</param>
    /// <param name="entityData">Current entity data dictionary for merge field resolution.</param>
    /// <param name="context">The trigger context with entity and tenant information.</param>
    public async Task ExecuteAsync(
        WorkflowActionConfig action,
        Dictionary<string, object?> entityData,
        WorkflowTriggerContext context)
    {
        _logger.LogDebug(
            "Executing workflow action {ActionType} (node {NodeId}) for entity {EntityType}/{EntityId}",
            action.ActionType, action.NodeId, context.EntityType, context.EntityId);

        switch (action.ActionType)
        {
            case WorkflowActionType.UpdateField:
                await _updateFieldAction.ExecuteAsync(action.Config, entityData, context);
                break;

            case WorkflowActionType.SendNotification:
                await _sendNotificationAction.ExecuteAsync(action.Config, entityData, context);
                break;

            case WorkflowActionType.CreateActivity:
                await _createActivityAction.ExecuteAsync(action.Config, entityData, context);
                break;

            case WorkflowActionType.SendEmail:
                await _sendEmailAction.ExecuteAsync(action.Config, entityData, context);
                break;

            case WorkflowActionType.FireWebhook:
                await _fireWebhookAction.ExecuteAsync(action.Config, entityData, context);
                break;

            case WorkflowActionType.EnrollInSequence:
                await _enrollInSequenceAction.ExecuteAsync(action.Config, entityData, context);
                break;

            // Branch and Wait are handled by WorkflowExecutionService graph traversal
            case WorkflowActionType.Branch:
            case WorkflowActionType.Wait:
                _logger.LogDebug(
                    "Action type {ActionType} is handled by graph traversal, skipping executor",
                    action.ActionType);
                break;

            default:
                throw new NotSupportedException($"Unsupported workflow action type: {action.ActionType}");
        }
    }
}

namespace GlobCRM.Domain.Entities;

/// <summary>
/// Records the result of a single action within a workflow execution.
/// Captures the action type, status, error details, and timing per action node.
/// Cascade-deleted when the parent WorkflowExecutionLog is deleted.
/// Inherits tenant isolation through parent ExecutionLog FK cascade.
/// </summary>
public class WorkflowActionLog
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>
    /// Tenant (organization) ID for multi-tenancy isolation.
    /// </summary>
    public Guid TenantId { get; set; }

    /// <summary>
    /// The execution log this action belongs to.
    /// </summary>
    public Guid ExecutionLogId { get; set; }

    /// <summary>
    /// The type of action that was executed (stored as string for flexibility).
    /// </summary>
    public string ActionType { get; set; } = string.Empty;

    /// <summary>
    /// Reference to the action node ID in the workflow definition.
    /// </summary>
    public string ActionNodeId { get; set; } = string.Empty;

    /// <summary>
    /// Execution order of this action within the workflow.
    /// </summary>
    public int Order { get; set; }

    /// <summary>
    /// Outcome status: "Succeeded", "Failed", "Skipped".
    /// </summary>
    public string Status { get; set; } = string.Empty;

    /// <summary>
    /// Error message if the action failed (null on success).
    /// </summary>
    public string? ErrorMessage { get; set; }

    /// <summary>
    /// When this action started executing.
    /// </summary>
    public DateTimeOffset? StartedAt { get; set; }

    /// <summary>
    /// When this action completed.
    /// </summary>
    public DateTimeOffset? CompletedAt { get; set; }

    /// <summary>
    /// Action execution duration in milliseconds.
    /// </summary>
    public int DurationMs { get; set; }

    // Navigation property
    public WorkflowExecutionLog? ExecutionLog { get; set; }
}

using GlobCRM.Domain.Enums;

namespace GlobCRM.Domain.Entities;

/// <summary>
/// Records a single execution of a workflow, capturing the trigger event,
/// condition evaluation result, overall status, and timing.
/// Cascade-deleted when the parent Workflow is deleted.
/// Triple-layer tenant isolation: TenantId property + global query filter + RLS policy.
/// </summary>
public class WorkflowExecutionLog
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>
    /// Tenant (organization) ID for multi-tenancy isolation.
    /// </summary>
    public Guid TenantId { get; set; }

    /// <summary>
    /// The workflow that was executed.
    /// </summary>
    public Guid WorkflowId { get; set; }

    /// <summary>
    /// Type of trigger that fired (e.g., "RecordCreated", "FieldChanged").
    /// </summary>
    public string TriggerType { get; set; } = string.Empty;

    /// <summary>
    /// Specific trigger event description (e.g., "Created", "Updated", "FieldChanged:Status").
    /// </summary>
    public string TriggerEvent { get; set; } = string.Empty;

    /// <summary>
    /// The ID of the entity that triggered the workflow.
    /// </summary>
    public Guid EntityId { get; set; }

    /// <summary>
    /// The type of entity that triggered the workflow (e.g., "Contact", "Deal").
    /// </summary>
    public string EntityType { get; set; } = string.Empty;

    /// <summary>
    /// Whether conditions were evaluated during this execution.
    /// </summary>
    public bool ConditionsEvaluated { get; set; }

    /// <summary>
    /// Whether conditions passed (true if no conditions configured).
    /// </summary>
    public bool ConditionsPassed { get; set; }

    /// <summary>
    /// Overall execution outcome: Succeeded, PartiallyFailed, Failed, Skipped.
    /// </summary>
    public WorkflowExecutionStatus Status { get; set; }

    /// <summary>
    /// Error message if execution failed (null on success).
    /// </summary>
    public string? ErrorMessage { get; set; }

    /// <summary>
    /// When execution started.
    /// </summary>
    public DateTimeOffset StartedAt { get; set; }

    /// <summary>
    /// When execution completed.
    /// </summary>
    public DateTimeOffset CompletedAt { get; set; }

    /// <summary>
    /// Total execution duration in milliseconds.
    /// </summary>
    public int DurationMs { get; set; }

    // Navigation properties
    public Workflow? Workflow { get; set; }
    public List<WorkflowActionLog> ActionLogs { get; set; } = [];

    // Audit timestamp
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

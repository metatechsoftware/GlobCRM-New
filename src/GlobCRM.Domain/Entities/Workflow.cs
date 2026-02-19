using GlobCRM.Domain.Enums;

namespace GlobCRM.Domain.Entities;

/// <summary>
/// Core workflow automation entity. Stores the full visual flow definition as JSONB,
/// including triggers, conditions, and actions. TriggerSummary is denormalized on save
/// for fast event matching queries without deserializing the full definition.
///
/// A workflow is considered "runnable" when both Status == Active AND IsActive == true.
/// Triple-layer tenant isolation: TenantId property + global query filter + RLS policy.
/// </summary>
public class Workflow
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>
    /// Tenant (organization) ID for multi-tenancy isolation.
    /// </summary>
    public Guid TenantId { get; set; }

    /// <summary>
    /// Human-readable name for this workflow (e.g., "New Deal Notification").
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Optional description of the workflow purpose and behavior.
    /// </summary>
    public string? Description { get; set; }

    /// <summary>
    /// The target CRM entity type this workflow operates on ("Contact", "Company", "Deal", "Lead", "Activity").
    /// </summary>
    public string EntityType { get; set; } = string.Empty;

    /// <summary>
    /// Full visual flow graph AND logical configuration as a single JSONB document.
    /// Single source of truth for both canvas rendering and execution engine.
    /// </summary>
    public WorkflowDefinition Definition { get; set; } = new();

    /// <summary>
    /// Denormalized trigger identifiers from Definition for fast event matching queries.
    /// Format examples: "RecordCreated", "RecordUpdated", "FieldChanged:Status", "DateBased:CloseDate".
    /// Updated on save from Definition.Triggers.
    /// </summary>
    public List<string> TriggerSummary { get; set; } = [];

    /// <summary>
    /// Lifecycle status: Draft, Active, Paused.
    /// </summary>
    public WorkflowStatus Status { get; set; } = WorkflowStatus.Draft;

    /// <summary>
    /// Quick toggle for enable/disable without changing Status.
    /// A workflow runs only when Status == Active AND IsActive == true.
    /// </summary>
    public bool IsActive { get; set; } = false;

    /// <summary>
    /// User who created this workflow.
    /// </summary>
    public Guid CreatedByUserId { get; set; }

    /// <summary>
    /// Number of times this workflow has been executed.
    /// </summary>
    public int ExecutionCount { get; set; } = 0;

    /// <summary>
    /// When the workflow last executed (null if never).
    /// </summary>
    public DateTimeOffset? LastExecutedAt { get; set; }

    /// <summary>
    /// Navigation: execution logs for this workflow.
    /// </summary>
    public List<WorkflowExecutionLog> ExecutionLogs { get; set; } = [];

    /// <summary>
    /// Marks records created by TenantSeeder for bulk deletion of demo data.
    /// </summary>
    public bool IsSeedData { get; set; } = false;

    // Audit timestamps
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

/// <summary>
/// The complete workflow definition stored as a single JSONB document.
/// Contains visual node/connection data for canvas rendering AND
/// logical trigger/condition/action configurations for execution.
/// </summary>
public class WorkflowDefinition
{
    /// <summary>
    /// Visual node positions and metadata for canvas rendering.
    /// </summary>
    public List<WorkflowNode> Nodes { get; set; } = [];

    /// <summary>
    /// Edges between nodes defining the flow graph.
    /// </summary>
    public List<WorkflowConnection> Connections { get; set; } = [];

    /// <summary>
    /// Trigger configurations that determine when this workflow fires.
    /// </summary>
    public List<WorkflowTriggerConfig> Triggers { get; set; } = [];

    /// <summary>
    /// AND/OR condition groups. Conditions within a group are AND-ed;
    /// groups are OR-ed (matching the filter panel pattern).
    /// </summary>
    public List<WorkflowConditionGroup> Conditions { get; set; } = [];

    /// <summary>
    /// Action configurations with ContinueOnError flag and execution order.
    /// </summary>
    public List<WorkflowActionConfig> Actions { get; set; } = [];
}

/// <summary>
/// A visual node on the workflow canvas.
/// </summary>
public class WorkflowNode
{
    public string Id { get; set; } = string.Empty;

    /// <summary>
    /// Node type: "trigger", "condition", "action", "branch", "wait".
    /// </summary>
    public string Type { get; set; } = string.Empty;

    /// <summary>
    /// Display label for the node on the canvas.
    /// </summary>
    public string Label { get; set; } = string.Empty;

    /// <summary>
    /// Canvas position coordinates.
    /// </summary>
    public WorkflowNodePosition Position { get; set; } = new();

    /// <summary>
    /// Optional type-specific configuration data stored as serialized JSON string.
    /// </summary>
    public string? Config { get; set; }
}

/// <summary>
/// Canvas position for a workflow node.
/// </summary>
public class WorkflowNodePosition
{
    public double X { get; set; }
    public double Y { get; set; }
}

/// <summary>
/// An edge connecting two nodes in the workflow flow graph.
/// </summary>
public class WorkflowConnection
{
    public string Id { get; set; } = string.Empty;
    public string SourceNodeId { get; set; } = string.Empty;
    public string TargetNodeId { get; set; } = string.Empty;

    /// <summary>
    /// For branch nodes: "yes" or "no" output path.
    /// Null for non-branch connections.
    /// </summary>
    public string? SourceOutput { get; set; }
}

/// <summary>
/// Configuration for a workflow trigger.
/// </summary>
public class WorkflowTriggerConfig
{
    public string Id { get; set; } = string.Empty;

    /// <summary>
    /// Reference to the visual node on the canvas.
    /// </summary>
    public string NodeId { get; set; } = string.Empty;

    /// <summary>
    /// Type of trigger: RecordCreated, RecordUpdated, RecordDeleted, FieldChanged, DateBased.
    /// </summary>
    public WorkflowTriggerType TriggerType { get; set; }

    /// <summary>
    /// For record event triggers: "Created", "Updated", "Deleted".
    /// </summary>
    public string? EventType { get; set; }

    /// <summary>
    /// For FieldChanged triggers: the field name to monitor.
    /// For DateBased triggers: the date field name.
    /// </summary>
    public string? FieldName { get; set; }

    /// <summary>
    /// For DateBased triggers: number of days offset from the date field value.
    /// Negative = before, positive = after.
    /// </summary>
    public int? DateOffsetDays { get; set; }

    /// <summary>
    /// For DateBased triggers: preferred time of day for execution.
    /// </summary>
    public TimeOnly? PreferredTime { get; set; }
}

/// <summary>
/// A group of conditions that are AND-ed together.
/// Multiple groups are OR-ed (matching the filter panel pattern).
/// </summary>
public class WorkflowConditionGroup
{
    public string Id { get; set; } = string.Empty;

    /// <summary>
    /// Reference to the visual node on the canvas.
    /// </summary>
    public string NodeId { get; set; } = string.Empty;

    /// <summary>
    /// Conditions within this group (AND-ed together).
    /// </summary>
    public List<WorkflowCondition> Conditions { get; set; } = [];
}

/// <summary>
/// A single condition evaluating a field against a value.
/// </summary>
public class WorkflowCondition
{
    /// <summary>
    /// The entity field to evaluate.
    /// </summary>
    public string Field { get; set; } = string.Empty;

    /// <summary>
    /// Comparison operator: "equals", "not_equals", "gt", "gte", "lt", "lte",
    /// "contains", "changed_to", "changed_from_to", "is_null", "is_not_null".
    /// </summary>
    public string Operator { get; set; } = string.Empty;

    /// <summary>
    /// The value to compare against (null for is_null/is_not_null operators).
    /// </summary>
    public string? Value { get; set; }

    /// <summary>
    /// For "changed_from_to" operator: the original value (optional per locked decision).
    /// </summary>
    public string? FromValue { get; set; }
}

/// <summary>
/// Configuration for a workflow action with type-specific config in the Config dictionary.
/// </summary>
public class WorkflowActionConfig
{
    public string Id { get; set; } = string.Empty;

    /// <summary>
    /// Reference to the visual node on the canvas.
    /// </summary>
    public string NodeId { get; set; } = string.Empty;

    /// <summary>
    /// The type of action to perform.
    /// </summary>
    public WorkflowActionType ActionType { get; set; }

    /// <summary>
    /// When true, subsequent actions continue executing even if this action fails.
    /// </summary>
    public bool ContinueOnError { get; set; } = false;

    /// <summary>
    /// Execution order within the workflow (lower = earlier).
    /// </summary>
    public int Order { get; set; }

    /// <summary>
    /// Type-specific configuration stored as serialized JSON string. Structure depends on ActionType:
    /// - UpdateField: { FieldName, Value, IsDynamic, DynamicSourceField }
    /// - SendNotification: { Title, Message, RecipientType, RecipientId }
    /// - CreateActivity: { Subject, Type, Priority, DueDateOffsetDays, AssigneeType, AssigneeId }
    /// - SendEmail: { EmailTemplateId, RecipientField }
    /// - FireWebhook: { Url, Headers, PayloadTemplate }
    /// - EnrollInSequence: { SequenceId }
    /// - Branch: { ConditionGroups }
    /// - Wait: { DelayMinutes, DelayHours, DelayDays }
    /// </summary>
    public string Config { get; set; } = "{}";
}

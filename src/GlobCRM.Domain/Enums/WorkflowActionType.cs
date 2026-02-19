namespace GlobCRM.Domain.Enums;

/// <summary>
/// Types of actions a workflow can perform when triggered.
/// Covers field updates, notifications, activity creation, email, webhooks,
/// sequence enrollment, branching logic, and wait/delay nodes.
/// </summary>
public enum WorkflowActionType
{
    UpdateField,
    SendNotification,
    CreateActivity,
    SendEmail,
    FireWebhook,
    EnrollInSequence,
    Branch,
    Wait
}

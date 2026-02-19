namespace GlobCRM.Domain.Enums;

/// <summary>
/// Outcome status of a workflow execution run.
/// Succeeded: all actions completed. PartiallyFailed: some actions failed (ContinueOnError).
/// Failed: execution stopped due to error. Skipped: conditions not met.
/// </summary>
public enum WorkflowExecutionStatus
{
    Succeeded,
    PartiallyFailed,
    Failed,
    Skipped
}

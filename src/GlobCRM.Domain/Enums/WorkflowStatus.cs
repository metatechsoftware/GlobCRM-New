namespace GlobCRM.Domain.Enums;

/// <summary>
/// Lifecycle status of a workflow automation.
/// Draft = not yet activated, Active = running, Paused = temporarily disabled.
/// </summary>
public enum WorkflowStatus
{
    Draft,
    Active,
    Paused
}

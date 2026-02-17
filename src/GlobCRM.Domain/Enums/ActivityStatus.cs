namespace GlobCRM.Domain.Enums;

/// <summary>
/// Enumerates the workflow states of an activity.
/// Fixed progression: Assigned -> Accepted -> InProgress -> Review -> Done.
/// </summary>
public enum ActivityStatus
{
    Assigned,
    Accepted,
    InProgress,
    Review,
    Done
}

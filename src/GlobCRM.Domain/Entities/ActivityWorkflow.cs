using GlobCRM.Domain.Enums;

namespace GlobCRM.Domain.Entities;

/// <summary>
/// Static workflow transition validation for activity status changes.
/// Defines the allowed state machine transitions for the fixed activity workflow:
/// Assigned -> Accepted -> InProgress -> Review -> Done (with some reverse transitions).
/// </summary>
public static class ActivityWorkflow
{
    private static readonly Dictionary<ActivityStatus, ActivityStatus[]> AllowedTransitions = new()
    {
        [ActivityStatus.Assigned] = [ActivityStatus.Accepted, ActivityStatus.InProgress, ActivityStatus.Done],
        [ActivityStatus.Accepted] = [ActivityStatus.InProgress, ActivityStatus.Done],
        [ActivityStatus.InProgress] = [ActivityStatus.Review, ActivityStatus.Done, ActivityStatus.Assigned],
        [ActivityStatus.Review] = [ActivityStatus.Done, ActivityStatus.InProgress],
        [ActivityStatus.Done] = [ActivityStatus.InProgress],
    };

    /// <summary>
    /// Checks whether a status transition is allowed by the workflow state machine.
    /// </summary>
    public static bool CanTransition(ActivityStatus from, ActivityStatus to)
    {
        return AllowedTransitions.TryGetValue(from, out var allowed) && allowed.Contains(to);
    }

    /// <summary>
    /// Gets all allowed target statuses from a given status.
    /// Returns empty array if the status has no allowed transitions.
    /// </summary>
    public static ActivityStatus[] GetAllowedTransitions(ActivityStatus from)
    {
        return AllowedTransitions.TryGetValue(from, out var allowed) ? allowed : [];
    }
}

using GlobCRM.Domain.Enums;

namespace GlobCRM.Domain.Entities;

/// <summary>
/// Static workflow transition validation for request status changes.
/// Defines the allowed state machine transitions for the fixed request workflow:
/// New -> InProgress -> Resolved -> Closed (with some reverse transitions).
/// </summary>
public static class RequestWorkflow
{
    private static readonly Dictionary<RequestStatus, RequestStatus[]> AllowedTransitions = new()
    {
        [RequestStatus.New] = [RequestStatus.InProgress, RequestStatus.Closed],
        [RequestStatus.InProgress] = [RequestStatus.Resolved, RequestStatus.New],
        [RequestStatus.Resolved] = [RequestStatus.Closed, RequestStatus.InProgress],
        [RequestStatus.Closed] = [RequestStatus.InProgress],
    };

    /// <summary>
    /// Checks whether a status transition is allowed by the workflow state machine.
    /// </summary>
    public static bool CanTransition(RequestStatus from, RequestStatus to)
    {
        return AllowedTransitions.TryGetValue(from, out var allowed) && allowed.Contains(to);
    }

    /// <summary>
    /// Gets all allowed target statuses from a given status.
    /// Returns empty array if the status has no allowed transitions.
    /// </summary>
    public static RequestStatus[] GetAllowedTransitions(RequestStatus from)
    {
        return AllowedTransitions.TryGetValue(from, out var allowed) ? allowed : [];
    }
}

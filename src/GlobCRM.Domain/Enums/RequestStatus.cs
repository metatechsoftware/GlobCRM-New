namespace GlobCRM.Domain.Enums;

/// <summary>
/// Enumerates the workflow states of a request/ticket.
/// Fixed progression: New -> InProgress -> Resolved -> Closed.
/// </summary>
public enum RequestStatus
{
    New,
    InProgress,
    Resolved,
    Closed
}

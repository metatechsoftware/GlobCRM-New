namespace GlobCRM.Domain.Enums;

/// <summary>
/// Enumerates the types of in-app notifications that can be generated.
/// Used for categorizing notifications and managing user preferences per type.
/// </summary>
public enum NotificationType
{
    ActivityAssigned,
    DealStageChanged,
    Mention,
    DueDateApproaching,
    EmailReceived
}

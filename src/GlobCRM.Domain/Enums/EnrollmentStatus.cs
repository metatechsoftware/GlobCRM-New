namespace GlobCRM.Domain.Enums;

/// <summary>
/// Represents the lifecycle status of a contact's enrollment in an email sequence.
/// Active: progressing through steps. Paused: temporarily halted by user.
/// Completed: all steps sent. Replied: contact replied (auto-unenrolled).
/// Bounced: email bounced (auto-unenrolled). Unenrolled: manually removed.
/// </summary>
public enum EnrollmentStatus
{
    Active,
    Paused,
    Completed,
    Replied,
    Bounced,
    Unenrolled
}

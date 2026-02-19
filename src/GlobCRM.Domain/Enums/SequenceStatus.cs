namespace GlobCRM.Domain.Enums;

/// <summary>
/// Represents the lifecycle status of an email sequence.
/// Draft: being built, not yet active. Active: enrollments are being processed.
/// Paused: temporarily halted (no new steps sent). Archived: retired, read-only.
/// </summary>
public enum SequenceStatus
{
    Draft,
    Active,
    Paused,
    Archived
}

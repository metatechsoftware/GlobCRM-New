namespace GlobCRM.Domain.Enums;

/// <summary>
/// Enumerates the workflow states of a CSV import job.
/// Progression: Pending -> Mapping -> Previewing -> Processing -> Completed/Failed.
/// </summary>
public enum ImportStatus
{
    Pending,
    Mapping,
    Previewing,
    Processing,
    Completed,
    Failed
}

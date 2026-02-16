namespace GlobCRM.Domain.Entities;

/// <summary>
/// Work schedule stored as JSONB in the ApplicationUser table.
/// Defines the user's working days and hours.
/// </summary>
public class WorkSchedule
{
    /// <summary>
    /// List of working day abbreviations (e.g., "Mon", "Tue", "Wed", "Thu", "Fri").
    /// </summary>
    public List<string> WorkDays { get; set; } = ["Mon", "Tue", "Wed", "Thu", "Fri"];

    /// <summary>
    /// Work start time in 24-hour format (e.g., "09:00").
    /// </summary>
    public string StartTime { get; set; } = "09:00";

    /// <summary>
    /// Work end time in 24-hour format (e.g., "17:00").
    /// </summary>
    public string EndTime { get; set; } = "17:00";
}

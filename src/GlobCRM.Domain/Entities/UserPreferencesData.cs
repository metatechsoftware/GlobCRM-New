namespace GlobCRM.Domain.Entities;

/// <summary>
/// User preferences stored as JSONB in the ApplicationUser table.
/// Contains theme, locale, and notification settings.
/// </summary>
public class UserPreferencesData
{
    /// <summary>
    /// UI theme: "light" or "dark".
    /// </summary>
    public string Theme { get; set; } = "light";

    /// <summary>
    /// Preferred language code (e.g., "en", "tr", "de").
    /// </summary>
    public string Language { get; set; } = "en";

    /// <summary>
    /// IANA timezone identifier (e.g., "UTC", "America/New_York").
    /// </summary>
    public string Timezone { get; set; } = "UTC";

    /// <summary>
    /// Date display format (e.g., "MM/dd/yyyy", "dd/MM/yyyy").
    /// </summary>
    public string DateFormat { get; set; } = "MM/dd/yyyy";

    /// <summary>
    /// Email notification toggles per event type.
    /// Keys: task_assigned, deal_updated, mention, weekly_report, etc.
    /// </summary>
    public Dictionary<string, bool> EmailNotifications { get; set; } = new()
    {
        ["task_assigned"] = true,
        ["deal_updated"] = true,
        ["mention"] = true,
        ["weekly_report"] = true
    };
}

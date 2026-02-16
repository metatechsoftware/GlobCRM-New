using Microsoft.AspNetCore.Identity;

namespace GlobCRM.Domain.Entities;

/// <summary>
/// Custom Identity user extending IdentityUser with tenant and profile fields.
/// Each user belongs to exactly one Organization (tenant).
/// </summary>
public class ApplicationUser : IdentityUser<Guid>
{
    /// <summary>
    /// Foreign key to the user's organization (tenant).
    /// </summary>
    public Guid OrganizationId { get; set; }

    /// <summary>
    /// Navigation property to the user's organization.
    /// </summary>
    public Organization Organization { get; set; } = null!;

    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;

    /// <summary>
    /// Whether the user account is active. Deactivated users cannot log in.
    /// </summary>
    public bool IsActive { get; set; } = true;

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    /// <summary>
    /// Timestamp of the user's most recent login.
    /// </summary>
    public DateTimeOffset? LastLoginAt { get; set; }

    // ---- Rich Profile Fields (Phase 2, Plan 03) ----

    /// <summary>
    /// Phone number for profile display (not the Identity PhoneNumber used for 2FA).
    /// </summary>
    public string? Phone { get; set; }

    /// <summary>
    /// User's job title (e.g., "Sales Manager", "Account Executive").
    /// </summary>
    public string? JobTitle { get; set; }

    /// <summary>
    /// Department the user belongs to (e.g., "Sales", "Engineering").
    /// </summary>
    public string? Department { get; set; }

    /// <summary>
    /// IANA timezone identifier (e.g., "UTC", "America/New_York").
    /// </summary>
    public string? Timezone { get; set; } = "UTC";

    /// <summary>
    /// Preferred language code (e.g., "en", "tr").
    /// </summary>
    public string? Language { get; set; } = "en";

    /// <summary>
    /// Short biography or description of the user.
    /// </summary>
    public string? Bio { get; set; }

    /// <summary>
    /// Relative path to the uploaded avatar image (e.g., "tenantId/avatars/userId.webp").
    /// </summary>
    public string? AvatarUrl { get; set; }

    /// <summary>
    /// Hex color for initials-based avatar fallback circle (e.g., "#1976d2").
    /// </summary>
    public string? AvatarColor { get; set; }

    /// <summary>
    /// Social media profile links stored as JSONB.
    /// Keys: "linkedin", "twitter", "github", etc.
    /// </summary>
    public Dictionary<string, string>? SocialLinks { get; set; }

    /// <summary>
    /// User's work schedule (working days and hours) stored as JSONB.
    /// </summary>
    public WorkSchedule? WorkSchedule { get; set; }

    /// <summary>
    /// Foreign key to the user's reporting manager (self-referential).
    /// </summary>
    public Guid? ReportingManagerId { get; set; }

    /// <summary>
    /// Navigation property to the reporting manager.
    /// </summary>
    public ApplicationUser? ReportingManager { get; set; }

    /// <summary>
    /// List of skill or tag strings stored as JSONB array.
    /// </summary>
    public List<string>? Skills { get; set; }

    /// <summary>
    /// User preferences (theme, locale, notifications) stored as JSONB.
    /// </summary>
    public UserPreferencesData Preferences { get; set; } = new();

    /// <summary>
    /// Full display name derived from first and last name.
    /// </summary>
    public string FullName => $"{FirstName} {LastName}".Trim();
}

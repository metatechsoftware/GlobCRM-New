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

    /// <summary>
    /// Full display name derived from first and last name.
    /// </summary>
    public string FullName => $"{FirstName} {LastName}".Trim();
}

namespace GlobCRM.Domain.Entities;

/// <summary>
/// Represents a tenant organization in the CRM system.
/// Each organization has its own isolated data space.
/// </summary>
public class Organization
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>
    /// Organization display name.
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Unique subdomain identifier (e.g., "acme" for acme.globcrm.com).
    /// </summary>
    public string Subdomain { get; set; } = string.Empty;

    /// <summary>
    /// Industry classification (e.g., "Technology", "Healthcare").
    /// </summary>
    public string? Industry { get; set; }

    /// <summary>
    /// Company size bracket (e.g., "1-10", "11-50", "51-200").
    /// </summary>
    public string? CompanySize { get; set; }

    /// <summary>
    /// Whether the organization is active. Admin can deactivate (freeze) an org
    /// but not permanently delete it -- data preserved, reactivation possible.
    /// </summary>
    public bool IsActive { get; set; } = true;

    /// <summary>
    /// Soft user limit per organization. Default 10.
    /// When reached, admin sees a warning but can still invite (soft enforcement).
    /// </summary>
    public int UserLimit { get; set; } = 10;

    /// <summary>
    /// Tracks whether the post-creation setup wizard has been completed.
    /// </summary>
    public bool SetupCompleted { get; set; } = false;

    /// <summary>
    /// Default UI language for new users in this organization (en or tr).
    /// </summary>
    public string DefaultLanguage { get; set; } = "en";

    /// <summary>
    /// URL to the organization's logo image. Used in quote PDF template branding headers.
    /// </summary>
    public string? LogoUrl { get; set; }

    /// <summary>
    /// Organization's physical address. Used in quote PDF template branding.
    /// </summary>
    public string? Address { get; set; }

    /// <summary>
    /// Organization's phone number. Used in quote PDF template branding.
    /// </summary>
    public string? Phone { get; set; }

    /// <summary>
    /// Organization's contact email. Used in quote PDF template branding.
    /// </summary>
    public string? Email { get; set; }

    /// <summary>
    /// Organization's website URL. Used in quote PDF template branding.
    /// </summary>
    public string? Website { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    // Navigation properties
    public ICollection<ApplicationUser> Users { get; set; } = new List<ApplicationUser>();
    public ICollection<Invitation> Invitations { get; set; } = new List<Invitation>();
}

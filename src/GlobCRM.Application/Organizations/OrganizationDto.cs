using GlobCRM.Domain.Entities;

namespace GlobCRM.Application.Organizations;

/// <summary>
/// Data transfer object for Organization entity.
/// Used in API responses for organization creation, lookup, and management.
/// </summary>
public class OrganizationDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Subdomain { get; set; } = string.Empty;
    public string? Industry { get; set; }
    public string? CompanySize { get; set; }
    public bool IsActive { get; set; }
    public int UserLimit { get; set; }
    public bool SetupCompleted { get; set; }
    public string DefaultLanguage { get; set; } = "en";
    public DateTimeOffset CreatedAt { get; set; }

    /// <summary>
    /// Creates an OrganizationDto from an Organization entity.
    /// </summary>
    public static OrganizationDto FromEntity(Organization organization)
    {
        return new OrganizationDto
        {
            Id = organization.Id,
            Name = organization.Name,
            Subdomain = organization.Subdomain,
            Industry = organization.Industry,
            CompanySize = organization.CompanySize,
            IsActive = organization.IsActive,
            UserLimit = organization.UserLimit,
            SetupCompleted = organization.SetupCompleted,
            DefaultLanguage = organization.DefaultLanguage,
            CreatedAt = organization.CreatedAt
        };
    }
}

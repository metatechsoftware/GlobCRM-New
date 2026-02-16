using GlobCRM.Domain.Interfaces;

namespace GlobCRM.Application.Organizations;

/// <summary>
/// Query to check subdomain availability.
/// Validates against reserved subdomains and existing organizations.
/// </summary>
public class CheckSubdomainQuery
{
    public string Subdomain { get; set; } = string.Empty;
}

/// <summary>
/// Result of a subdomain availability check.
/// </summary>
public class CheckSubdomainResult
{
    public bool Available { get; set; }
    public string Subdomain { get; set; } = string.Empty;
    public string? Reason { get; set; }
}

/// <summary>
/// Handler for CheckSubdomainQuery. Checks both reserved words and database.
/// </summary>
public class CheckSubdomainQueryHandler
{
    private readonly IOrganizationRepository _organizationRepository;

    /// <summary>
    /// Reserved subdomains that cannot be used by organizations.
    /// </summary>
    private static readonly HashSet<string> ReservedSubdomains = new(StringComparer.OrdinalIgnoreCase)
    {
        "www", "api", "admin", "mail", "app", "help", "support", "status",
        "blog", "docs", "dev", "staging", "test", "demo", "cdn", "static",
        "auth", "login", "signup", "register", "dashboard", "console"
    };

    public CheckSubdomainQueryHandler(IOrganizationRepository organizationRepository)
    {
        _organizationRepository = organizationRepository;
    }

    public async Task<CheckSubdomainResult> HandleAsync(
        CheckSubdomainQuery query,
        CancellationToken cancellationToken = default)
    {
        var normalized = query.Subdomain.Trim().ToLowerInvariant();

        // Check reserved list
        if (ReservedSubdomains.Contains(normalized))
        {
            return new CheckSubdomainResult
            {
                Available = false,
                Subdomain = normalized,
                Reason = "This subdomain is reserved."
            };
        }

        // Check database for existing organization
        var exists = await _organizationRepository.SubdomainExistsAsync(normalized, cancellationToken);

        return new CheckSubdomainResult
        {
            Available = !exists,
            Subdomain = normalized,
            Reason = exists ? "This subdomain is already taken." : null
        };
    }

    /// <summary>
    /// Checks whether a subdomain is reserved. Used by CreateOrganizationCommand as well.
    /// </summary>
    public static bool IsReserved(string subdomain)
    {
        return ReservedSubdomains.Contains(subdomain.Trim().ToLowerInvariant());
    }
}

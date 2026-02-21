using FluentValidation;
using GlobCRM.Application.Organizations;
using GlobCRM.Domain.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GlobCRM.Api.Controllers;

/// <summary>
/// Request body for updating organization default language.
/// </summary>
public record UpdateDefaultLanguageRequest(string Language);

/// <summary>
/// REST endpoints for organization management.
/// POST /api/organizations - Create org (signup, no auth required)
/// GET /api/organizations/check-subdomain - Check availability (no auth required)
/// POST /api/organizations/{id}/deactivate - Freeze org (Admin only)
/// POST /api/organizations/{id}/reactivate - Reactivate org (Admin only)
/// GET /api/organizations/default-language - Get org default language (authenticated)
/// PUT /api/organizations/settings/language - Update org default language (Admin only)
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class OrganizationsController : ControllerBase
{
    private readonly CreateOrganizationCommandHandler _createOrgHandler;
    private readonly CheckSubdomainQueryHandler _checkSubdomainHandler;
    private readonly IOrganizationRepository _organizationRepository;
    private readonly ITenantProvider _tenantProvider;
    private readonly IValidator<CreateOrganizationRequest> _validator;
    private readonly ILogger<OrganizationsController> _logger;

    private static readonly HashSet<string> SupportedLanguages = new(StringComparer.OrdinalIgnoreCase) { "en", "tr" };

    public OrganizationsController(
        CreateOrganizationCommandHandler createOrgHandler,
        CheckSubdomainQueryHandler checkSubdomainHandler,
        IOrganizationRepository organizationRepository,
        ITenantProvider tenantProvider,
        IValidator<CreateOrganizationRequest> validator,
        ILogger<OrganizationsController> logger)
    {
        _createOrgHandler = createOrgHandler;
        _checkSubdomainHandler = checkSubdomainHandler;
        _organizationRepository = organizationRepository;
        _tenantProvider = tenantProvider;
        _validator = validator;
        _logger = logger;
    }

    /// <summary>
    /// Creates a new organization with an admin user account.
    /// This IS the signup endpoint -- no authentication required.
    /// </summary>
    [HttpPost]
    [AllowAnonymous]
    [ProducesResponseType(typeof(OrganizationDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Create(
        [FromBody] CreateOrganizationRequest request,
        CancellationToken cancellationToken)
    {
        // Validate request
        var validationResult = await _validator.ValidateAsync(request, cancellationToken);
        if (!validationResult.IsValid)
        {
            return BadRequest(new
            {
                errors = validationResult.Errors
                    .Select(e => new { field = e.PropertyName, message = e.ErrorMessage })
            });
        }

        // Execute command
        var command = new CreateOrganizationCommand
        {
            OrgName = request.OrgName,
            Subdomain = request.Subdomain,
            Industry = request.Industry,
            CompanySize = request.CompanySize,
            Email = request.Email,
            Password = request.Password,
            FirstName = request.FirstName,
            LastName = request.LastName
        };

        var result = await _createOrgHandler.HandleAsync(command, cancellationToken);

        if (!result.Success)
        {
            // Check if it's a subdomain conflict
            if (result.Errors.Any(e => e.Contains("subdomain", StringComparison.OrdinalIgnoreCase)))
            {
                return Conflict(new { errors = result.Errors });
            }

            return BadRequest(new { errors = result.Errors });
        }

        _logger.LogInformation(
            "Organization created: {OrgName} ({Subdomain})",
            request.OrgName, request.Subdomain);

        return CreatedAtAction(
            nameof(Create),
            new { id = result.Organization!.Id },
            result.Organization);
    }

    /// <summary>
    /// Checks if a subdomain is available for use.
    /// No authentication required -- used during signup for real-time feedback.
    /// Debounced on frontend, validated on submit for race conditions.
    /// </summary>
    [HttpGet("check-subdomain")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(CheckSubdomainResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CheckSubdomain(
        [FromQuery] string name,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            return BadRequest(new { error = "Subdomain name is required." });
        }

        if (name.Length < 3 || name.Length > 63)
        {
            return Ok(new CheckSubdomainResult
            {
                Available = false,
                Subdomain = name.ToLowerInvariant(),
                Reason = "Subdomain must be between 3 and 63 characters."
            });
        }

        var query = new CheckSubdomainQuery { Subdomain = name };
        var result = await _checkSubdomainHandler.HandleAsync(query, cancellationToken);

        return Ok(result);
    }

    /// <summary>
    /// Deactivates (freezes) an organization. Data is preserved, reactivation possible.
    /// Per locked decision: admin can deactivate org but not permanently delete.
    /// </summary>
    [HttpPost("{id:guid}/deactivate")]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Deactivate(Guid id, CancellationToken cancellationToken)
    {
        var organization = await _organizationRepository.GetByIdAsync(id, cancellationToken);
        if (organization == null)
        {
            return NotFound(new { error = "Organization not found." });
        }

        if (!organization.IsActive)
        {
            return Ok(new { message = "Organization is already deactivated." });
        }

        organization.IsActive = false;
        await _organizationRepository.UpdateAsync(organization, cancellationToken);

        _logger.LogInformation(
            "Organization {OrgId} deactivated by admin", id);

        return Ok(new
        {
            message = "Organization has been deactivated.",
            organization = OrganizationDto.FromEntity(organization)
        });
    }

    /// <summary>
    /// Reactivates a previously deactivated organization.
    /// </summary>
    [HttpPost("{id:guid}/reactivate")]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Reactivate(Guid id, CancellationToken cancellationToken)
    {
        var organization = await _organizationRepository.GetByIdAsync(id, cancellationToken);
        if (organization == null)
        {
            return NotFound(new { error = "Organization not found." });
        }

        if (organization.IsActive)
        {
            return Ok(new { message = "Organization is already active." });
        }

        organization.IsActive = true;
        await _organizationRepository.UpdateAsync(organization, cancellationToken);

        _logger.LogInformation(
            "Organization {OrgId} reactivated by admin", id);

        return Ok(new
        {
            message = "Organization has been reactivated.",
            organization = OrganizationDto.FromEntity(organization)
        });
    }

    /// <summary>
    /// Gets the current organization's default language.
    /// Any authenticated user can read this.
    /// </summary>
    [HttpGet("default-language")]
    [Authorize]
    [ProducesResponseType(typeof(object), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetDefaultLanguage(CancellationToken cancellationToken)
    {
        var organization = await _tenantProvider.GetCurrentOrganizationAsync();
        if (organization == null)
        {
            return NotFound(new { error = "Organization not found." });
        }

        return Ok(new { defaultLanguage = organization.DefaultLanguage });
    }

    /// <summary>
    /// Updates the organization's default language.
    /// Admin only. New users with no personal preference inherit this language.
    /// </summary>
    [HttpPut("settings/language")]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(typeof(OrganizationDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> UpdateDefaultLanguage(
        [FromBody] UpdateDefaultLanguageRequest request,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Language) || !SupportedLanguages.Contains(request.Language))
        {
            return BadRequest(new { error = "Language must be 'en' or 'tr'." });
        }

        var organization = await _tenantProvider.GetCurrentOrganizationAsync();
        if (organization == null)
        {
            return NotFound(new { error = "Organization not found." });
        }

        organization.DefaultLanguage = request.Language.ToLowerInvariant();
        await _organizationRepository.UpdateAsync(organization, cancellationToken);

        _logger.LogInformation(
            "Organization {OrgId} default language updated to {Language}",
            organization.Id, request.Language);

        return Ok(OrganizationDto.FromEntity(organization));
    }
}

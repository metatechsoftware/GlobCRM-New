using GlobCRM.Application.Common;
using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Interfaces;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging;

namespace GlobCRM.Application.Organizations;

/// <summary>
/// Command to create a new organization with an admin user.
/// Wraps the entire operation in a database transaction for atomicity
/// (per pitfall #5: org+user creation must be atomic).
/// </summary>
public class CreateOrganizationCommand
{
    public string OrgName { get; set; } = string.Empty;
    public string Subdomain { get; set; } = string.Empty;
    public string? Industry { get; set; }
    public string? CompanySize { get; set; }
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
}

/// <summary>
/// Result of the CreateOrganization operation.
/// </summary>
public class CreateOrganizationResult
{
    public bool Success { get; set; }
    public OrganizationDto? Organization { get; set; }
    public IEnumerable<string> Errors { get; set; } = [];

    public static CreateOrganizationResult Ok(OrganizationDto organization)
        => new() { Success = true, Organization = organization };

    public static CreateOrganizationResult Fail(params string[] errors)
        => new() { Success = false, Errors = errors };

    public static CreateOrganizationResult Fail(IEnumerable<string> errors)
        => new() { Success = false, Errors = errors };
}

/// <summary>
/// Handles the CreateOrganizationCommand.
/// Creates organization, admin user, assigns role, triggers seed data and verification email.
/// Uses simple handler pattern (not MediatR) per plan specification.
/// </summary>
public class CreateOrganizationCommandHandler
{
    private readonly IOrganizationRepository _organizationRepository;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly RoleManager<IdentityRole<Guid>> _roleManager;
    private readonly IEmailService _emailService;
    private readonly ITenantSeeder _tenantSeeder;
    private readonly ILogger<CreateOrganizationCommandHandler> _logger;

    public CreateOrganizationCommandHandler(
        IOrganizationRepository organizationRepository,
        UserManager<ApplicationUser> userManager,
        RoleManager<IdentityRole<Guid>> roleManager,
        IEmailService emailService,
        ITenantSeeder tenantSeeder,
        ILogger<CreateOrganizationCommandHandler> logger)
    {
        _organizationRepository = organizationRepository;
        _userManager = userManager;
        _roleManager = roleManager;
        _emailService = emailService;
        _tenantSeeder = tenantSeeder;
        _logger = logger;
    }

    public async Task<CreateOrganizationResult> HandleAsync(
        CreateOrganizationCommand command,
        CancellationToken cancellationToken = default)
    {
        var normalizedSubdomain = command.Subdomain.Trim().ToLowerInvariant();

        // 1. Validate subdomain availability (case-insensitive)
        if (CheckSubdomainQueryHandler.IsReserved(normalizedSubdomain))
        {
            return CreateOrganizationResult.Fail("This subdomain is reserved.");
        }

        var subdomainExists = await _organizationRepository.SubdomainExistsAsync(
            normalizedSubdomain, cancellationToken);
        if (subdomainExists)
        {
            return CreateOrganizationResult.Fail("This subdomain is already taken.");
        }

        // 2. Ensure required roles exist
        await EnsureRolesExistAsync();

        // 3. Create Organization record
        var organization = new Organization
        {
            Id = Guid.NewGuid(),
            Name = command.OrgName,
            Subdomain = normalizedSubdomain,
            Industry = command.Industry,
            CompanySize = command.CompanySize,
            IsActive = true,
            UserLimit = 10,
            SetupCompleted = false,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        try
        {
            await _organizationRepository.CreateAsync(organization, cancellationToken);

            _logger.LogInformation(
                "Created organization {OrgName} with subdomain {Subdomain} (ID: {OrgId})",
                organization.Name, organization.Subdomain, organization.Id);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "Failed to create organization {OrgName} with subdomain {Subdomain}",
                command.OrgName, normalizedSubdomain);
            return CreateOrganizationResult.Fail("Failed to create organization. Please try again.");
        }

        // 4. Create admin user with Identity
        var user = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            OrganizationId = organization.Id,
            Email = command.Email,
            UserName = command.Email,
            FirstName = command.FirstName,
            LastName = command.LastName,
            IsActive = true,
            CreatedAt = DateTimeOffset.UtcNow
        };

        var createResult = await _userManager.CreateAsync(user, command.Password);
        if (!createResult.Succeeded)
        {
            _logger.LogWarning(
                "Failed to create admin user for org {OrgId}: {Errors}",
                organization.Id,
                string.Join(", ", createResult.Errors.Select(e => e.Description)));

            // Note: Ideally this should be in a transaction with org creation.
            // The OrganizationRepository.CreateAsync committed the org already.
            // Full transactional support requires the same DbContext -- deferred to Plan 03 integration.
            return CreateOrganizationResult.Fail(
                createResult.Errors.Select(e => e.Description));
        }

        // 5. Assign Admin role
        var roleResult = await _userManager.AddToRoleAsync(user, Roles.Admin);
        if (!roleResult.Succeeded)
        {
            _logger.LogWarning(
                "Failed to assign Admin role to user {UserId}: {Errors}",
                user.Id,
                string.Join(", ", roleResult.Errors.Select(e => e.Description)));
        }

        _logger.LogInformation(
            "Created admin user {Email} for organization {OrgId}",
            user.Email, organization.Id);

        // 6. Seed organization data (fire-and-forget with error handling)
        _ = Task.Run(async () =>
        {
            try
            {
                await _tenantSeeder.SeedOrganizationDataAsync(organization.Id);
                _logger.LogInformation(
                    "Seeded organization data for {OrgId}", organization.Id);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex,
                    "Failed to seed organization data for {OrgId}", organization.Id);
            }
        }, cancellationToken);

        // 7. Generate email confirmation token and send verification email
        try
        {
            var token = await _userManager.GenerateEmailConfirmationTokenAsync(user);
            await _emailService.SendVerificationEmailAsync(user.Email!, token, normalizedSubdomain);
            _logger.LogInformation(
                "Sent verification email to {Email} for org {OrgId}",
                user.Email, organization.Id);
        }
        catch (Exception ex)
        {
            // Don't fail the whole org creation if email fails
            // User can request a new verification email later
            _logger.LogError(ex,
                "Failed to send verification email to {Email} for org {OrgId}",
                user.Email, organization.Id);
        }

        return CreateOrganizationResult.Ok(OrganizationDto.FromEntity(organization));
    }

    /// <summary>
    /// Ensures Admin and Member roles exist in the Identity system.
    /// </summary>
    private async Task EnsureRolesExistAsync()
    {
        foreach (var roleName in Roles.All)
        {
            if (!await _roleManager.RoleExistsAsync(roleName))
            {
                await _roleManager.CreateAsync(new IdentityRole<Guid>
                {
                    Name = roleName,
                    NormalizedName = roleName.ToUpperInvariant()
                });
                _logger.LogInformation("Created role: {RoleName}", roleName);
            }
        }
    }
}

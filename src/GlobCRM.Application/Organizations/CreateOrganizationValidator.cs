using FluentValidation;

namespace GlobCRM.Application.Organizations;

/// <summary>
/// Request model for creating a new organization.
/// </summary>
public class CreateOrganizationRequest
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
/// FluentValidation validator for CreateOrganizationRequest.
/// Validates org details and admin user credentials.
/// </summary>
public class CreateOrganizationValidator : AbstractValidator<CreateOrganizationRequest>
{
    public CreateOrganizationValidator()
    {
        RuleFor(x => x.OrgName)
            .NotEmpty().WithMessage("Organization name is required.")
            .MinimumLength(2).WithMessage("Organization name must be at least 2 characters.")
            .MaximumLength(255).WithMessage("Organization name must not exceed 255 characters.");

        RuleFor(x => x.Subdomain)
            .NotEmpty().WithMessage("Subdomain is required.")
            .MinimumLength(3).WithMessage("Subdomain must be at least 3 characters.")
            .MaximumLength(63).WithMessage("Subdomain must not exceed 63 characters.")
            .Matches(@"^[a-z0-9]([a-z0-9-]*[a-z0-9])?$")
                .WithMessage("Subdomain must be lowercase alphanumeric with hyphens only, and cannot start or end with a hyphen.")
            .Must(subdomain => !CheckSubdomainQueryHandler.IsReserved(subdomain))
                .WithMessage("This subdomain is reserved and cannot be used.");

        RuleFor(x => x.Email)
            .NotEmpty().WithMessage("Email is required.")
            .EmailAddress().WithMessage("A valid email address is required.");

        RuleFor(x => x.Password)
            .NotEmpty().WithMessage("Password is required.")
            .MinimumLength(8).WithMessage("Password must be at least 8 characters.");

        RuleFor(x => x.FirstName)
            .NotEmpty().WithMessage("First name is required.")
            .MaximumLength(100).WithMessage("First name must not exceed 100 characters.");

        RuleFor(x => x.LastName)
            .NotEmpty().WithMessage("Last name is required.")
            .MaximumLength(100).WithMessage("Last name must not exceed 100 characters.");
    }
}

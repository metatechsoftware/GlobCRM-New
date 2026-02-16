using FluentValidation;
using GlobCRM.Domain.Entities;

namespace GlobCRM.Application.Invitations;

/// <summary>
/// FluentValidation validator for SendInvitationRequest.
/// Validates email list and role assignment.
/// </summary>
public class SendInvitationValidator : AbstractValidator<SendInvitationRequest>
{
    public SendInvitationValidator()
    {
        RuleFor(x => x.Emails)
            .NotEmpty().WithMessage("At least one email address is required.")
            .Must(emails => emails.Count <= 50)
                .WithMessage("Cannot send more than 50 invitations at once.");

        RuleForEach(x => x.Emails)
            .NotEmpty().WithMessage("Email address cannot be empty.")
            .EmailAddress().WithMessage("'{PropertyValue}' is not a valid email address.");

        RuleFor(x => x.Role)
            .NotEmpty().WithMessage("Role is required.")
            .Must(role => role == Roles.Admin || role == Roles.Member)
                .WithMessage("Role must be 'Admin' or 'Member'.");
    }
}

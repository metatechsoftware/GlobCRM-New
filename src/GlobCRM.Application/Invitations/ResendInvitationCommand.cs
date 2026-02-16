using GlobCRM.Application.Common;
using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Interfaces;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging;

namespace GlobCRM.Application.Invitations;

/// <summary>
/// Command to resend an invitation with a new token and extended expiry.
/// Per locked decision: admin can resend expired invitations.
/// </summary>
public class ResendInvitationCommand
{
    public Guid InvitationId { get; set; }
    public Guid OrganizationId { get; set; }
}

/// <summary>
/// Result of the ResendInvitation operation.
/// </summary>
public class ResendInvitationResult
{
    public bool Success { get; set; }
    public IEnumerable<string> Errors { get; set; } = [];

    public static ResendInvitationResult Ok() => new() { Success = true };

    public static ResendInvitationResult Fail(params string[] errors)
        => new() { Success = false, Errors = errors };
}

/// <summary>
/// Handles the ResendInvitationCommand.
/// Generates a new token, resets expiry, and re-sends the invitation email.
/// </summary>
public class ResendInvitationCommandHandler
{
    private readonly IInvitationRepository _invitationRepository;
    private readonly ITenantProvider _tenantProvider;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly IEmailService _emailService;
    private readonly ILogger<ResendInvitationCommandHandler> _logger;

    public ResendInvitationCommandHandler(
        IInvitationRepository invitationRepository,
        ITenantProvider tenantProvider,
        UserManager<ApplicationUser> userManager,
        IEmailService emailService,
        ILogger<ResendInvitationCommandHandler> logger)
    {
        _invitationRepository = invitationRepository;
        _tenantProvider = tenantProvider;
        _userManager = userManager;
        _emailService = emailService;
        _logger = logger;
    }

    public async Task<ResendInvitationResult> HandleAsync(
        ResendInvitationCommand command,
        CancellationToken cancellationToken = default)
    {
        // 1. Find invitation and verify it belongs to current org
        var invitation = await _invitationRepository
            .GetByIdAsync(command.InvitationId, command.OrganizationId, cancellationToken);

        if (invitation == null)
        {
            return ResendInvitationResult.Fail("Invitation not found.");
        }

        // 2. Cannot resend already accepted invitations
        if (invitation.IsAccepted)
        {
            return ResendInvitationResult.Fail("This invitation has already been accepted.");
        }

        // 3. Get organization for email branding
        var organization = await _tenantProvider.GetCurrentOrganizationAsync();
        if (organization == null)
        {
            return ResendInvitationResult.Fail("Organization not found.");
        }

        // 4. Get inviter info
        var inviter = await _userManager.FindByIdAsync(invitation.InvitedByUserId.ToString());
        var inviterName = inviter?.FullName ?? "An administrator";

        // 5. Generate new token (invalidate old link) and reset expiry
        invitation.Token = Guid.NewGuid().ToString("N");
        invitation.ExpiresAt = DateTimeOffset.UtcNow.AddDays(7);
        await _invitationRepository.UpdateAsync(invitation, cancellationToken);

        // 6. Re-send invitation email with new token
        var joinUrl = $"https://{organization.Subdomain}.globcrm.com/auth/join/{invitation.Token}";
        try
        {
            await _emailService.SendInvitationEmailAsync(
                invitation.Email,
                organization.Name,
                inviterName,
                invitation.Role,
                joinUrl);

            _logger.LogInformation(
                "Resent invitation {InvitationId} to {Email} for org {OrgName}",
                invitation.Id, invitation.Email, organization.Name);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "Failed to resend invitation email to {Email} for org {OrgId}",
                invitation.Email, command.OrganizationId);
            return ResendInvitationResult.Fail("Invitation token updated but email delivery failed. Please try again.");
        }

        return ResendInvitationResult.Ok();
    }
}

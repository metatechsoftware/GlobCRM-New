using GlobCRM.Application.Common;
using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Interfaces;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging;

namespace GlobCRM.Application.Invitations;

/// <summary>
/// Request model for sending invitations. Supports bulk invite.
/// </summary>
public class SendInvitationRequest
{
    public List<string> Emails { get; set; } = [];
    public string Role { get; set; } = Roles.Member;
}

/// <summary>
/// Result of the SendInvitation operation.
/// </summary>
public class SendInvitationResult
{
    public bool Success { get; set; }
    public int Sent { get; set; }
    public int Skipped { get; set; }
    public List<string> Warnings { get; set; } = [];
    public List<string> Errors { get; set; } = [];

    public static SendInvitationResult Ok(int sent, int skipped, List<string> warnings)
        => new() { Success = true, Sent = sent, Skipped = skipped, Warnings = warnings };

    public static SendInvitationResult Fail(params string[] errors)
        => new() { Success = false, Errors = [.. errors] };
}

/// <summary>
/// Command to send invitations to one or more email addresses.
/// Handles bulk invite, deduplication, soft user limit warning, and branded emails.
/// </summary>
public class SendInvitationCommand
{
    public List<string> Emails { get; set; } = [];
    public string Role { get; set; } = Roles.Member;
    public Guid InvitedByUserId { get; set; }
    public Guid OrganizationId { get; set; }
}

/// <summary>
/// Handles the SendInvitationCommand.
/// Creates invitation records and sends branded invitation emails.
/// </summary>
public class SendInvitationCommandHandler
{
    private readonly IInvitationRepository _invitationRepository;
    private readonly ITenantProvider _tenantProvider;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly IEmailService _emailService;
    private readonly ILogger<SendInvitationCommandHandler> _logger;

    public SendInvitationCommandHandler(
        IInvitationRepository invitationRepository,
        ITenantProvider tenantProvider,
        UserManager<ApplicationUser> userManager,
        IEmailService emailService,
        ILogger<SendInvitationCommandHandler> logger)
    {
        _invitationRepository = invitationRepository;
        _tenantProvider = tenantProvider;
        _userManager = userManager;
        _emailService = emailService;
        _logger = logger;
    }

    public async Task<SendInvitationResult> HandleAsync(
        SendInvitationCommand command,
        CancellationToken cancellationToken = default)
    {
        // Get current organization
        var organization = await _tenantProvider.GetCurrentOrganizationAsync();
        if (organization == null)
        {
            return SendInvitationResult.Fail("Organization not found.");
        }

        // Get inviter info
        var inviter = await _userManager.FindByIdAsync(command.InvitedByUserId.ToString());
        if (inviter == null)
        {
            return SendInvitationResult.Fail("Inviter user not found.");
        }

        var warnings = new List<string>();

        // Check soft user limit (10 users per locked decision)
        // Using synchronous Count() from System.Linq to avoid EF Core dependency in Application layer
        var activeUserCount = _userManager.Users
            .Where(u => u.OrganizationId == command.OrganizationId && u.IsActive)
            .Count();

        var pendingInvitations = await _invitationRepository
            .GetByOrganizationAsync(command.OrganizationId, cancellationToken);
        var pendingCount = pendingInvitations.Count(i => !i.IsAccepted && !i.IsExpired);

        var totalCount = activeUserCount + pendingCount;
        if (totalCount >= organization.UserLimit)
        {
            warnings.Add($"Organization {organization.Name} has reached the user limit of {organization.UserLimit}. " +
                          "You can still send invitations, but consider requesting a limit increase.");
            _logger.LogWarning(
                "Organization {OrgName} has reached user limit of {Limit} (active: {Active}, pending: {Pending})",
                organization.Name, organization.UserLimit, activeUserCount, pendingCount);
        }

        var sent = 0;
        var skipped = 0;

        foreach (var rawEmail in command.Emails)
        {
            // Normalize: trim + lowercase
            var email = rawEmail.Trim().ToLowerInvariant();

            // Skip if user already exists in this org
            // Use FindByEmailAsync + check org membership to avoid EF Core dependency
            var existingUser = await _userManager.FindByEmailAsync(email);
            if (existingUser != null && existingUser.OrganizationId == command.OrganizationId)
            {
                _logger.LogInformation(
                    "Skipping invitation for {Email}: user already exists in org {OrgId}",
                    email, command.OrganizationId);
                skipped++;
                continue;
            }

            // Skip if pending invitation already exists for this email
            var existingInvitation = await _invitationRepository
                .GetPendingByEmailAsync(command.OrganizationId, email, cancellationToken);
            if (existingInvitation != null)
            {
                _logger.LogInformation(
                    "Skipping invitation for {Email}: pending invitation already exists in org {OrgId}",
                    email, command.OrganizationId);
                skipped++;
                continue;
            }

            // Create invitation record
            var invitation = new Invitation
            {
                Id = Guid.NewGuid(),
                TenantId = command.OrganizationId,
                Email = email,
                Role = command.Role,
                InvitedByUserId = command.InvitedByUserId,
                Token = Guid.NewGuid().ToString("N"),
                ExpiresAt = DateTimeOffset.UtcNow.AddDays(7),
                CreatedAt = DateTimeOffset.UtcNow
            };

            await _invitationRepository.CreateAsync(invitation, cancellationToken);

            // Send branded invitation email
            var joinUrl = $"https://{organization.Subdomain}.globcrm.com/auth/join/{invitation.Token}";
            try
            {
                await _emailService.SendInvitationEmailAsync(
                    email,
                    organization.Name,
                    inviter.FullName,
                    invitation.Role,
                    joinUrl);

                _logger.LogInformation(
                    "Sent invitation to {Email} for org {OrgName} with role {Role}",
                    email, organization.Name, invitation.Role);
            }
            catch (Exception ex)
            {
                // Log but don't fail -- invitation record was created, email can be resent
                _logger.LogError(ex,
                    "Failed to send invitation email to {Email} for org {OrgId}",
                    email, command.OrganizationId);
                warnings.Add($"Invitation created for {email} but email delivery failed. You can resend later.");
            }

            sent++;
        }

        _logger.LogInformation(
            "Bulk invitation complete for org {OrgId}: {Sent} sent, {Skipped} skipped",
            command.OrganizationId, sent, skipped);

        return SendInvitationResult.Ok(sent, skipped, warnings);
    }
}

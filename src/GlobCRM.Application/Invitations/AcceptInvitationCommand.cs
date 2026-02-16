using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Interfaces;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging;

namespace GlobCRM.Application.Invitations;

/// <summary>
/// Request model for accepting an invitation and creating a user account.
/// </summary>
public class AcceptInvitationRequest
{
    public string Token { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
}

/// <summary>
/// Result of the AcceptInvitation operation.
/// </summary>
public class AcceptInvitationResult
{
    public bool Success { get; set; }
    public Guid? UserId { get; set; }
    public string? Email { get; set; }
    public string? OrganizationName { get; set; }
    public IEnumerable<string> Errors { get; set; } = [];

    public static AcceptInvitationResult Ok(Guid userId, string email, string orgName)
        => new() { Success = true, UserId = userId, Email = email, OrganizationName = orgName };

    public static AcceptInvitationResult Fail(params string[] errors)
        => new() { Success = false, Errors = errors };
}

/// <summary>
/// Command to accept an invitation and create a user account.
/// </summary>
public class AcceptInvitationCommand
{
    public string Token { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
}

/// <summary>
/// Handles the AcceptInvitationCommand.
/// Validates the invitation token, creates the user account, assigns the role,
/// and marks the invitation as accepted.
/// </summary>
public class AcceptInvitationCommandHandler
{
    private readonly IInvitationRepository _invitationRepository;
    private readonly IOrganizationRepository _organizationRepository;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly ILogger<AcceptInvitationCommandHandler> _logger;

    public AcceptInvitationCommandHandler(
        IInvitationRepository invitationRepository,
        IOrganizationRepository organizationRepository,
        UserManager<ApplicationUser> userManager,
        ILogger<AcceptInvitationCommandHandler> logger)
    {
        _invitationRepository = invitationRepository;
        _organizationRepository = organizationRepository;
        _userManager = userManager;
        _logger = logger;
    }

    public async Task<AcceptInvitationResult> HandleAsync(
        AcceptInvitationCommand command,
        CancellationToken cancellationToken = default)
    {
        // 1. Look up invitation by token (cross-tenant -- not tenant-scoped)
        var invitation = await _invitationRepository.GetByTokenAsync(command.Token, cancellationToken);
        if (invitation == null)
        {
            return AcceptInvitationResult.Fail("Invalid invitation token.");
        }

        // 2. Validate invitation is not expired
        if (invitation.IsExpired)
        {
            return AcceptInvitationResult.Fail(
                "This invitation has expired. Please ask the administrator to resend it.");
        }

        // 3. Validate invitation is not already accepted
        if (invitation.IsAccepted)
        {
            return AcceptInvitationResult.Fail("This invitation has already been accepted.");
        }

        // 4. Validate email matches invitation email (case-insensitive)
        if (!string.Equals(command.Email.Trim(), invitation.Email, StringComparison.OrdinalIgnoreCase))
        {
            return AcceptInvitationResult.Fail(
                "The email address does not match the invitation.");
        }

        // 5. Get the organization for the invitation
        var organization = await _organizationRepository.GetByIdAsync(invitation.TenantId, cancellationToken);
        if (organization == null)
        {
            return AcceptInvitationResult.Fail("The organization for this invitation no longer exists.");
        }

        if (!organization.IsActive)
        {
            return AcceptInvitationResult.Fail("The organization for this invitation is currently deactivated.");
        }

        // 6. Create ApplicationUser
        var user = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            Email = command.Email.Trim().ToLowerInvariant(),
            UserName = command.Email.Trim().ToLowerInvariant(),
            FirstName = command.FirstName,
            LastName = command.LastName,
            OrganizationId = invitation.TenantId,
            EmailConfirmed = true, // Invitation IS the email verification
            IsActive = true,
            CreatedAt = DateTimeOffset.UtcNow
        };

        var createResult = await _userManager.CreateAsync(user, command.Password);
        if (!createResult.Succeeded)
        {
            _logger.LogWarning(
                "Failed to create user from invitation {InvitationId}: {Errors}",
                invitation.Id,
                string.Join(", ", createResult.Errors.Select(e => e.Description)));

            return AcceptInvitationResult.Fail(
                createResult.Errors.Select(e => e.Description).ToArray());
        }

        // 7. Assign role from invitation
        var roleResult = await _userManager.AddToRoleAsync(user, invitation.Role);
        if (!roleResult.Succeeded)
        {
            _logger.LogWarning(
                "Failed to assign role {Role} to user {UserId} from invitation: {Errors}",
                invitation.Role, user.Id,
                string.Join(", ", roleResult.Errors.Select(e => e.Description)));
        }

        // 8. Mark invitation as accepted
        invitation.AcceptedAt = DateTimeOffset.UtcNow;
        await _invitationRepository.UpdateAsync(invitation, cancellationToken);

        _logger.LogInformation(
            "User {Email} accepted invitation {InvitationId} and joined org {OrgId} with role {Role}",
            user.Email, invitation.Id, invitation.TenantId, invitation.Role);

        return AcceptInvitationResult.Ok(user.Id, user.Email!, organization.Name);
    }
}

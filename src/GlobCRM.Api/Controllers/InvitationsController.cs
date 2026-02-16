using System.Security.Claims;
using FluentValidation;
using GlobCRM.Application.Invitations;
using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GlobCRM.Api.Controllers;

/// <summary>
/// REST endpoints for the invitation system.
/// POST   /api/invitations           - Send invitations (Admin only)
/// POST   /api/invitations/accept    - Accept invitation (no auth -- this IS signup)
/// POST   /api/invitations/{id}/resend - Resend invitation (Admin only)
/// GET    /api/invitations           - List invitations for current org (Admin only)
/// GET    /api/invitations/{token}/info - Get invitation info (no auth -- for join page)
/// DELETE /api/invitations/{id}      - Revoke invitation (Admin only)
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class InvitationsController : ControllerBase
{
    private readonly SendInvitationCommandHandler _sendHandler;
    private readonly AcceptInvitationCommandHandler _acceptHandler;
    private readonly ResendInvitationCommandHandler _resendHandler;
    private readonly IInvitationRepository _invitationRepository;
    private readonly IOrganizationRepository _organizationRepository;
    private readonly ITenantProvider _tenantProvider;
    private readonly IValidator<SendInvitationRequest> _sendValidator;
    private readonly ILogger<InvitationsController> _logger;

    public InvitationsController(
        SendInvitationCommandHandler sendHandler,
        AcceptInvitationCommandHandler acceptHandler,
        ResendInvitationCommandHandler resendHandler,
        IInvitationRepository invitationRepository,
        IOrganizationRepository organizationRepository,
        ITenantProvider tenantProvider,
        IValidator<SendInvitationRequest> sendValidator,
        ILogger<InvitationsController> logger)
    {
        _sendHandler = sendHandler;
        _acceptHandler = acceptHandler;
        _resendHandler = resendHandler;
        _invitationRepository = invitationRepository;
        _organizationRepository = organizationRepository;
        _tenantProvider = tenantProvider;
        _sendValidator = sendValidator;
        _logger = logger;
    }

    /// <summary>
    /// Sends invitations to one or more email addresses.
    /// Supports bulk invite per locked decision.
    /// Requires Admin role.
    /// </summary>
    [HttpPost]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(typeof(SendInvitationResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> SendInvitations(
        [FromBody] SendInvitationRequest request,
        CancellationToken cancellationToken)
    {
        // Validate request
        var validationResult = await _sendValidator.ValidateAsync(request, cancellationToken);
        if (!validationResult.IsValid)
        {
            return BadRequest(new
            {
                errors = validationResult.Errors
                    .Select(e => new { field = e.PropertyName, message = e.ErrorMessage })
            });
        }

        var tenantId = _tenantProvider.GetTenantId();
        if (tenantId == null)
        {
            return BadRequest(new { error = "Tenant context not established." });
        }

        var userId = GetCurrentUserId();
        if (userId == null)
        {
            return Unauthorized(new { error = "User identity not found." });
        }

        var command = new SendInvitationCommand
        {
            Emails = request.Emails,
            Role = request.Role,
            InvitedByUserId = userId.Value,
            OrganizationId = tenantId.Value
        };

        var result = await _sendHandler.HandleAsync(command, cancellationToken);

        if (!result.Success)
        {
            return BadRequest(new { errors = result.Errors });
        }

        return Ok(new
        {
            sent = result.Sent,
            skipped = result.Skipped,
            warnings = result.Warnings
        });
    }

    /// <summary>
    /// Accepts an invitation and creates a user account.
    /// No authentication required -- this IS the signup flow for invited users.
    /// </summary>
    [HttpPost("accept")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> AcceptInvitation(
        [FromBody] AcceptInvitationRequest request,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Token))
        {
            return BadRequest(new { error = "Invitation token is required." });
        }

        if (string.IsNullOrWhiteSpace(request.Email))
        {
            return BadRequest(new { error = "Email address is required." });
        }

        if (string.IsNullOrWhiteSpace(request.Password) || request.Password.Length < 8)
        {
            return BadRequest(new { error = "Password must be at least 8 characters." });
        }

        if (string.IsNullOrWhiteSpace(request.FirstName))
        {
            return BadRequest(new { error = "First name is required." });
        }

        if (string.IsNullOrWhiteSpace(request.LastName))
        {
            return BadRequest(new { error = "Last name is required." });
        }

        var command = new AcceptInvitationCommand
        {
            Token = request.Token,
            Email = request.Email,
            Password = request.Password,
            FirstName = request.FirstName,
            LastName = request.LastName
        };

        var result = await _acceptHandler.HandleAsync(command, cancellationToken);

        if (!result.Success)
        {
            return BadRequest(new { errors = result.Errors });
        }

        return StatusCode(StatusCodes.Status201Created, new
        {
            userId = result.UserId,
            email = result.Email,
            organizationName = result.OrganizationName,
            message = "Account created successfully. You can now log in."
        });
    }

    /// <summary>
    /// Resends an invitation with a new token and extended expiry.
    /// Per locked decision: admin can resend expired invitations.
    /// Requires Admin role.
    /// </summary>
    [HttpPost("{id:guid}/resend")]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> ResendInvitation(
        Guid id,
        CancellationToken cancellationToken)
    {
        var tenantId = _tenantProvider.GetTenantId();
        if (tenantId == null)
        {
            return BadRequest(new { error = "Tenant context not established." });
        }

        var command = new ResendInvitationCommand
        {
            InvitationId = id,
            OrganizationId = tenantId.Value
        };

        var result = await _resendHandler.HandleAsync(command, cancellationToken);

        if (!result.Success)
        {
            if (result.Errors.Any(e => e.Contains("not found", StringComparison.OrdinalIgnoreCase)))
            {
                return NotFound(new { errors = result.Errors });
            }
            return BadRequest(new { errors = result.Errors });
        }

        return Ok(new { message = "Invitation resent successfully." });
    }

    /// <summary>
    /// Lists all invitations for the current organization.
    /// Requires Admin role.
    /// </summary>
    [HttpGet]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(typeof(IEnumerable<InvitationDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> ListInvitations(CancellationToken cancellationToken)
    {
        var tenantId = _tenantProvider.GetTenantId();
        if (tenantId == null)
        {
            return BadRequest(new { error = "Tenant context not established." });
        }

        var invitations = await _invitationRepository
            .GetByOrganizationAsync(tenantId.Value, cancellationToken);

        var dtos = invitations.Select(InvitationDto.FromEntity).ToList();

        return Ok(dtos);
    }

    /// <summary>
    /// Gets public invitation info for the join page.
    /// No authentication required -- used to display org name, inviter, and role
    /// before the user fills in the acceptance form.
    /// Does NOT expose sensitive data.
    /// </summary>
    [HttpGet("{token}/info")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(InvitationInfoDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetInvitationInfo(
        string token,
        CancellationToken cancellationToken)
    {
        var invitation = await _invitationRepository.GetByTokenAsync(token, cancellationToken);
        if (invitation == null)
        {
            return NotFound(new { error = "Invitation not found." });
        }

        // Get organization name using the invitation's TenantId.
        // This is an anonymous endpoint with no tenant context, so query the org directly.
        var organization = await _organizationRepository.GetByIdAsync(invitation.TenantId, cancellationToken);
        var orgName = organization?.Name ?? "Your organization";

        return Ok(new InvitationInfoDto
        {
            OrgName = orgName,
            InviterName = invitation.InvitedByUser?.FullName ?? "An administrator",
            Role = invitation.Role,
            Email = invitation.Email,
            IsExpired = invitation.IsExpired
        });
    }

    /// <summary>
    /// Revokes (deletes) an invitation.
    /// Requires Admin role.
    /// </summary>
    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> RevokeInvitation(
        Guid id,
        CancellationToken cancellationToken)
    {
        var tenantId = _tenantProvider.GetTenantId();
        if (tenantId == null)
        {
            return BadRequest(new { error = "Tenant context not established." });
        }

        var invitation = await _invitationRepository.GetByIdAsync(id, tenantId.Value, cancellationToken);
        if (invitation == null)
        {
            return NotFound(new { error = "Invitation not found." });
        }

        if (invitation.IsAccepted)
        {
            return BadRequest(new { error = "Cannot revoke an accepted invitation." });
        }

        await _invitationRepository.DeleteAsync(invitation, cancellationToken);

        _logger.LogInformation(
            "Invitation {InvitationId} for {Email} revoked by admin in org {OrgId}",
            id, invitation.Email, tenantId.Value);

        return Ok(new { message = "Invitation revoked successfully." });
    }

    /// <summary>
    /// Extracts the current user's ID from JWT claims.
    /// </summary>
    private Guid? GetCurrentUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (userIdClaim != null && Guid.TryParse(userIdClaim, out var userId))
        {
            return userId;
        }
        return null;
    }
}

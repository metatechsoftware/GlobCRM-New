using GlobCRM.Domain.Entities;

namespace GlobCRM.Application.Invitations;

/// <summary>
/// Data transfer object for invitation data returned to clients.
/// </summary>
public class InvitationDto
{
    public Guid Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string InviterName { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public DateTimeOffset ExpiresAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? AcceptedAt { get; set; }

    /// <summary>
    /// Maps an Invitation entity to a DTO with computed status.
    /// </summary>
    public static InvitationDto FromEntity(Invitation invitation)
    {
        var status = invitation.IsAccepted ? "Accepted"
            : invitation.IsExpired ? "Expired"
            : "Pending";

        return new InvitationDto
        {
            Id = invitation.Id,
            Email = invitation.Email,
            Role = invitation.Role,
            InviterName = invitation.InvitedByUser?.FullName ?? "Unknown",
            Status = status,
            ExpiresAt = invitation.ExpiresAt,
            CreatedAt = invitation.CreatedAt,
            AcceptedAt = invitation.AcceptedAt
        };
    }
}

/// <summary>
/// Lightweight DTO for the public invitation info endpoint (no auth required).
/// Exposes only non-sensitive data needed to display the join page.
/// </summary>
public class InvitationInfoDto
{
    public string OrgName { get; set; } = string.Empty;
    public string InviterName { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public bool IsExpired { get; set; }
}

namespace GlobCRM.Domain.Entities;

/// <summary>
/// Represents an invitation to join an organization.
/// Invitations expire after 7 days and use cryptographically random tokens.
/// </summary>
public class Invitation
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>
    /// Tenant (organization) ID. Named TenantId for Finbuckle compatibility.
    /// </summary>
    public Guid TenantId { get; set; }

    /// <summary>
    /// Email address of the invited user.
    /// </summary>
    public string Email { get; set; } = string.Empty;

    /// <summary>
    /// Role assigned to the invited user (Admin or Member).
    /// Defaults to "Member" per locked decision.
    /// </summary>
    public string Role { get; set; } = Roles.Member;

    /// <summary>
    /// ID of the user who sent the invitation.
    /// </summary>
    public Guid InvitedByUserId { get; set; }

    /// <summary>
    /// Navigation property to the inviting user.
    /// </summary>
    public ApplicationUser InvitedByUser { get; set; } = null!;

    /// <summary>
    /// Cryptographically random token for the invitation link.
    /// Not sequential -- prevents enumeration attacks.
    /// </summary>
    public string Token { get; set; } = string.Empty;

    /// <summary>
    /// Invitation expiration timestamp. 7 days from creation per locked decision.
    /// </summary>
    public DateTimeOffset ExpiresAt { get; set; }

    /// <summary>
    /// Timestamp when the invitation was accepted. Null if pending.
    /// </summary>
    public DateTimeOffset? AcceptedAt { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    /// <summary>
    /// Whether the invitation has expired.
    /// </summary>
    public bool IsExpired => DateTimeOffset.UtcNow > ExpiresAt;

    /// <summary>
    /// Whether the invitation has been accepted.
    /// </summary>
    public bool IsAccepted => AcceptedAt.HasValue;

    /// <summary>
    /// Whether the invitation is still valid (not expired and not accepted).
    /// </summary>
    public bool IsValid => !IsExpired && !IsAccepted;
}

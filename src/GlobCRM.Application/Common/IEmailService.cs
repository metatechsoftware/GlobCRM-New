namespace GlobCRM.Application.Common;

/// <summary>
/// Service for sending transactional emails (verification, password reset, invitations).
/// Implemented by infrastructure layer using SendGrid or similar provider.
/// </summary>
public interface IEmailService
{
    /// <summary>
    /// Sends an email verification link to a newly registered user.
    /// </summary>
    /// <param name="email">Recipient email address.</param>
    /// <param name="verificationToken">Email confirmation token from Identity.</param>
    /// <param name="subdomain">Organization subdomain for constructing the verification URL.</param>
    Task SendVerificationEmailAsync(string email, string verificationToken, string subdomain);

    /// <summary>
    /// Sends a password reset link to the user.
    /// </summary>
    /// <param name="email">Recipient email address.</param>
    /// <param name="resetToken">Password reset token from Identity.</param>
    /// <param name="subdomain">Organization subdomain for constructing the reset URL.</param>
    Task SendPasswordResetEmailAsync(string email, string resetToken, string subdomain);

    /// <summary>
    /// Sends an invitation email to join an organization.
    /// Email is branded with org name, inviter name, role, and join link per locked decision.
    /// </summary>
    /// <param name="email">Recipient email address.</param>
    /// <param name="orgName">Name of the inviting organization.</param>
    /// <param name="inviterName">Full name of the user sending the invitation.</param>
    /// <param name="role">Role being assigned (Admin or Member).</param>
    /// <param name="joinUrl">Full URL for accepting the invitation.</param>
    Task SendInvitationEmailAsync(string email, string orgName, string inviterName, string role, string joinUrl);
}

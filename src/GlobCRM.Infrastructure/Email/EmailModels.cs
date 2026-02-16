namespace GlobCRM.Infrastructure.Email;

/// <summary>
/// Base model for all email templates. Contains shared layout properties.
/// </summary>
public abstract class EmailModelBase
{
    public string UserName { get; set; } = string.Empty;
    public int Year { get; set; } = DateTimeOffset.UtcNow.Year;
}

/// <summary>
/// Model for the email verification template.
/// </summary>
public class VerificationEmailModel : EmailModelBase
{
    public string VerificationUrl { get; set; } = string.Empty;
}

/// <summary>
/// Model for the password reset template.
/// </summary>
public class PasswordResetEmailModel : EmailModelBase
{
    public string ResetUrl { get; set; } = string.Empty;
}

/// <summary>
/// Model for the invitation email template.
/// Includes org name, inviter name, role, and join link per locked decision.
/// </summary>
public class InvitationEmailModel : EmailModelBase
{
    public string InviterName { get; set; } = string.Empty;
    public string OrgName { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string JoinUrl { get; set; } = string.Empty;
}

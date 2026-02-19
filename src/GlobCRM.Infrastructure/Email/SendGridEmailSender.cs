using System.Net;
using GlobCRM.Application.Common;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using SendGrid;
using SendGrid.Helpers.Mail;

namespace GlobCRM.Infrastructure.Email;

/// <summary>
/// Implements IEmailService using SendGrid API for transactional email delivery.
/// Renders branded Razor templates and sends via SendGrid.
/// Includes proper error handling and structured logging per pitfall #4
/// (email delivery fails silently).
/// </summary>
public class SendGridEmailSender : IEmailService
{
    private readonly SendGridClient _client;
    private readonly RazorEmailRenderer _renderer;
    private readonly ILogger<SendGridEmailSender> _logger;
    private readonly string _fromEmail;
    private readonly string _fromName;
    private readonly string _baseUrl;

    public SendGridEmailSender(
        IConfiguration configuration,
        RazorEmailRenderer renderer,
        ILogger<SendGridEmailSender> logger)
    {
        _renderer = renderer;
        _logger = logger;

        var apiKey = configuration["SendGrid:ApiKey"]
            ?? throw new InvalidOperationException("SendGrid:ApiKey configuration is required.");

        _fromEmail = configuration["SendGrid:FromEmail"] ?? "noreply@globcrm.com";
        _fromName = configuration["SendGrid:FromName"] ?? "GlobCRM";
        _baseUrl = configuration["App:BaseUrl"] ?? "globcrm.com";

        _client = new SendGridClient(apiKey);
    }

    /// <inheritdoc />
    public async Task SendVerificationEmailAsync(string email, string verificationToken, string subdomain)
    {
        var encodedToken = WebUtility.UrlEncode(verificationToken);
        var encodedEmail = WebUtility.UrlEncode(email);
        var verificationUrl = $"https://{subdomain}.{_baseUrl}/auth/verify-email?email={encodedEmail}&code={encodedToken}";

        _logger.LogInformation("=== VERIFICATION EMAIL ===\nTo: {Email}\nURL: {Url}\n=========================", email, verificationUrl);

        var model = new VerificationEmailModel
        {
            UserName = ExtractNameFromEmail(email),
            VerificationUrl = verificationUrl
        };

        var html = await _renderer.RenderAsync("VerificationEmailTemplate.cshtml", model);

        await SendEmailAsync(email, "Verify your email - GlobCRM", html, "verification");
    }

    /// <inheritdoc />
    public async Task SendPasswordResetEmailAsync(string email, string resetToken, string subdomain)
    {
        var encodedToken = WebUtility.UrlEncode(resetToken);
        var encodedEmail = WebUtility.UrlEncode(email);
        var resetUrl = $"https://{subdomain}.{_baseUrl}/auth/reset-password?email={encodedEmail}&code={encodedToken}";

        _logger.LogInformation("=== PASSWORD RESET EMAIL ===\nTo: {Email}\nURL: {Url}\n============================", email, resetUrl);

        var model = new PasswordResetEmailModel
        {
            UserName = ExtractNameFromEmail(email),
            ResetUrl = resetUrl
        };

        var html = await _renderer.RenderAsync("PasswordResetEmailTemplate.cshtml", model);

        await SendEmailAsync(email, "Reset your password - GlobCRM", html, "password-reset");
    }

    /// <inheritdoc />
    public async Task SendInvitationEmailAsync(string email, string orgName, string inviterName, string role, string joinUrl)
    {
        _logger.LogInformation("=== INVITATION EMAIL ===\nTo: {Email}\nOrg: {OrgName}\nRole: {Role}\nURL: {Url}\n========================", email, orgName, role, joinUrl);

        var model = new InvitationEmailModel
        {
            UserName = ExtractNameFromEmail(email),
            InviterName = inviterName,
            OrgName = orgName,
            Role = role,
            JoinUrl = joinUrl
        };

        var html = await _renderer.RenderAsync("InvitationEmailTemplate.cshtml", model);

        await SendEmailAsync(email, $"You're invited to join {orgName} on GlobCRM", html, "invitation");
    }

    /// <inheritdoc />
    public async Task SendNotificationEmailAsync(string email, string userName, string title, string message, string? entityUrl)
    {
        _logger.LogInformation("=== NOTIFICATION EMAIL ===\nTo: {Email}\nTitle: {Title}\nEntityUrl: {EntityUrl}\n==========================", email, title, entityUrl);

        var html = BuildNotificationEmailHtml(userName, title, message, entityUrl);

        await SendEmailAsync(email, $"{title} - GlobCRM", html, "notification");
    }

    /// <summary>
    /// Builds a branded inline HTML notification email matching existing GlobCRM email style.
    /// </summary>
    private string BuildNotificationEmailHtml(string userName, string title, string message, string? entityUrl)
    {
        var buttonHtml = !string.IsNullOrEmpty(entityUrl)
            ? $@"<tr>
                    <td style=""padding: 20px 0 0 0;"">
                        <a href=""https://{_baseUrl}{entityUrl}""
                           style=""display: inline-block; background-color: #4F46E5; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px;"">
                            View in GlobCRM
                        </a>
                    </td>
                </tr>"
            : "";

        return $@"<!DOCTYPE html>
<html>
<head><meta charset=""utf-8""><meta name=""viewport"" content=""width=device-width, initial-scale=1.0""></head>
<body style=""margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;"">
<table role=""presentation"" cellspacing=""0"" cellpadding=""0"" border=""0"" width=""100%"" style=""background-color: #f4f4f5;"">
<tr>
<td style=""padding: 40px 20px;"">
<table role=""presentation"" cellspacing=""0"" cellpadding=""0"" border=""0"" width=""560"" style=""margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);"">
    <tr>
        <td style=""padding: 32px 40px 24px; border-bottom: 1px solid #e4e4e7;"">
            <span style=""font-size: 20px; font-weight: 700; color: #4F46E5;"">GlobCRM</span>
        </td>
    </tr>
    <tr>
        <td style=""padding: 32px 40px;"">
            <table role=""presentation"" cellspacing=""0"" cellpadding=""0"" border=""0"" width=""100%"">
                <tr>
                    <td style=""font-size: 18px; font-weight: 600; color: #18181b; padding-bottom: 8px;"">
                        {System.Net.WebUtility.HtmlEncode(title)}
                    </td>
                </tr>
                <tr>
                    <td style=""font-size: 14px; color: #71717a; padding-bottom: 16px;"">
                        Hi {System.Net.WebUtility.HtmlEncode(userName)},
                    </td>
                </tr>
                <tr>
                    <td style=""font-size: 14px; color: #3f3f46; line-height: 1.6;"">
                        {System.Net.WebUtility.HtmlEncode(message)}
                    </td>
                </tr>
                {buttonHtml}
            </table>
        </td>
    </tr>
    <tr>
        <td style=""padding: 24px 40px; border-top: 1px solid #e4e4e7; font-size: 12px; color: #a1a1aa; text-align: center;"">
            You received this email because of your notification preferences in GlobCRM.
        </td>
    </tr>
</table>
</td>
</tr>
</table>
</body>
</html>";
    }

    /// <inheritdoc />
    public async Task SendRawEmailAsync(string toEmail, string subject, string htmlBody)
    {
        _logger.LogInformation("=== RAW EMAIL ===\nTo: {Email}\nSubject: {Subject}\n=================", toEmail, subject);

        await SendEmailAsync(toEmail, subject, htmlBody, "raw-template");
    }

    /// <summary>
    /// Sends an email via SendGrid with structured logging for delivery tracking.
    /// </summary>
    private async Task SendEmailAsync(string toEmail, string subject, string htmlContent, string emailType)
    {
        var from = new EmailAddress(_fromEmail, _fromName);
        var to = new EmailAddress(toEmail);
        var msg = MailHelper.CreateSingleEmail(from, to, subject, null, htmlContent);

        try
        {
            var response = await _client.SendEmailAsync(msg);

            if (response.IsSuccessStatusCode)
            {
                _logger.LogInformation(
                    "Email sent successfully: Type={EmailType}, To={ToEmail}, StatusCode={StatusCode}",
                    emailType, toEmail, response.StatusCode);
            }
            else
            {
                var body = await response.Body.ReadAsStringAsync();
                _logger.LogError(
                    "Email delivery failed: Type={EmailType}, To={ToEmail}, StatusCode={StatusCode}, Body={ResponseBody}",
                    emailType, toEmail, response.StatusCode, body);

                throw new InvalidOperationException(
                    $"SendGrid email delivery failed with status {response.StatusCode}: {body}");
            }
        }
        catch (Exception ex) when (ex is not InvalidOperationException)
        {
            _logger.LogError(ex,
                "Email send error: Type={EmailType}, To={ToEmail}",
                emailType, toEmail);
            throw;
        }
    }

    /// <summary>
    /// Extracts a display name from an email address (part before @).
    /// </summary>
    private static string ExtractNameFromEmail(string email)
    {
        var atIndex = email.IndexOf('@');
        return atIndex > 0 ? email[..atIndex] : email;
    }
}

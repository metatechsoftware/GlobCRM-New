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

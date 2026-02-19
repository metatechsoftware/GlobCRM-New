using GlobCRM.Application.Common;
using GlobCRM.Domain.Entities;
using GlobCRM.Infrastructure.Gmail;
using GlobCRM.Infrastructure.Persistence;
using Google.Apis.Gmail.v1;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using MimeKit;

namespace GlobCRM.Infrastructure.Sequences;

/// <summary>
/// Sends sequence emails via Gmail API (preferred) with custom MIME headers for reply detection,
/// or falls back to SendGrid when no Gmail account is connected.
/// Custom headers (X-Sequence-Id, X-Sequence-Step-Id, X-Enrollment-Id) survive email
/// forwarding/reply chains and are used by SequenceReplyDetector for auto-unenrollment.
/// </summary>
public class SequenceEmailSender
{
    private readonly ApplicationDbContext _db;
    private readonly GmailServiceFactory _serviceFactory;
    private readonly IEmailService _emailService;
    private readonly ILogger<SequenceEmailSender> _logger;

    public SequenceEmailSender(
        ApplicationDbContext db,
        GmailServiceFactory serviceFactory,
        IEmailService emailService,
        ILogger<SequenceEmailSender> logger)
    {
        _db = db;
        _serviceFactory = serviceFactory;
        _emailService = emailService;
        _logger = logger;
    }

    /// <summary>
    /// Sends a sequence email with custom MIME headers for reply detection.
    /// Tries Gmail first (supports custom headers), falls back to SendGrid.
    /// Creates a "sent" SequenceTrackingEvent regardless of sending method.
    /// </summary>
    /// <param name="toEmail">Recipient email address.</param>
    /// <param name="subject">Rendered email subject.</param>
    /// <param name="htmlBody">Rendered HTML body with tracking pixel and wrapped links.</param>
    /// <param name="enrollmentId">Enrollment ID for header injection and tracking event.</param>
    /// <param name="stepNumber">Step number for header injection and tracking event.</param>
    /// <param name="sequenceId">Sequence ID for header injection.</param>
    /// <param name="createdByUserId">The sequence creator's user ID (for Gmail account lookup).</param>
    /// <param name="tenantId">Tenant ID for tracking event and account lookup.</param>
    public async Task SendSequenceEmailAsync(
        string toEmail,
        string subject,
        string htmlBody,
        Guid enrollmentId,
        int stepNumber,
        Guid sequenceId,
        Guid createdByUserId,
        Guid tenantId)
    {
        string? gmailMessageId = null;
        string? gmailThreadId = null;

        // Try to send via Gmail (supports custom headers for reply detection)
        var emailAccount = await _db.EmailAccounts
            .FirstOrDefaultAsync(a => a.UserId == createdByUserId && a.TenantId == tenantId);

        if (emailAccount != null)
        {
            try
            {
                (gmailMessageId, gmailThreadId) = await SendViaGmailAsync(
                    emailAccount, toEmail, subject, htmlBody,
                    enrollmentId, stepNumber, sequenceId);

                _logger.LogInformation(
                    "Sequence email sent via Gmail: enrollment {EnrollmentId} step {StepNumber} to {To}, messageId={MessageId}",
                    enrollmentId, stepNumber, toEmail, gmailMessageId);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex,
                    "Gmail send failed for enrollment {EnrollmentId} step {StepNumber}, falling back to SendGrid",
                    enrollmentId, stepNumber);

                // Fall through to SendGrid fallback
                emailAccount = null;
            }
        }

        // Fallback to SendGrid (no custom headers -- reply detection won't work)
        if (emailAccount == null)
        {
            try
            {
                await _emailService.SendRawEmailAsync(toEmail, subject, htmlBody);

                _logger.LogInformation(
                    "Sequence email sent via SendGrid: enrollment {EnrollmentId} step {StepNumber} to {To}",
                    enrollmentId, stepNumber, toEmail);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex,
                    "Failed to send sequence email for enrollment {EnrollmentId} step {StepNumber} to {To}",
                    enrollmentId, stepNumber, toEmail);
                throw; // Re-throw so Hangfire can retry
            }
        }

        // Create "sent" tracking event
        try
        {
            var trackingEvent = new SequenceTrackingEvent
            {
                TenantId = tenantId,
                EnrollmentId = enrollmentId,
                StepNumber = stepNumber,
                EventType = "sent",
                GmailMessageId = gmailMessageId,
                GmailThreadId = gmailThreadId
            };

            _db.SequenceTrackingEvents.Add(trackingEvent);
            await _db.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            // Tracking event creation failure should not fail the send
            _logger.LogError(ex,
                "Failed to create sent tracking event for enrollment {EnrollmentId} step {StepNumber}",
                enrollmentId, stepNumber);
        }
    }

    /// <summary>
    /// Sends an email via Gmail API with custom MIME headers for reply detection.
    /// Returns the Gmail message ID and thread ID for tracking event storage.
    /// </summary>
    private async Task<(string? messageId, string? threadId)> SendViaGmailAsync(
        EmailAccount account,
        string toEmail,
        string subject,
        string htmlBody,
        Guid enrollmentId,
        int stepNumber,
        Guid sequenceId)
    {
        var gmail = await _serviceFactory.CreateForAccountAsync(account);

        // Build MimeKit message with custom headers
        var mimeMessage = new MimeMessage();
        mimeMessage.From.Add(MailboxAddress.Parse(account.GmailAddress));
        mimeMessage.To.Add(MailboxAddress.Parse(toEmail));
        mimeMessage.Subject = subject;
        mimeMessage.Body = new TextPart("html") { Text = htmlBody };

        // Inject custom headers for reply detection (per locked decision)
        mimeMessage.Headers.Add("X-Sequence-Id", sequenceId.ToString());
        mimeMessage.Headers.Add("X-Sequence-Step-Id", stepNumber.ToString());
        mimeMessage.Headers.Add("X-Enrollment-Id", enrollmentId.ToString());

        // Serialize to base64url-encoded string for Gmail API
        using var stream = new MemoryStream();
        await mimeMessage.WriteToAsync(stream);
        var rawBytes = stream.ToArray();
        var base64Url = Convert.ToBase64String(rawBytes)
            .Replace('+', '-')
            .Replace('/', '_')
            .TrimEnd('=');

        // Send via Gmail API
        var gmailMessage = new Google.Apis.Gmail.v1.Data.Message
        {
            Raw = base64Url
        };

        var sendRequest = gmail.Users.Messages.Send(gmailMessage, "me");
        var sentMessage = await sendRequest.ExecuteAsync();

        return (sentMessage.Id, sentMessage.ThreadId);
    }
}

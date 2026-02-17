using System.Text.Json;
using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Interfaces;
using GlobCRM.Infrastructure.Persistence;
using Google.Apis.Gmail.v1;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using MimeKit;

namespace GlobCRM.Infrastructure.Gmail;

/// <summary>
/// Sends emails via Gmail API using MimeKit for RFC-compliant MIME message construction.
/// Creates EmailMessage entity for sent messages with contact auto-linking.
/// Supports replies within existing threads via Gmail thread ID.
/// </summary>
public class GmailSendService
{
    private readonly GmailServiceFactory _serviceFactory;
    private readonly IEmailMessageRepository _messageRepository;
    private readonly ApplicationDbContext _db;
    private readonly ILogger<GmailSendService> _logger;

    public GmailSendService(
        GmailServiceFactory serviceFactory,
        IEmailMessageRepository messageRepository,
        ApplicationDbContext db,
        ILogger<GmailSendService> logger)
    {
        _serviceFactory = serviceFactory;
        _messageRepository = messageRepository;
        _db = db;
        _logger = logger;
    }

    /// <summary>
    /// Sends an email via Gmail API and creates an EmailMessage entity for the sent message.
    /// Supports thread replies by passing a Gmail thread ID.
    /// </summary>
    /// <param name="account">The sender's email account.</param>
    /// <param name="to">Recipient email address.</param>
    /// <param name="subject">Email subject.</param>
    /// <param name="htmlBody">HTML body content.</param>
    /// <param name="replyToGmailThreadId">Optional Gmail thread ID for reply threading.</param>
    /// <returns>The created EmailMessage entity.</returns>
    public async Task<EmailMessage> SendEmailAsync(
        EmailAccount account,
        string to,
        string subject,
        string htmlBody,
        string? replyToGmailThreadId = null)
    {
        var gmail = await _serviceFactory.CreateForAccountAsync(account);

        // Build MimeKit message
        var mimeMessage = new MimeMessage();
        mimeMessage.From.Add(MailboxAddress.Parse(account.GmailAddress));
        mimeMessage.To.Add(MailboxAddress.Parse(to));
        mimeMessage.Subject = subject;
        mimeMessage.Body = new TextPart("html") { Text = htmlBody };

        // Serialize to base64url-encoded string for Gmail API
        using var stream = new MemoryStream();
        await mimeMessage.WriteToAsync(stream);
        var rawBytes = stream.ToArray();
        var base64Url = Convert.ToBase64String(rawBytes)
            .Replace('+', '-')
            .Replace('/', '_')
            .TrimEnd('=');

        // Create Gmail API message
        var gmailMessage = new Google.Apis.Gmail.v1.Data.Message
        {
            Raw = base64Url
        };

        // Set thread ID for replies
        if (!string.IsNullOrEmpty(replyToGmailThreadId))
        {
            gmailMessage.ThreadId = replyToGmailThreadId;
        }

        // Send via Gmail API
        var sendRequest = gmail.Users.Messages.Send(gmailMessage, "me");
        var sentMessage = await sendRequest.ExecuteAsync();

        _logger.LogInformation("Email sent via Gmail: {MessageId} to {To}", sentMessage.Id, to);

        // Parse recipient to JSON array
        var toAddresses = JsonSerializer.Serialize(new[] { to });

        // Create body preview
        var strippedHtml = System.Text.RegularExpressions.Regex.Replace(htmlBody, "<[^>]+>", "");
        strippedHtml = System.Net.WebUtility.HtmlDecode(strippedHtml).Trim();
        var bodyPreview = strippedHtml.Length > 200 ? strippedHtml[..200] : strippedHtml;

        // Build EmailMessage entity for the sent message
        var emailMessage = new EmailMessage
        {
            TenantId = account.TenantId,
            EmailAccountId = account.Id,
            GmailMessageId = sentMessage.Id,
            GmailThreadId = sentMessage.ThreadId ?? replyToGmailThreadId ?? sentMessage.Id,
            Subject = subject,
            FromAddress = account.GmailAddress,
            FromName = account.GmailAddress, // Sent messages use account address as name
            ToAddresses = toAddresses,
            BodyPreview = bodyPreview,
            BodyHtml = htmlBody,
            BodyText = strippedHtml,
            HasAttachments = false,
            IsInbound = false,
            IsRead = true,
            IsStarred = false,
            SentAt = DateTimeOffset.UtcNow,
            SyncedAt = DateTimeOffset.UtcNow
        };

        // Contact auto-linking: check if recipient matches a known contact
        var matchingContact = await _db.Contacts
            .Where(c => c.TenantId == account.TenantId && c.Email != null &&
                        c.Email.ToLower() == to.ToLower())
            .Select(c => new { c.Id, c.CompanyId })
            .FirstOrDefaultAsync();

        if (matchingContact != null)
        {
            emailMessage.LinkedContactId = matchingContact.Id;
            if (matchingContact.CompanyId.HasValue)
            {
                emailMessage.LinkedCompanyId = matchingContact.CompanyId;
            }
        }

        // Thread management
        var threadId = emailMessage.GmailThreadId;
        var thread = await _messageRepository.GetThreadAsync(threadId);
        thread.TenantId = account.TenantId;
        thread.Subject = thread.MessageCount == 0 ? subject : thread.Subject;
        thread.Snippet = bodyPreview;
        thread.MessageCount++;
        thread.LastMessageAt = DateTimeOffset.UtcNow;

        if (matchingContact != null)
        {
            thread.LinkedContactId ??= matchingContact.Id;
            thread.LinkedCompanyId ??= matchingContact.CompanyId;
        }

        await _messageRepository.UpdateThreadAsync(thread);
        await _messageRepository.CreateAsync(emailMessage);

        return emailMessage;
    }
}

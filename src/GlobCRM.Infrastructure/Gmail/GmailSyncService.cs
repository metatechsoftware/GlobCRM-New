using System.Text;
using System.Text.Json;
using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Enums;
using GlobCRM.Domain.Interfaces;
using GlobCRM.Infrastructure.Notifications;
using GlobCRM.Infrastructure.Persistence;
using GlobCRM.Infrastructure.Sequences;
using Google.Apis.Gmail.v1;
using Google.Apis.Gmail.v1.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace GlobCRM.Infrastructure.Gmail;

/// <summary>
/// Core Gmail sync engine supporting both initial (date-range) and incremental (history.list) sync modes.
/// Auto-links emails to contacts by matching email addresses and manages EmailThread entities.
/// Runs cross-tenant for background sync (uses IgnoreQueryFilters in the repository layer).
/// </summary>
public class GmailSyncService
{
    private readonly GmailServiceFactory _serviceFactory;
    private readonly IEmailMessageRepository _messageRepository;
    private readonly IEmailAccountRepository _accountRepository;
    private readonly NotificationDispatcher _dispatcher;
    private readonly IFeedRepository _feedRepository;
    private readonly SequenceReplyDetector _replyDetector;
    private readonly ApplicationDbContext _db;
    private readonly IConfiguration _configuration;
    private readonly ILogger<GmailSyncService> _logger;

    public GmailSyncService(
        GmailServiceFactory serviceFactory,
        IEmailMessageRepository messageRepository,
        IEmailAccountRepository accountRepository,
        NotificationDispatcher dispatcher,
        IFeedRepository feedRepository,
        SequenceReplyDetector replyDetector,
        ApplicationDbContext db,
        IConfiguration configuration,
        ILogger<GmailSyncService> logger)
    {
        _serviceFactory = serviceFactory;
        _messageRepository = messageRepository;
        _accountRepository = accountRepository;
        _dispatcher = dispatcher;
        _feedRepository = feedRepository;
        _replyDetector = replyDetector;
        _db = db;
        _configuration = configuration;
        _logger = logger;
    }

    /// <summary>
    /// Syncs all active email accounts across all tenants.
    /// Called by the background sync service on a timer.
    /// Stagger accounts to avoid Gmail API quota spikes.
    /// </summary>
    public async Task SyncAllAccountsAsync(CancellationToken ct)
    {
        var accounts = await _accountRepository.GetAllActiveAccountsAsync();
        _logger.LogInformation("Starting sync for {Count} active email accounts", accounts.Count);

        foreach (var account in accounts)
        {
            if (ct.IsCancellationRequested) break;

            try
            {
                await SyncAccountAsync(account, ct);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to sync email account {AccountId} ({Email})",
                    account.Id, account.GmailAddress);

                account.SyncStatus = EmailSyncStatus.Error;
                account.ErrorMessage = ex.Message;
                await _accountRepository.UpdateAsync(account);
            }

            // Stagger accounts to avoid quota spikes (100ms between accounts)
            await Task.Delay(100, ct);
        }
    }

    /// <summary>
    /// Syncs a single email account. Determines whether to do initial or incremental sync
    /// based on whether LastHistoryId is set.
    /// </summary>
    public async Task SyncAccountAsync(EmailAccount account, CancellationToken ct)
    {
        _logger.LogDebug("Syncing email account {AccountId} ({Email})",
            account.Id, account.GmailAddress);

        var gmail = await _serviceFactory.CreateForAccountAsync(account);

        if (account.LastHistoryId == null)
        {
            await InitialSyncAsync(account, gmail, ct);
        }
        else
        {
            await IncrementalSyncAsync(account, gmail, ct);
        }

        account.LastSyncAt = DateTimeOffset.UtcNow;
        account.SyncStatus = EmailSyncStatus.Active;
        account.ErrorMessage = null;
        await _accountRepository.UpdateAsync(account);
    }

    /// <summary>
    /// Performs initial sync: lists messages from the last N days (configurable),
    /// syncs each message, and stores the latest historyId for future incremental syncs.
    /// </summary>
    private async Task InitialSyncAsync(EmailAccount account, GmailService gmail, CancellationToken ct)
    {
        var initialSyncDays = _configuration.GetValue("Gmail:InitialSyncDays", 30);
        var maxMessages = _configuration.GetValue("Gmail:MaxMessagesPerSync", 500);
        var afterEpoch = DateTimeOffset.UtcNow.AddDays(-initialSyncDays).ToUnixTimeSeconds();

        _logger.LogInformation("Starting initial sync for {Email} (last {Days} days)",
            account.GmailAddress, initialSyncDays);

        var request = gmail.Users.Messages.List("me");
        request.Q = $"after:{afterEpoch}";
        request.MaxResults = Math.Min(maxMessages, 500);

        int syncedCount = 0;

        do
        {
            if (ct.IsCancellationRequested) break;

            var response = await request.ExecuteAsync(ct);
            if (response.Messages == null) break;

            foreach (var messageRef in response.Messages)
            {
                if (ct.IsCancellationRequested) break;
                if (syncedCount >= maxMessages) break;

                await SyncSingleMessageAsync(gmail, messageRef.Id, account.TenantId, account.Id, ct);
                syncedCount++;
            }

            request.PageToken = response.NextPageToken;
        }
        while (!string.IsNullOrEmpty(request.PageToken) && syncedCount < maxMessages);

        // Get latest historyId from profile for future incremental syncs
        var profile = await gmail.Users.GetProfile("me").ExecuteAsync(ct);
        account.LastHistoryId = profile.HistoryId;

        _logger.LogInformation("Initial sync complete for {Email}: {Count} messages synced, historyId={HistoryId}",
            account.GmailAddress, syncedCount, profile.HistoryId);
    }

    /// <summary>
    /// Performs incremental sync using Gmail history.list API.
    /// Only processes newly added messages since the last sync.
    /// Falls back to initial sync if historyId has expired (404 response).
    /// </summary>
    private async Task IncrementalSyncAsync(EmailAccount account, GmailService gmail, CancellationToken ct)
    {
        _logger.LogDebug("Starting incremental sync for {Email} from historyId={HistoryId}",
            account.GmailAddress, account.LastHistoryId);

        try
        {
            var request = gmail.Users.History.List("me");
            request.StartHistoryId = account.LastHistoryId;
            request.HistoryTypes = UsersResource.HistoryResource.ListRequest.HistoryTypesEnum.MessageAdded;

            int syncedCount = 0;
            string? nextPageToken = null;

            do
            {
                if (ct.IsCancellationRequested) break;

                request.PageToken = nextPageToken;
                var response = await request.ExecuteAsync(ct);

                if (response.History != null)
                {
                    foreach (var historyRecord in response.History)
                    {
                        if (historyRecord.MessagesAdded == null) continue;

                        foreach (var added in historyRecord.MessagesAdded)
                        {
                            if (ct.IsCancellationRequested) break;
                            await SyncSingleMessageAsync(gmail, added.Message.Id, account.TenantId, account.Id, ct);
                            syncedCount++;
                        }
                    }
                }

                // Update historyId from response
                if (response.HistoryId.HasValue)
                {
                    account.LastHistoryId = response.HistoryId;
                }

                nextPageToken = response.NextPageToken;
            }
            while (!string.IsNullOrEmpty(nextPageToken));

            _logger.LogDebug("Incremental sync complete for {Email}: {Count} new messages",
                account.GmailAddress, syncedCount);
        }
        catch (Google.GoogleApiException ex) when (ex.HttpStatusCode == System.Net.HttpStatusCode.NotFound)
        {
            // historyId expired -- fall back to full re-sync
            _logger.LogWarning("HistoryId expired for {Email}, falling back to initial sync",
                account.GmailAddress);

            account.LastHistoryId = null;
            await InitialSyncAsync(account, gmail, ct);
        }
    }

    /// <summary>
    /// Syncs a single Gmail message: fetches full message, extracts metadata, parses body,
    /// auto-links to contacts, and manages thread entity.
    /// Idempotent: skips messages that already exist (by Gmail message ID).
    /// </summary>
    private async Task SyncSingleMessageAsync(
        GmailService gmail, string messageId, Guid tenantId, Guid emailAccountId, CancellationToken ct)
    {
        // Deduplication check
        if (await _messageRepository.ExistsByGmailMessageIdAsync(messageId))
            return;

        // Fetch full message from Gmail
        var getRequest = gmail.Users.Messages.Get("me", messageId);
        getRequest.Format = UsersResource.MessagesResource.GetRequest.FormatEnum.Full;
        var gmailMessage = await getRequest.ExecuteAsync(ct);

        // Extract metadata from headers
        var headers = gmailMessage.Payload?.Headers ?? [];
        var subject = GetHeader(headers, "Subject") ?? "(No subject)";
        var from = GetHeader(headers, "From") ?? "";
        var to = GetHeader(headers, "To") ?? "";
        var cc = GetHeader(headers, "Cc");
        var bcc = GetHeader(headers, "Bcc");
        var dateStr = GetHeader(headers, "Date");

        // Parse From header for address and display name
        var (fromAddress, fromName) = ParseEmailAddress(from);

        // Parse body: look for text/html and text/plain in payload (handle multipart)
        var (htmlBody, textBody) = ExtractBody(gmailMessage.Payload);

        // Parse sent date
        var sentAt = DateTimeOffset.UtcNow;
        if (!string.IsNullOrEmpty(dateStr))
        {
            if (DateTimeOffset.TryParse(dateStr, out var parsed))
                sentAt = parsed;
        }

        // Parse labels for read/starred status
        var labels = gmailMessage.LabelIds ?? [];
        var isRead = !labels.Contains("UNREAD");
        var isStarred = labels.Contains("STARRED");
        var hasAttachments = gmailMessage.Payload?.Parts?.Any(p =>
            !string.IsNullOrEmpty(p.Filename) && p.Body?.AttachmentId != null) ?? false;

        // Parse recipient addresses to JSON arrays
        var toAddresses = ParseAddressList(to);
        var ccAddresses = !string.IsNullOrEmpty(cc) ? ParseAddressList(cc) : null;
        var bccAddresses = !string.IsNullOrEmpty(bcc) ? ParseAddressList(bcc) : null;

        // Determine inbound/outbound by comparing sender to account address
        var account = await _db.EmailAccounts.FindAsync([emailAccountId], ct);
        var isInbound = account != null &&
            !fromAddress.Equals(account.GmailAddress, StringComparison.OrdinalIgnoreCase);

        // Create body preview from plain text (first 200 chars)
        string? bodyPreview = null;
        if (!string.IsNullOrEmpty(textBody))
        {
            bodyPreview = textBody.Length > 200 ? textBody[..200] : textBody;
        }
        else if (!string.IsNullOrEmpty(htmlBody))
        {
            // Strip HTML tags for preview
            var stripped = System.Text.RegularExpressions.Regex.Replace(htmlBody, "<[^>]+>", "");
            stripped = System.Net.WebUtility.HtmlDecode(stripped).Trim();
            bodyPreview = stripped.Length > 200 ? stripped[..200] : stripped;
        }

        // Build email message entity
        var emailMessage = new EmailMessage
        {
            TenantId = tenantId,
            EmailAccountId = emailAccountId,
            GmailMessageId = gmailMessage.Id,
            GmailThreadId = gmailMessage.ThreadId,
            Subject = subject,
            FromAddress = fromAddress,
            FromName = fromName,
            ToAddresses = toAddresses,
            CcAddresses = ccAddresses,
            BccAddresses = bccAddresses,
            BodyPreview = bodyPreview,
            BodyHtml = htmlBody,
            BodyText = textBody,
            HasAttachments = hasAttachments,
            IsInbound = isInbound,
            IsRead = isRead,
            IsStarred = isStarred,
            SentAt = sentAt,
            SyncedAt = DateTimeOffset.UtcNow
        };

        // Contact auto-linking: collect all participant email addresses
        var participantEmails = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { fromAddress };
        AddAddressesFromJson(participantEmails, toAddresses);
        if (ccAddresses != null) AddAddressesFromJson(participantEmails, ccAddresses);

        // Find matching contact by email (case-insensitive)
        var matchingContact = await _db.Contacts
            .Where(c => c.TenantId == tenantId && c.Email != null && participantEmails.Contains(c.Email))
            .Select(c => new { c.Id, c.CompanyId })
            .FirstOrDefaultAsync(ct);

        if (matchingContact != null)
        {
            emailMessage.LinkedContactId = matchingContact.Id;
            if (matchingContact.CompanyId.HasValue)
            {
                emailMessage.LinkedCompanyId = matchingContact.CompanyId;
            }
        }

        // Thread management: get-or-create EmailThread and update metadata
        var thread = await _messageRepository.GetThreadAsync(gmailMessage.ThreadId);
        thread.TenantId = tenantId;
        thread.Subject = thread.MessageCount == 0 ? subject : thread.Subject;
        thread.Snippet = bodyPreview;
        thread.MessageCount++;
        thread.LastMessageAt = sentAt;

        // Propagate contact/company linking to thread
        if (matchingContact != null)
        {
            thread.LinkedContactId ??= matchingContact.Id;
            thread.LinkedCompanyId ??= matchingContact.CompanyId;
        }

        await _messageRepository.UpdateThreadAsync(thread);

        // Save message
        await _messageRepository.CreateAsync(emailMessage);

        // Check for sequence replies on inbound messages (auto-unenroll on reply)
        if (isInbound)
        {
            try
            {
                await _replyDetector.CheckForSequenceReplyAsync(emailMessage);
            }
            catch (Exception ex)
            {
                // Reply detection failure must not break email sync
                _logger.LogError(ex,
                    "Failed to check for sequence reply on message {MessageId}",
                    emailMessage.GmailMessageId);
            }
        }

        // Dispatch notification and feed event for new inbound emails only
        if (isInbound && account != null)
        {
            try
            {
                await _dispatcher.DispatchAsync(new NotificationRequest
                {
                    RecipientId = account.UserId,
                    Type = NotificationType.EmailReceived,
                    Title = "New Email Received",
                    Message = $"New email from {fromName}: {subject}",
                    EntityType = "Email",
                    EntityId = emailMessage.Id,
                    CreatedById = null
                }, tenantId);

                var feedItem = new FeedItem
                {
                    TenantId = tenantId,
                    Type = FeedItemType.SystemEvent,
                    Content = $"New email received from {(string.IsNullOrEmpty(fromName) ? fromAddress : fromName)}",
                    EntityType = "Email",
                    EntityId = emailMessage.Id,
                    EntityName = string.IsNullOrEmpty(fromName) ? fromAddress : fromName,
                    AuthorId = account.UserId
                };
                await _feedRepository.CreateFeedItemAsync(feedItem);
                await _dispatcher.DispatchToTenantFeedAsync(tenantId, new { feedItem.Id, feedItem.Content, feedItem.EntityType, feedItem.EntityId });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to dispatch notification for inbound email {EmailId}", emailMessage.Id);
            }
        }
    }

    // --- Helper methods ---

    private static string? GetHeader(IList<MessagePartHeader> headers, string name)
    {
        return headers.FirstOrDefault(h =>
            h.Name.Equals(name, StringComparison.OrdinalIgnoreCase))?.Value;
    }

    /// <summary>
    /// Parses an email From header like "John Doe <john@example.com>" into (address, name).
    /// </summary>
    private static (string address, string name) ParseEmailAddress(string fromHeader)
    {
        if (string.IsNullOrEmpty(fromHeader))
            return (string.Empty, string.Empty);

        var trimmed = fromHeader.Trim();

        // Format: "Display Name <email@example.com>"
        var angleStart = trimmed.LastIndexOf('<');
        var angleEnd = trimmed.LastIndexOf('>');

        if (angleStart >= 0 && angleEnd > angleStart)
        {
            var address = trimmed[(angleStart + 1)..angleEnd].Trim();
            var name = trimmed[..angleStart].Trim().Trim('"');
            return (address, name);
        }

        // Plain email address
        return (trimmed, string.Empty);
    }

    /// <summary>
    /// Extracts HTML and plain text body from a Gmail message payload, handling multipart recursion.
    /// </summary>
    private static (string? html, string? text) ExtractBody(MessagePart? payload)
    {
        if (payload == null) return (null, null);

        string? html = null;
        string? text = null;

        if (payload.MimeType == "text/html" && payload.Body?.Data != null)
        {
            html = DecodeBase64Url(payload.Body.Data);
        }
        else if (payload.MimeType == "text/plain" && payload.Body?.Data != null)
        {
            text = DecodeBase64Url(payload.Body.Data);
        }

        if (payload.Parts != null)
        {
            foreach (var part in payload.Parts)
            {
                var (partHtml, partText) = ExtractBody(part);
                html ??= partHtml;
                text ??= partText;

                if (html != null && text != null) break;
            }
        }

        return (html, text);
    }

    /// <summary>
    /// Decodes a base64url-encoded string (used by Gmail API for message body data).
    /// </summary>
    private static string DecodeBase64Url(string base64Url)
    {
        var base64 = base64Url.Replace('-', '+').Replace('_', '/');
        switch (base64.Length % 4)
        {
            case 2: base64 += "=="; break;
            case 3: base64 += "="; break;
        }
        var bytes = Convert.FromBase64String(base64);
        return Encoding.UTF8.GetString(bytes);
    }

    /// <summary>
    /// Parses a comma-separated address list into a JSON array of email addresses.
    /// </summary>
    private static string ParseAddressList(string addressList)
    {
        var addresses = addressList
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(a => ParseEmailAddress(a).address)
            .Where(a => !string.IsNullOrEmpty(a))
            .ToList();

        return JsonSerializer.Serialize(addresses);
    }

    /// <summary>
    /// Adds email addresses from a JSON array string to the given set.
    /// </summary>
    private static void AddAddressesFromJson(HashSet<string> set, string jsonArray)
    {
        try
        {
            var addresses = JsonSerializer.Deserialize<List<string>>(jsonArray);
            if (addresses != null)
            {
                foreach (var addr in addresses)
                {
                    if (!string.IsNullOrEmpty(addr))
                        set.Add(addr);
                }
            }
        }
        catch
        {
            // Invalid JSON -- ignore
        }
    }
}

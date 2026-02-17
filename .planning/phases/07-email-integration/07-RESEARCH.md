# Phase 7: Email Integration - Research

**Researched:** 2026-02-17
**Domain:** Gmail API integration, OAuth 2.0, bidirectional email sync, email threading
**Confidence:** MEDIUM

## Summary

Phase 7 adds two-way Gmail email sync to GlobCRM via Google's Gmail API v1. Users connect their Gmail account through OAuth 2.0, and the system syncs emails bidirectionally: received emails appear in the CRM linked to contacts/companies, and emails composed in the CRM are sent through Gmail. The implementation requires four backend subsystems (OAuth flow, token management, sync engine, send pipeline) and three frontend feature areas (account connection, email list/detail views, compose dialog).

The core technical challenge is the sync engine. Gmail provides `history.list` for incremental sync (tracking changes since a `historyId`) and optionally Cloud Pub/Sub push notifications for real-time triggers. For a CRM product, periodic polling via a background service (`BackgroundService`) is simpler and sufficient -- push notifications add infrastructure complexity (Cloud Pub/Sub topic, subscription, webhook endpoint) that can be deferred. The auto-linking of emails to contacts is a database join on normalized email addresses.

**Primary recommendation:** Use `Google.Apis.Gmail.v1` NuGet package with `MimeKit` for MIME construction. Store OAuth tokens encrypted in PostgreSQL per-user. Implement sync as an ASP.NET Core `BackgroundService` polling `history.list` every 5 minutes. Use `gmail.modify` scope for full read/write access. Build emails tab into existing Contact/Company detail pages and add a standalone email list feature page.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Google.Apis.Gmail.v1 | 1.73.x | Gmail API client for .NET | Official Google client library; handles REST calls, pagination, retry |
| Google.Apis.Auth | 1.73.x | OAuth 2.0 auth code flow | Official Google auth library; handles token exchange, refresh |
| MimeKit | 4.x | MIME message construction/parsing | Industry standard .NET MIME library; required for Gmail raw message format |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Microsoft.AspNetCore.DataProtection | 10.0.x | Encrypt OAuth tokens at rest | Already in ASP.NET Core; use IDataProtector for token encryption |
| System.Text.Json | (built-in) | Serialize email metadata | Already used project-wide for JSONB columns |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Google.Apis.Gmail.v1 | MailKit IMAP/SMTP | MailKit uses IMAP/SMTP which Gmail is deprecating for OAuth apps; Gmail API gives richer threading, labels, history sync |
| Polling BackgroundService | Cloud Pub/Sub push notifications | Push is real-time but requires GCP Pub/Sub infrastructure, topic management, webhook endpoint; polling every 5 min is simpler and sufficient for CRM |
| MimeKit | System.Net.Mail | System.Net.Mail lacks RFC 2822 compliance for threading headers; MimeKit is the standard |
| DataProtection API | AES encryption manually | DataProtection handles key rotation, storage automatically; manual AES is error-prone |

**Installation:**
```bash
# In GlobCRM.Infrastructure project:
dotnet add src/GlobCRM.Infrastructure/GlobCRM.Infrastructure.csproj package Google.Apis.Gmail.v1
dotnet add src/GlobCRM.Infrastructure/GlobCRM.Infrastructure.csproj package MimeKit
# Google.Apis.Auth comes as transitive dependency of Google.Apis.Gmail.v1
# DataProtection is already part of ASP.NET Core framework reference
```

## Architecture Patterns

### Recommended Project Structure

**Backend (following existing subsystem pattern):**
```
src/GlobCRM.Domain/
├── Entities/
│   ├── EmailAccount.cs          # OAuth connection per user
│   ├── EmailMessage.cs          # Synced email message
│   └── EmailThread.cs           # Thread grouping
├── Enums/
│   └── EmailSyncStatus.cs       # SyncStatus enum
└── Interfaces/
    ├── IEmailAccountRepository.cs
    └── IEmailMessageRepository.cs

src/GlobCRM.Infrastructure/
├── Gmail/
│   ├── GmailServiceFactory.cs   # Creates authenticated GmailService per user
│   ├── GmailSyncService.cs      # Core sync logic (full + incremental)
│   ├── GmailSendService.cs      # Send email via Gmail API
│   ├── GmailOAuthService.cs     # OAuth flow (auth URL, token exchange)
│   ├── EmailSyncBackgroundService.cs  # BackgroundService polling loop
│   └── GmailServiceExtensions.cs      # DI registration
├── Persistence/
│   ├── Configurations/
│   │   ├── EmailAccountConfiguration.cs
│   │   ├── EmailMessageConfiguration.cs
│   │   └── EmailThreadConfiguration.cs
│   └── Repositories/
│       ├── EmailAccountRepository.cs
│       └── EmailMessageRepository.cs

src/GlobCRM.Api/
└── Controllers/
    ├── EmailAccountsController.cs   # OAuth flow endpoints
    └── EmailsController.cs          # Email CRUD, send, thread view
```

**Frontend (following existing feature pattern):**
```
globcrm-web/src/app/features/
└── emails/
    ├── email.models.ts           # DTOs for email messages, threads, accounts
    ├── email.service.ts          # API service (CRUD, send, connect)
    ├── email.store.ts            # Signal store for email list state
    ├── email-list/
    │   └── email-list.component.ts    # Email inbox with DynamicTable
    ├── email-detail/
    │   └── email-detail.component.ts  # Thread view with message chain
    └── email-compose/
        └── email-compose.component.ts # MatDialog compose form

globcrm-web/src/app/features/settings/
└── email-accounts/
    └── email-account-settings.component.ts  # Connect/disconnect Gmail
```

### Pattern 1: OAuth 2.0 Authorization Code Flow
**What:** Server-side OAuth where the frontend redirects to Google consent, Google redirects back with an auth code, and the backend exchanges it for access + refresh tokens.
**When to use:** Always -- this is the only supported flow for server-side Gmail access.
**Flow:**
```
1. Frontend: GET /api/email-accounts/connect → backend returns Google OAuth URL
2. Browser: User consents at Google → Google redirects to /api/email-accounts/callback?code=XXX
3. Backend: Exchanges code for access_token + refresh_token
4. Backend: Encrypts tokens, stores in email_accounts table
5. Backend: Redirects browser back to Angular email settings page
```

**Example:**
```csharp
// GmailOAuthService.cs
public class GmailOAuthService
{
    private readonly IConfiguration _config;

    public string GetAuthorizationUrl(string state)
    {
        return new GoogleAuthorizationCodeRequestUrl(new Uri("https://accounts.google.com/o/oauth2/v2/auth"))
        {
            ClientId = _config["Gmail:ClientId"],
            RedirectUri = _config["Gmail:RedirectUri"],
            Scope = "https://www.googleapis.com/auth/gmail.modify",
            ResponseType = "code",
            State = state,
            AccessType = "offline",   // Required for refresh token
            Prompt = "consent"         // Force consent to always get refresh token
        }.Build().ToString();
    }

    public async Task<TokenResponse> ExchangeCodeAsync(string authCode)
    {
        var flow = new GoogleAuthorizationCodeFlow(new GoogleAuthorizationCodeFlow.Initializer
        {
            ClientSecrets = new ClientSecrets
            {
                ClientId = _config["Gmail:ClientId"],
                ClientSecret = _config["Gmail:ClientSecret"]
            },
            Scopes = new[] { "https://www.googleapis.com/auth/gmail.modify" }
        });
        return await flow.ExchangeCodeForTokenAsync("user", authCode, _config["Gmail:RedirectUri"], CancellationToken.None);
    }
}
```

### Pattern 2: Encrypted Token Storage
**What:** OAuth tokens encrypted at rest using ASP.NET Core Data Protection before storing in PostgreSQL.
**When to use:** Always -- tokens are sensitive credentials granting Gmail access.
**Example:**
```csharp
// Token encryption/decryption using IDataProtector
public class TokenEncryptionService
{
    private readonly IDataProtector _protector;

    public TokenEncryptionService(IDataProtectionProvider provider)
    {
        _protector = provider.CreateProtector("GlobCRM.Gmail.Tokens");
    }

    public string Encrypt(string token) => _protector.Protect(token);
    public string Decrypt(string encryptedToken) => _protector.Unprotect(encryptedToken);
}
```

### Pattern 3: Incremental Sync with History API
**What:** After initial full sync, use `history.list` with stored `historyId` to fetch only new changes.
**When to use:** Every sync cycle after initial import.
**Example:**
```csharp
// GmailSyncService.cs - Incremental sync
public async Task IncrementalSyncAsync(EmailAccount account, GmailService gmail)
{
    var historyRequest = gmail.Users.History.List("me");
    historyRequest.StartHistoryId = account.LastHistoryId;
    historyRequest.HistoryTypes = UsersResource.HistoryResource.ListRequest.HistoryTypesEnum.MessageAdded;

    var history = await historyRequest.ExecuteAsync();
    if (history.History == null) return; // No changes

    foreach (var record in history.History)
    {
        foreach (var added in record.MessagesAdded ?? Enumerable.Empty<HistoryMessageAdded>())
        {
            await SyncSingleMessageAsync(gmail, added.Message.Id, account.TenantId, account.UserId);
        }
    }

    account.LastHistoryId = history.HistoryId ?? account.LastHistoryId;
}
```

### Pattern 4: Contact Auto-Linking by Email Address
**What:** When syncing an email, extract all participant email addresses and match against Contact.Email to create automatic links.
**When to use:** On every synced message.
**Example:**
```csharp
// Extract email addresses from message headers, match against contacts table
var participantEmails = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
participantEmails.Add(fromAddress);
participantEmails.UnionWith(toAddresses);
participantEmails.UnionWith(ccAddresses);

var linkedContacts = await _db.Contacts
    .Where(c => c.Email != null && participantEmails.Contains(c.Email.ToLower()))
    .Select(c => new { c.Id, c.CompanyId })
    .ToListAsync();
```

### Anti-Patterns to Avoid
- **Full sync on every cycle:** Never re-fetch all messages; always use historyId for incremental sync after initial import
- **Storing raw tokens unencrypted:** OAuth tokens grant full email access; always encrypt at rest
- **Syncing all labels/folders:** Only sync INBOX, SENT, and optionally user-selected labels; syncing SPAM/TRASH wastes quota and storage
- **Blocking API calls in request pipeline:** Email sync must run in background service, not in HTTP request handlers
- **Ignoring token refresh failures:** If refresh token is revoked, mark account as disconnected and prompt re-auth

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| MIME message construction | String concatenation of headers/body | MimeKit MimeMessage | RFC 2822 compliance, multipart handling, header encoding |
| OAuth token exchange | Manual HTTP calls to Google endpoints | Google.Apis.Auth AuthorizationCodeFlow | Handles PKCE, token refresh, error codes correctly |
| Email threading | Custom thread detection from subjects | Gmail API threadId field | Gmail already groups messages into threads; use their IDs |
| Token encryption | AES/RSA manual crypto | ASP.NET Core DataProtection IDataProtector | Handles key rotation, storage, algorithm selection |
| Base64url encoding | Custom encoder | Google.Apis.Gmail uses it internally / Convert + Replace | Base64url is not Base64; +/= characters differ |

**Key insight:** Gmail's API already solves the hardest problems (threading, search, label management). The CRM's job is to store synced data, link it to contacts, and provide a clean UI -- not to replicate Gmail's core logic.

## Common Pitfalls

### Pitfall 1: Missing Refresh Token on Re-authorization
**What goes wrong:** After initial OAuth consent, Google only returns a refresh_token on the FIRST authorization. If the user disconnects and reconnects, no refresh_token is returned, making background sync impossible.
**Why it happens:** Google only sends refresh_token when `prompt=consent` AND `access_type=offline` are both set, and only for the first consent grant.
**How to avoid:** Always include `prompt=consent` and `access_type=offline` in the authorization URL. Before re-auth, revoke the existing token so Google treats it as a fresh consent.
**Warning signs:** Sync works initially but fails after user reconnects their account.

### Pitfall 2: Expired historyId Causes 404
**What goes wrong:** `history.list` returns HTTP 404 when the stored `historyId` is too old (Gmail retains history records for approximately one week minimum).
**Why it happens:** If the sync service is down or an account hasn't synced for >1 week, the historyId expires.
**How to avoid:** Catch 404 on `history.list` and fall back to a full re-sync. Store a `lastSyncAt` timestamp and trigger full sync if gap exceeds 5 days.
**Warning signs:** 404 errors from Gmail API in sync service logs.

### Pitfall 3: Gmail API Quota Exhaustion
**What goes wrong:** API returns 429 (rate limit exceeded) when syncing many accounts simultaneously.
**Why it happens:** Per-user limit is 15,000 quota units/minute. `messages.get` costs 5 units each. Syncing 3,000 messages for one user in one cycle would hit the limit.
**How to avoid:** Batch API calls (max 100 per batch). Implement exponential backoff on 429. Stagger sync cycles across users. For initial sync, limit to recent N messages (e.g., last 30 days).
**Warning signs:** Intermittent sync failures, 429 responses in logs.

### Pitfall 4: Multi-Tenant Token Isolation
**What goes wrong:** Email tokens from one tenant used to access another tenant's sync.
**Why it happens:** EmailAccount must be tenant-scoped but the background sync service processes all tenants.
**How to avoid:** EmailAccount entity has TenantId with global query filter (matching existing pattern). Background service explicitly sets tenant context per account when syncing. Token encryption uses tenant-scoped purpose string.
**Warning signs:** Emails appearing in wrong tenant's CRM.

### Pitfall 5: Duplicate Messages on Re-sync
**What goes wrong:** Same email appears multiple times in CRM after full re-sync or parallel sync executions.
**Why it happens:** No unique constraint on Gmail message ID, or sync doesn't check for existing records.
**How to avoid:** Store Gmail message ID (`gmailMessageId`) with a unique composite index on `(tenant_id, gmail_message_id)`. Use upsert pattern on sync.
**Warning signs:** Duplicate entries in email lists, inflated timeline events.

### Pitfall 6: DataProtection Key Rotation Breaks Token Decryption
**What goes wrong:** After key rotation (default 90 days), older encrypted tokens can't be decrypted if old keys were purged.
**Why it happens:** DataProtection automatically rotates keys but keeps old keys for decryption. If old keys are manually deleted or storage is reset, decryption fails.
**How to avoid:** Never manually delete DataProtection keys. For production, configure persistent key storage (file system or database). In development, local key ring is fine.
**Warning signs:** Sudden "Unable to unprotect the message" exceptions for all users.

## Code Examples

### Gmail Service Factory (Creating Authenticated Client per User)
```csharp
// Source: Google.Apis.Gmail.v1 documentation pattern
public class GmailServiceFactory
{
    private readonly IConfiguration _config;
    private readonly TokenEncryptionService _tokenEncryption;

    public async Task<GmailService> CreateForUserAsync(EmailAccount account)
    {
        var tokenResponse = new TokenResponse
        {
            AccessToken = _tokenEncryption.Decrypt(account.EncryptedAccessToken),
            RefreshToken = _tokenEncryption.Decrypt(account.EncryptedRefreshToken),
            ExpiresInSeconds = 3600,
            IssuedUtc = account.TokenIssuedAt.UtcDateTime
        };

        var flow = new GoogleAuthorizationCodeFlow(new GoogleAuthorizationCodeFlow.Initializer
        {
            ClientSecrets = new ClientSecrets
            {
                ClientId = _config["Gmail:ClientId"],
                ClientSecret = _config["Gmail:ClientSecret"]
            },
            Scopes = new[] { GmailService.Scope.GmailModify }
        });

        var credential = new UserCredential(flow, account.GmailAddress, tokenResponse);

        return new GmailService(new BaseClientService.Initializer
        {
            HttpClientInitializer = credential,
            ApplicationName = "GlobCRM"
        });
    }
}
```

### Sending Email via Gmail API with MimeKit
```csharp
// Source: Gmail API sending docs + MimeKit pattern
public async Task<string> SendEmailAsync(GmailService gmail, string from, string to, string subject, string htmlBody, string? threadId = null)
{
    var message = new MimeMessage();
    message.From.Add(MailboxAddress.Parse(from));
    message.To.Add(MailboxAddress.Parse(to));
    message.Subject = subject;
    message.Body = new TextPart("html") { Text = htmlBody };

    // If replying to a thread, set In-Reply-To and References headers
    if (threadId != null)
    {
        // Fetch thread to get Message-ID of last message
        // Set headers for proper threading
    }

    using var stream = new MemoryStream();
    await message.WriteToAsync(stream);
    var raw = Convert.ToBase64String(stream.ToArray())
        .Replace('+', '-')
        .Replace('/', '_')
        .Replace("=", "");

    var gmailMessage = new Google.Apis.Gmail.v1.Data.Message { Raw = raw };
    if (threadId != null)
        gmailMessage.ThreadId = threadId;

    var sent = await gmail.Users.Messages.Send(gmailMessage, "me").ExecuteAsync();
    return sent.Id;
}
```

### Background Sync Service
```csharp
// Source: ASP.NET Core BackgroundService pattern
public class EmailSyncBackgroundService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<EmailSyncBackgroundService> _logger;
    private static readonly TimeSpan SyncInterval = TimeSpan.FromMinutes(5);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var syncService = scope.ServiceProvider.GetRequiredService<GmailSyncService>();
                await syncService.SyncAllAccountsAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Email sync cycle failed");
            }

            await Task.Delay(SyncInterval, stoppingToken);
        }
    }
}
```

### Email Message Entity (Domain Model)
```csharp
public class EmailMessage
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }

    // Gmail identifiers
    public string GmailMessageId { get; set; } = string.Empty;
    public string GmailThreadId { get; set; } = string.Empty;

    // Email metadata
    public string Subject { get; set; } = string.Empty;
    public string FromAddress { get; set; } = string.Empty;
    public string FromName { get; set; } = string.Empty;
    public string ToAddresses { get; set; } = string.Empty;   // JSON array
    public string? CcAddresses { get; set; }                    // JSON array
    public string? BccAddresses { get; set; }                   // JSON array
    public string? BodyPreview { get; set; }                    // First ~200 chars
    public string? BodyHtml { get; set; }
    public string? BodyText { get; set; }
    public bool HasAttachments { get; set; }

    // Direction and status
    public bool IsInbound { get; set; }    // true = received, false = sent
    public bool IsRead { get; set; }
    public bool IsStarred { get; set; }

    // Contact/Company linking
    public Guid? LinkedContactId { get; set; }
    public Contact? LinkedContact { get; set; }
    public Guid? LinkedCompanyId { get; set; }
    public Company? LinkedCompany { get; set; }

    // Ownership (user who owns this synced email)
    public Guid EmailAccountId { get; set; }
    public EmailAccount EmailAccount { get; set; } = null!;

    // Timestamps
    public DateTimeOffset SentAt { get; set; }
    public DateTimeOffset SyncedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| IMAP/SMTP with Gmail | Gmail REST API v1 with OAuth 2.0 | 2024 (Google deprecated basic auth) | Must use Gmail API; IMAP with app passwords no longer recommended |
| Polling only for sync | history.list incremental + optional Pub/Sub push | Available since 2015, now mature | Incremental sync is efficient; push is optional for CRM |
| Store all email bodies locally | Store metadata + preview, fetch full body on demand | Common CRM pattern | Reduces storage; full body fetched when user opens email |

**Deprecated/outdated:**
- Basic auth (username/password) for Gmail: Disabled by Google as of September 2024
- Less Secure Apps (LSA) access: Fully deprecated
- SMTP relay without OAuth: Requires OAuth XOAUTH2 SASL mechanism now

## Open Questions

1. **Initial sync depth**
   - What we know: Full sync of entire mailbox is impractical (could be 100K+ messages)
   - What's unclear: How far back to sync on initial connection (30 days? 90 days? 500 messages?)
   - Recommendation: Default to last 30 days (configurable). User can manually trigger deeper sync.

2. **Email body storage strategy**
   - What we know: Storing full HTML bodies for all emails uses significant disk/DB space
   - What's unclear: Whether to store full body or fetch on demand from Gmail API
   - Recommendation: Store body preview (200 chars) + full body HTML on sync. This avoids extra API calls when viewing emails and keeps offline access possible. Revisit if storage becomes an issue.

3. **Attachment handling**
   - What we know: Gmail API can fetch attachments; CRM already has IFileStorageService
   - What's unclear: Whether to download and store attachments locally or stream from Gmail on demand
   - Recommendation: Phase 7 scope: store attachment metadata only (name, size, mimeType). Provide download link that proxies through backend to Gmail API. Full attachment storage deferred.

4. **Multiple Gmail accounts per user**
   - What we know: Some users have multiple Gmail accounts (personal + work)
   - What's unclear: Whether to support multiple connected accounts per CRM user
   - Recommendation: Support one Gmail account per user in v1. The schema should not prevent multiple accounts, but UI and sync logic assume one active connection.

5. **Cloud Pub/Sub for real-time sync**
   - What we know: Gmail supports push notifications via Cloud Pub/Sub for near-real-time sync
   - What's unclear: Whether the CRM needs real-time email sync or if 5-minute polling suffices
   - Recommendation: Start with polling (BackgroundService every 5 minutes). Pub/Sub can be added in Phase 8 (Real-Time) if needed.

6. **Google Cloud Console project setup**
   - What we know: Need OAuth consent screen, client ID/secret, Gmail API enabled
   - What's unclear: Whether to use test mode (100-user limit, no verification) or go through restricted scope verification
   - Recommendation: Use test mode for development. Document the production verification process (CASA audit required for gmail.modify scope) but defer actual verification.

## Database Schema Design

### Key Tables

**email_accounts** (per-user Gmail connection):
```
id (PK), tenant_id, user_id (FK), gmail_address, encrypted_access_token,
encrypted_refresh_token, token_issued_at, token_expires_at, last_history_id,
last_sync_at, sync_status (active/paused/error/disconnected), error_message,
created_at, updated_at
```

**email_messages** (synced messages):
```
id (PK), tenant_id, email_account_id (FK), gmail_message_id (unique per tenant),
gmail_thread_id, subject, from_address, from_name, to_addresses (jsonb),
cc_addresses (jsonb), body_preview, body_html, body_text, has_attachments,
is_inbound, is_read, is_starred, linked_contact_id (FK nullable),
linked_company_id (FK nullable), sent_at, synced_at, created_at, updated_at
```

**email_threads** (thread grouping):
```
id (PK), tenant_id, gmail_thread_id, subject, snippet, message_count,
last_message_at, linked_contact_id (FK nullable), linked_company_id (FK nullable),
created_at, updated_at
```

### Key Indexes
- `idx_email_messages_tenant_gmail_id` UNIQUE on (tenant_id, gmail_message_id) -- prevent duplicates
- `idx_email_messages_thread` on (gmail_thread_id) -- fast thread lookups
- `idx_email_messages_contact` on (linked_contact_id) -- contact detail emails tab
- `idx_email_messages_company` on (linked_company_id) -- company detail emails tab
- `idx_email_messages_sent_at` on (tenant_id, sent_at DESC) -- chronological listing
- `idx_email_accounts_user` on (tenant_id, user_id) -- one account per user lookup

### RLS Policy
EmailAccount and EmailMessage are tenant-scoped (TenantId column + global query filter + RLS), following the existing triple-layer defense pattern. EmailThread is also tenant-scoped. Child entities of EmailMessage (future: EmailAttachment) inherit tenant isolation via FK.

## Gmail API Quota Planning

| Operation | Quota Cost | Frequency | Daily Budget (per user) |
|-----------|-----------|-----------|------------------------|
| history.list | 2 units | Every 5 min (288/day) | 576 units |
| messages.get | 5 units | ~20 new msgs/day avg | 100 units |
| messages.send | 100 units | ~10 sends/day avg | 1,000 units |
| threads.get | 10 units | ~5 thread views/day | 50 units |
| **Total estimated** | | | **~1,726 units/day** |

Per-user limit: 15,000 units/minute. Daily estimated usage is well within limits.

## Sources

### Primary (HIGH confidence)
- [Google.Apis.Gmail.v1 NuGet](https://www.nuget.org/packages/Google.Apis.Gmail.v1) - Package version and dependencies verified
- [Gmail API Scopes](https://developers.google.com/workspace/gmail/api/auth/scopes) - Scope classification (sensitive vs restricted)
- [Gmail API Usage Limits](https://developers.google.com/workspace/gmail/api/reference/quota) - Quota unit costs verified
- [Gmail Push Notifications](https://developers.google.com/workspace/gmail/api/guides/push) - Pub/Sub setup and requirements
- [Gmail Threading](https://developers.google.com/workspace/gmail/api/guides/threads) - Thread grouping rules
- [Gmail Sync Guide](https://developers.google.com/workspace/gmail/api/guides/sync) - Full and partial sync patterns
- [Google OAuth 2.0 Web Server](https://developers.google.com/identity/protocols/oauth2/web-server) - Authorization code flow

### Secondary (MEDIUM confidence)
- [ASP.NET Core Data Protection](https://learn.microsoft.com/en-us/aspnet/core/security/data-protection/introduction?view=aspnetcore-10.0) - Token encryption approach
- [Restricted Scope Verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification) - CASA audit requirements for gmail.modify
- Existing codebase patterns (ContactsController, ContactConfiguration, CrmEntityServiceExtensions) - Verified by code inspection

### Tertiary (LOW confidence)
- CRM email integration best practices from community articles - General patterns, not verified against specific implementations

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official Google NuGet packages, well-documented APIs
- Architecture: MEDIUM - Follows existing project patterns closely, but email sync is novel to this codebase; background service pattern needs careful implementation
- Pitfalls: HIGH - Well-documented issues (token refresh, historyId expiry, quota limits) from Google's own docs and community
- Database schema: MEDIUM - Designed to match existing patterns but not battle-tested yet
- Frontend: MEDIUM - Follows existing feature patterns (store/service/component) but email UI is more complex than CRUD pages

**Research date:** 2026-02-17
**Valid until:** 2026-03-17 (Gmail API is stable; Google auth policies may evolve)

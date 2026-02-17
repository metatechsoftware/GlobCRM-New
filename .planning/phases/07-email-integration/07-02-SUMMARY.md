---
phase: 07-email-integration
plan: 02
subsystem: infrastructure
tags: [gmail, oauth, google-apis, mimekit, data-protection, sync, email]

# Dependency graph
requires:
  - phase: 07-email-integration
    plan: 01
    provides: "EmailAccount, EmailMessage, EmailThread entities; IEmailAccountRepository, IEmailMessageRepository interfaces"
  - phase: 01-foundation
    provides: "ApplicationDbContext, DataProtection, DI extension pattern"
provides:
  - "TokenEncryptionService for DataProtection-based OAuth token encryption/decryption"
  - "GmailOAuthService for authorization URL generation, code exchange, and token revocation"
  - "GmailServiceFactory for creating authenticated GmailService instances per user"
  - "GmailSyncService for initial (date-range) and incremental (history.list) email sync with contact auto-linking"
  - "GmailSendService for sending emails via Gmail API with MimeKit MIME construction"
  - "GmailServiceExtensions DI registration for all 5 Gmail services"
  - "Gmail config section in appsettings.json (ClientId, ClientSecret, RedirectUri, SyncInterval, InitialSyncDays)"
affects: [07-03, 07-04, 07-05, 07-06, 07-07]

# Tech tracking
tech-stack:
  added:
    - "Google.Apis.Gmail.v1 1.73.0.4029 (Gmail API client + transitive Google.Apis.Auth)"
    - "MimeKit 4.15.0 (RFC-compliant MIME message construction)"
  patterns:
    - "OAuth token encryption via ASP.NET Core DataProtection with purpose-string isolation"
    - "Gmail sync dual-mode: initial sync (date-range query) + incremental sync (history.list)"
    - "Contact auto-linking: match participant email addresses to CRM contacts during sync/send"
    - "Gmail API message body extraction with multipart recursion and base64url decoding"

key-files:
  created:
    - src/GlobCRM.Infrastructure/Gmail/TokenEncryptionService.cs
    - src/GlobCRM.Infrastructure/Gmail/GmailOAuthService.cs
    - src/GlobCRM.Infrastructure/Gmail/GmailServiceFactory.cs
    - src/GlobCRM.Infrastructure/Gmail/GmailSyncService.cs
    - src/GlobCRM.Infrastructure/Gmail/GmailSendService.cs
    - src/GlobCRM.Infrastructure/Gmail/GmailServiceExtensions.cs
  modified:
    - src/GlobCRM.Infrastructure/GlobCRM.Infrastructure.csproj
    - src/GlobCRM.Api/appsettings.json
    - src/GlobCRM.Api/appsettings.Development.json

key-decisions:
  - "GmailOAuthService uses GoogleAuthorizationCodeFlow.CreateAuthorizationCodeRequest for standards-compliant URL generation (not manual URL string building)"
  - "GmailSyncService uses ApplicationDbContext directly for contact auto-linking queries (simpler than adding methods to IContactRepository for infrastructure-level service)"
  - "GmailSendService uses MimeMessage.WriteToAsync with base64url encoding for Gmail API raw message format"

patterns-established:
  - "Gmail service DI: separate GmailServiceExtensions class following EmailServiceExtensions pattern"
  - "Cross-tenant sync: SyncAllAccountsAsync stagger pattern with Task.Delay between accounts"
  - "HistoryId expiry fallback: 404 from history.list triggers full re-sync via InitialSyncAsync"

# Metrics
duration: 6min
completed: 2026-02-17
---

# Phase 7 Plan 2: Gmail Infrastructure Services Summary

**Gmail OAuth flow, token encryption, bidirectional sync engine (initial + incremental via history.list), and MimeKit-based email sending with contact auto-linking**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-17T15:16:59Z
- **Completed:** 2026-02-17T15:23:11Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- TokenEncryptionService with DataProtection-based encrypt/decrypt and automatic key rotation support
- GmailOAuthService handling authorization URL generation (with prompt=consent + offline access), code exchange, and token revocation
- GmailServiceFactory creating authenticated GmailService instances with auto-refresh via UserCredential
- GmailSyncService with dual-mode sync: initial (date-range query with pagination) and incremental (history.list with MessageAdded filter)
- GmailSendService constructing RFC-compliant MIME messages via MimeKit and sending via Gmail API with thread support
- Contact auto-linking during sync and send by matching participant emails to CRM contacts
- Thread management with get-or-create pattern maintaining message count and last message timestamp
- All 5 services registered via AddGmailServices DI extension method

## Task Commits

Each task was committed atomically:

1. **Task 1: Install NuGet packages and create OAuth + token encryption services** - `5078840` (feat)
2. **Task 2: Create Gmail sync service, send service, and DI extension** - `5c1e608` (feat)

## Files Created/Modified
- `src/GlobCRM.Infrastructure/Gmail/TokenEncryptionService.cs` - DataProtection-based token encryption/decryption with "GlobCRM.Gmail.Tokens" purpose
- `src/GlobCRM.Infrastructure/Gmail/GmailOAuthService.cs` - OAuth 2.0 authorization URL generation, code exchange, and token revocation
- `src/GlobCRM.Infrastructure/Gmail/GmailServiceFactory.cs` - Creates authenticated GmailService per user with auto token refresh
- `src/GlobCRM.Infrastructure/Gmail/GmailSyncService.cs` - Full and incremental Gmail sync with contact auto-linking and thread management
- `src/GlobCRM.Infrastructure/Gmail/GmailSendService.cs` - Email sending via Gmail API with MimeKit MIME construction and thread support
- `src/GlobCRM.Infrastructure/Gmail/GmailServiceExtensions.cs` - DI registration for all 5 Gmail services
- `src/GlobCRM.Infrastructure/GlobCRM.Infrastructure.csproj` - Added Google.Apis.Gmail.v1 and MimeKit package references
- `src/GlobCRM.Api/appsettings.json` - Gmail config section (ClientId, ClientSecret, RedirectUri, SyncInterval, InitialSyncDays, MaxMessages)
- `src/GlobCRM.Api/appsettings.Development.json` - Gmail dev placeholder credentials

## Decisions Made
- GmailOAuthService uses GoogleAuthorizationCodeFlow.CreateAuthorizationCodeRequest for standards-compliant OAuth URL generation -- the plan-specified GoogleAuthorizationCodeRequestUrl class does not exist in Google.Apis.Auth
- GmailSyncService uses ApplicationDbContext directly for contact auto-linking queries rather than adding FindByEmail to IContactRepository -- cleaner for infrastructure-level service that already depends on EF Core
- GmailSendService uses MimeMessage.WriteToAsync with manual base64url encoding for Gmail API's raw message format

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed GoogleAuthorizationCodeRequestUrl reference to GoogleAuthorizationCodeFlow**
- **Found during:** Task 1 (GmailOAuthService)
- **Issue:** Plan specified `GoogleAuthorizationCodeRequestUrl` which does not exist in Google.Apis.Auth namespace
- **Fix:** Used `GoogleAuthorizationCodeFlow.CreateAuthorizationCodeRequest(_redirectUri)` which is the correct API for generating OAuth authorization URLs
- **Files modified:** src/GlobCRM.Infrastructure/Gmail/GmailOAuthService.cs
- **Verification:** Build succeeds, authorization URL correctly includes all required parameters
- **Committed in:** 5078840 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** API class name correction, no behavioral change. Authorization URL generation works identically.

## Issues Encountered
None

## User Setup Required
Google Cloud Console configuration required (documented in plan frontmatter user_setup section):
- Create Google Cloud project and enable Gmail API
- Create OAuth 2.0 Client ID (Web application type)
- Set authorized redirect URI to http://localhost:5233/api/email-accounts/callback
- Configure OAuth consent screen with gmail.modify scope
- Set Gmail:ClientId and Gmail:ClientSecret in appsettings or user secrets

## Next Phase Readiness
- All Gmail infrastructure services ready for Plan 03 (repositories + background sync service)
- GmailServiceExtensions.AddGmailServices() ready to register in Program.cs
- OAuth flow ready for API controller orchestration in Plan 05
- Sync engine ready for background service scheduling in Plan 03

## Self-Check: PASSED

All 6 created files verified on disk. Both task commits (5078840, 5c1e608) verified in git log. Full solution build succeeds with 0 errors.

---
*Phase: 07-email-integration*
*Completed: 2026-02-17*

---
phase: 07-email-integration
plan: 03
subsystem: api
tags: [ef-core, gmail, oauth, background-service, repositories, controllers, email]

# Dependency graph
requires:
  - phase: 07-email-integration
    plan: 01
    provides: "EmailAccount, EmailMessage, EmailThread entities; IEmailAccountRepository, IEmailMessageRepository interfaces"
  - phase: 07-email-integration
    plan: 02
    provides: "GmailOAuthService, TokenEncryptionService, GmailServiceFactory, GmailSyncService, GmailSendService, GmailServiceExtensions"
provides:
  - "EmailAccountRepository implementing IEmailAccountRepository with per-user lookup and cross-tenant active account query"
  - "EmailMessageRepository implementing IEmailMessageRepository with paged queries, thread view, entity-scoped lookups, upsert sync"
  - "EmailSyncBackgroundService polling every 5 minutes via GmailSyncService"
  - "EmailAccountsController with 5 endpoints for OAuth connect/callback/disconnect/status/sync"
  - "EmailsController with 8 endpoints for list/detail/thread/send/by-contact/by-company/read/star"
  - "Email DTOs: EmailListDto, EmailDetailDto, EmailThreadDto, SendEmailRequest, EmailAccountStatusDto"
  - "Gmail services and background service registered in Program.cs DI"
affects: [07-06, 07-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "OAuth callback with CSRF state validation, token encryption, and browser redirect back to SPA"
    - "BackgroundService pattern with IServiceScopeFactory for periodic cross-tenant sync"
    - "Entity-scoped email endpoints (by-contact, by-company) with pagination for detail page tabs"

key-files:
  created:
    - src/GlobCRM.Infrastructure/Persistence/Repositories/EmailAccountRepository.cs
    - src/GlobCRM.Infrastructure/Persistence/Repositories/EmailMessageRepository.cs
    - src/GlobCRM.Infrastructure/Gmail/EmailSyncBackgroundService.cs
    - src/GlobCRM.Api/Controllers/EmailAccountsController.cs
    - src/GlobCRM.Api/Controllers/EmailsController.cs
  modified:
    - src/GlobCRM.Infrastructure/CrmEntities/CrmEntityServiceExtensions.cs
    - src/GlobCRM.Api/Program.cs

key-decisions:
  - "OAuth callback is AllowAnonymous since Google redirects directly (not through the SPA auth flow)"
  - "OAuth state parameter encodes userId|nonce for CSRF protection and user identification in callback"
  - "Tenant resolution fallback in OAuth callback queries ApplicationUser.OrganizationId when subdomain not resolved"
  - "EmailsController has no permission policies -- email access is scoped by tenant query filter (all tenant users see all synced emails)"

patterns-established:
  - "BackgroundService with IServiceScopeFactory: create scope per cycle, resolve scoped services, catch all exceptions"
  - "OAuth redirect flow: connect returns URL, callback exchanges code, encrypts tokens, redirects to SPA"

# Metrics
duration: 5min
completed: 2026-02-17
---

# Phase 7 Plan 3: Email Repositories, Background Sync, and API Controllers Summary

**Email repositories with paged/thread/entity-scoped queries, background sync service polling every 5 minutes, and 13 API endpoints across EmailAccountsController (OAuth lifecycle) and EmailsController (email operations)**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-17T15:25:52Z
- **Completed:** 2026-02-17T15:31:00Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- EmailAccountRepository with per-user lookup and cross-tenant IgnoreQueryFilters for background sync active account enumeration
- EmailMessageRepository with full paged query support (search, filters, sorting), thread view, entity-scoped queries (contact/company), and Gmail dedup/upsert
- EmailSyncBackgroundService as IHostedService polling GmailSyncService every 5 minutes with graceful shutdown handling
- EmailAccountsController handling the complete OAuth lifecycle: status check, connect (authorization URL), callback (code exchange + token encryption + Gmail profile lookup), disconnect (token revocation + account deletion), and manual sync trigger
- EmailsController with 8 endpoints covering list, detail, thread view, send, entity-scoped queries, mark-as-read, and toggle-star
- All email DTOs with JSON array parsing for To/Cc/Bcc address fields
- DI registration in both CrmEntityServiceExtensions (repositories) and Program.cs (Gmail services + background service)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Email repositories and background sync service** - `eb027a6` (feat)
2. **Task 2: Create EmailAccountsController and EmailsController** - `011e05c` (feat)

## Files Created/Modified
- `src/GlobCRM.Infrastructure/Persistence/Repositories/EmailAccountRepository.cs` - Repository for email account CRUD and active account queries
- `src/GlobCRM.Infrastructure/Persistence/Repositories/EmailMessageRepository.cs` - Repository for email messages with paged queries, thread, entity-scoped lookups, and upsert
- `src/GlobCRM.Infrastructure/Gmail/EmailSyncBackgroundService.cs` - Background polling service for periodic email sync
- `src/GlobCRM.Api/Controllers/EmailAccountsController.cs` - OAuth flow endpoints: status, connect, callback, disconnect, sync
- `src/GlobCRM.Api/Controllers/EmailsController.cs` - Email CRUD, thread view, send, contact/company-scoped endpoints
- `src/GlobCRM.Infrastructure/CrmEntities/CrmEntityServiceExtensions.cs` - Added IEmailAccountRepository and IEmailMessageRepository registrations
- `src/GlobCRM.Api/Program.cs` - Added AddGmailServices() and AddHostedService<EmailSyncBackgroundService>()

## Decisions Made
- OAuth callback is AllowAnonymous -- Google redirects to this endpoint directly, the user's browser has no JWT at that point in the flow
- State parameter uses userId|nonce format for CSRF protection while encoding the user identity needed for account creation
- Tenant resolution in OAuth callback falls back to querying ApplicationUser.OrganizationId when Finbuckle middleware cannot resolve tenant from subdomain
- EmailsController endpoints have no entity permission policies -- email access is already scoped by tenant query filter, and email is per-user by account connection

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TokenResponse.IssuedUtc type handling**
- **Found during:** Task 2 (EmailAccountsController callback)
- **Issue:** Code treated `IssuedUtc` as `DateTime?` with `.HasValue`/`.Value`, but Google.Apis.Auth TokenResponse.IssuedUtc is `DateTime` (non-nullable)
- **Fix:** Changed to `!= default` check and direct access without `.Value`
- **Files modified:** src/GlobCRM.Api/Controllers/EmailAccountsController.cs
- **Verification:** Build succeeds with 0 errors
- **Committed in:** 011e05c (Task 2 commit)

**2. [Rule 3 - Blocking] Added Microsoft.EntityFrameworkCore using for IgnoreQueryFilters**
- **Found during:** Task 2 (EmailAccountsController tenant resolution fallback)
- **Issue:** `IgnoreQueryFilters()` extension method required `using Microsoft.EntityFrameworkCore` which was missing
- **Fix:** Added the using directive
- **Files modified:** src/GlobCRM.Api/Controllers/EmailAccountsController.cs
- **Verification:** Build succeeds with 0 errors
- **Committed in:** 011e05c (Task 2 commit)

**3. [Rule 1 - Bug] Fixed ApplicationUser.OrganizationId as non-nullable Guid**
- **Found during:** Task 2 (EmailAccountsController tenant resolution fallback)
- **Issue:** Code treated `OrganizationId` as `Guid?` with `.Value`, but it is a non-nullable `Guid`
- **Fix:** Changed null check to `Guid.Empty` check and removed `.Value`
- **Files modified:** src/GlobCRM.Api/Controllers/EmailAccountsController.cs
- **Verification:** Build succeeds with 0 errors
- **Committed in:** 011e05c (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (2 bugs, 1 blocking)
**Impact on plan:** All auto-fixes necessary for compilation. No scope creep.

## Issues Encountered
None

## User Setup Required
None - Gmail API credentials configured in Plan 02 (appsettings.json).

## Next Phase Readiness
- All API endpoints ready for frontend consumption (Plan 04/05 already created Angular services and UI)
- Background sync service starts automatically on application startup
- OAuth flow ready for end-to-end testing when Google Cloud credentials are configured

## Self-Check: PASSED

All 5 created files verified on disk. Both task commits (eb027a6, 011e05c) verified in git log. Build succeeds with 0 errors.

---
*Phase: 07-email-integration*
*Completed: 2026-02-17*

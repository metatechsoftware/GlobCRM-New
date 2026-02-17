---
phase: 08-real-time-and-notifications
plan: 02
subsystem: api
tags: [signalr, websocket, notifications, activity-feed, real-time, email]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: "JWT authentication, ApplicationDbContext, multi-tenant infrastructure"
  - phase: 08-01
    provides: "Notification, NotificationPreference, FeedItem, FeedComment domain entities and repository interfaces"
provides:
  - "CrmHub SignalR endpoint at /hubs/crm with JWT auth and tenant/user groups"
  - "NotificationDispatcher for 3-channel delivery (DB + SignalR + email)"
  - "NotificationRepository implementing INotificationRepository with full CRUD"
  - "FeedRepository implementing IFeedRepository with paged feed and comments"
  - "IEmailService.SendNotificationEmailAsync for notification email delivery"
  - "AddNotificationServices() and AddFeedServices() DI extension methods"
affects: [08-03, 08-04, 08-05, 08-06, 08-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SignalR hub in Infrastructure project (not Api) to enable IHubContext injection without circular dependency"
    - "NotificationDispatcher 3-channel pattern: persist to DB, push via SignalR, optionally email"
    - "Fire-and-forget email in notification dispatch: email failure logged but does not fail dispatch"
    - "JWT query string handler via JwtBearerEvents.OnMessageReceived for WebSocket connections"

key-files:
  created:
    - src/GlobCRM.Infrastructure/Notifications/CrmHub.cs
    - src/GlobCRM.Infrastructure/Notifications/NotificationRepository.cs
    - src/GlobCRM.Infrastructure/Notifications/NotificationDispatcher.cs
    - src/GlobCRM.Infrastructure/Notifications/NotificationServiceExtensions.cs
    - src/GlobCRM.Infrastructure/Feed/FeedRepository.cs
    - src/GlobCRM.Infrastructure/Feed/FeedServiceExtensions.cs
  modified:
    - src/GlobCRM.Infrastructure/DependencyInjection.cs
    - src/GlobCRM.Api/Program.cs
    - src/GlobCRM.Application/Common/IEmailService.cs
    - src/GlobCRM.Infrastructure/Email/SendGridEmailSender.cs

key-decisions:
  - "CrmHub placed in Infrastructure (not Api) to avoid circular project dependency with NotificationDispatcher"
  - "NotificationDispatcher email delivery is fire-and-forget (try/catch with logging) to avoid failing the full dispatch"
  - "Default email preference is enabled when no NotificationPreference exists for a user/type"

patterns-established:
  - "SignalR hub in Infrastructure namespace for services that need IHubContext injection"
  - "Notification dispatch 3-channel pattern: DB persist -> SignalR push -> optional email"
  - "Branded inline HTML notification email (no Razor template, same style as existing emails)"

# Metrics
duration: 4min
completed: 2026-02-17
---

# Phase 8 Plan 2: SignalR Hub & Notification Services Summary

**SignalR CrmHub with JWT WebSocket auth, NotificationDispatcher coordinating DB + SignalR + email delivery, notification and feed repository implementations, and branded notification email extension**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-17T16:32:44Z
- **Completed:** 2026-02-17T16:37:10Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- CrmHub mapped at /hubs/crm with JWT token read from WebSocket query string, clients join tenant and user groups
- NotificationDispatcher coordinates 3-channel delivery: DB persistence, SignalR real-time push, and optional email
- NotificationRepository implements full CRUD: paged listing, unread count, mark-as-read (single and bulk), preference management
- FeedRepository implements paged feed with author includes, item creation, comments with author navigation
- IEmailService extended with SendNotificationEmailAsync, implemented with branded inline HTML template
- All services registered via AddNotificationServices() and AddFeedServices() DI extension methods

## Task Commits

Each task was committed atomically:

1. **Task 1: SignalR hub, JWT query string handler, and hub mapping** - `a9dbb66` (feat)
2. **Task 2: Notification and feed repositories, dispatcher, and email extension** - `fd54377` (feat)

## Files Created/Modified
- `src/GlobCRM.Infrastructure/Notifications/CrmHub.cs` - SignalR hub with [Authorize], tenant/user group management
- `src/GlobCRM.Infrastructure/Notifications/NotificationRepository.cs` - EF Core notification repository with paged listing, unread count, mark-as-read
- `src/GlobCRM.Infrastructure/Notifications/NotificationDispatcher.cs` - Central 3-channel notification delivery coordinator
- `src/GlobCRM.Infrastructure/Notifications/NotificationServiceExtensions.cs` - DI registration for notification services
- `src/GlobCRM.Infrastructure/Feed/FeedRepository.cs` - EF Core feed repository with paged feed, comments, author includes
- `src/GlobCRM.Infrastructure/Feed/FeedServiceExtensions.cs` - DI registration for feed services
- `src/GlobCRM.Infrastructure/DependencyInjection.cs` - Added JwtBearerEvents OnMessageReceived for SignalR query string tokens
- `src/GlobCRM.Api/Program.cs` - Added SignalR services, hub mapping, notification and feed DI registrations
- `src/GlobCRM.Application/Common/IEmailService.cs` - Extended with SendNotificationEmailAsync method
- `src/GlobCRM.Infrastructure/Email/SendGridEmailSender.cs` - Implemented branded inline HTML notification email

## Decisions Made
- CrmHub placed in Infrastructure project (not Api) to avoid circular project dependency -- NotificationDispatcher in Infrastructure needs IHubContext<CrmHub>, and Infrastructure cannot reference Api
- NotificationDispatcher email delivery is fire-and-forget with try/catch logging -- email failure should not prevent DB persistence and SignalR push from completing
- Default notification email preference is enabled (true) when no NotificationPreference record exists for a user/type combination

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Moved CrmHub from Api to Infrastructure to resolve circular dependency**
- **Found during:** Task 2 (NotificationDispatcher implementation)
- **Issue:** Plan placed CrmHub in src/GlobCRM.Api/Hubs/ but NotificationDispatcher in Infrastructure needs IHubContext<CrmHub>. Infrastructure cannot reference Api (circular dependency).
- **Fix:** Moved CrmHub to src/GlobCRM.Infrastructure/Notifications/CrmHub.cs. Updated namespace and all references in Program.cs.
- **Files modified:** src/GlobCRM.Infrastructure/Notifications/CrmHub.cs (created), src/GlobCRM.Api/Hubs/CrmHub.cs (removed), src/GlobCRM.Api/Program.cs (updated import)
- **Verification:** dotnet build succeeds with 0 errors
- **Committed in:** fd54377 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking issue)
**Impact on plan:** Essential for compilation. CrmHub functionality unchanged, only location differs. No scope creep.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- SignalR hub and notification infrastructure ready for controller integration in 08-03 (Notification API endpoints)
- NotificationDispatcher ready for use by any service that needs to dispatch notifications
- FeedRepository ready for feed controller implementation in 08-04
- Email notification delivery integrated into the dispatch pipeline

## Self-Check: PASSED

All 6 created files verified on disk. Both task commits (a9dbb66, fd54377) confirmed in git log.

---
*Phase: 08-real-time-and-notifications*
*Completed: 2026-02-17*

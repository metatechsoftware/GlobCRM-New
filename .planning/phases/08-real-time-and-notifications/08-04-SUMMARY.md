---
phase: 08-real-time-and-notifications
plan: 04
subsystem: api
tags: [notifications, signalr, activity-feed, deal-stage, activity-assignment, email-sync, mentions]

# Dependency graph
requires:
  - phase: 08-01
    provides: "Notification, FeedItem domain entities and enums"
  - phase: 08-02
    provides: "NotificationDispatcher, IFeedRepository, CrmHub SignalR infrastructure"
provides:
  - "Deal stage change dispatches DealStageChanged notification to deal owner"
  - "Activity assignment dispatches ActivityAssigned notification to assignee"
  - "Activity comment @mentions dispatch Mention notifications to mentioned users"
  - "New inbound email dispatches EmailReceived notification to account owner"
  - "All CRM mutations create SystemEvent feed items for activity stream"
  - "NotificationDispatcher.DispatchAsync overload with explicit tenantId for background services"
affects: [08-05, 08-06, 08-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Try/catch wrapping all notification dispatch calls so notification failures never break primary operations"
    - "DispatchAsync overload with explicit tenantId for background service contexts without tenant resolution"
    - "Regex @mention detection in activity comments with tenant-scoped user lookup"

key-files:
  created: []
  modified:
    - src/GlobCRM.Api/Controllers/DealsController.cs
    - src/GlobCRM.Api/Controllers/ActivitiesController.cs
    - src/GlobCRM.Infrastructure/Gmail/GmailSyncService.cs
    - src/GlobCRM.Infrastructure/Notifications/NotificationDispatcher.cs

key-decisions:
  - "NotificationDispatcher gets explicit tenantId overload for background services where tenant context unavailable"
  - "Deal stage notifications only sent to owner when owner differs from current user (no self-notifications)"
  - "Activity assignment notifications only sent when assignee differs from current user and assignment changed"

patterns-established:
  - "Non-blocking notification dispatch: all dispatch calls wrapped in try/catch with error logging"
  - "Feed + SignalR pattern: create FeedItem, then DispatchToTenantFeedAsync for real-time push"

# Metrics
duration: 4min
completed: 2026-02-17
---

# Phase 8 Plan 4: CRM Event Notification Integration Summary

**NotificationDispatcher wired into DealsController, ActivitiesController, and GmailSyncService for deal stage, activity assignment, @mention, and email received notifications with SystemEvent feed items**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-17T16:39:19Z
- **Completed:** 2026-02-17T16:43:30Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Deal creation and stage changes dispatch DealStageChanged notifications and create SystemEvent feed items
- Activity creation/update dispatches ActivityAssigned notifications when assignee differs from creator
- Activity comments detect @mentions via regex and dispatch Mention notifications to matched tenant users
- Activity status changes create SystemEvent feed items for the activity stream
- New inbound emails trigger EmailReceived notifications to account owner with sender info
- Added DispatchAsync overload with explicit tenantId for background service contexts (GmailSyncService)

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire NotificationDispatcher into DealsController and ActivitiesController** - `a87aa7d` (feat)
2. **Task 2: Wire NotificationDispatcher into GmailSyncService for email received events** - `ebb46b5` (feat)

## Files Created/Modified
- `src/GlobCRM.Api/Controllers/DealsController.cs` - Added NotificationDispatcher + IFeedRepository injection, deal stage change notifications, deal creation feed events
- `src/GlobCRM.Api/Controllers/ActivitiesController.cs` - Added NotificationDispatcher + IFeedRepository injection, activity assignment notifications, status change feed events, @mention detection in comments
- `src/GlobCRM.Infrastructure/Gmail/GmailSyncService.cs` - Added NotificationDispatcher + IFeedRepository injection, EmailReceived notification for new inbound emails
- `src/GlobCRM.Infrastructure/Notifications/NotificationDispatcher.cs` - Added DispatchAsync(request, tenantId) overload for background services

## Decisions Made
- NotificationDispatcher gets explicit tenantId overload for background services -- GmailSyncService runs cross-tenant without tenant resolution, needs to pass tenantId directly
- Deal stage change notifications only sent to owner when owner is different from the current user performing the action (no self-notifications)
- Activity assignment notifications only dispatched when assignee differs from current user AND assignment actually changed (prevents duplicate notifications on update)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added DispatchAsync overload with explicit tenantId for background service context**
- **Found during:** Task 2 (GmailSyncService integration)
- **Issue:** NotificationDispatcher.DispatchAsync relies on DbContext.TenantInfo for tenant resolution, but GmailSyncService runs as a background service without tenant context
- **Fix:** Added DispatchAsync(NotificationRequest request, Guid tenantId) overload that accepts explicit tenantId, original overload delegates to it
- **Files modified:** src/GlobCRM.Infrastructure/Notifications/NotificationDispatcher.cs
- **Verification:** dotnet build succeeds with 0 errors
- **Committed in:** ebb46b5 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking issue)
**Impact on plan:** Essential for background service compatibility. No scope creep -- same notification behavior, just different tenant ID source.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All CRM event types now dispatch notifications and create feed items
- Ready for 08-05 (frontend notification components) and 08-06 (activity feed UI)
- NotificationDispatcher background service overload available for any future background jobs

## Self-Check: PASSED

All 4 modified files verified on disk. Both task commits (a87aa7d, ebb46b5) confirmed in git log.

---
*Phase: 08-real-time-and-notifications*
*Completed: 2026-02-17*

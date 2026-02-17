---
phase: 08-real-time-and-notifications
plan: 03
subsystem: api
tags: [rest-api, notifications, activity-feed, signalr, background-service, mention-detection]

# Dependency graph
requires:
  - phase: 08-01
    provides: "Notification, NotificationPreference, FeedItem, FeedComment domain entities and repository interfaces"
  - phase: 08-02
    provides: "CrmHub SignalR hub, NotificationDispatcher, NotificationRepository, FeedRepository implementations"
provides:
  - "NotificationsController with 7 REST endpoints for notification CRUD and preferences"
  - "FeedController with 5 REST endpoints for feed listing, social posts, comments, and deletion"
  - "DueDateNotificationService background service for hourly due date checks"
  - "@mention detection via regex with automatic Mention notification dispatch"
  - "Real-time SignalR push for FeedUpdate and FeedCommentAdded events"
  - "GetByIdAsync, MarkAsUnreadAsync on INotificationRepository"
  - "DeleteAsync on IFeedRepository"
affects: [08-04, 08-05, 08-06, 08-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Controller DTOs defined as records in controller file (matching EmailsController pattern)"
    - "@mention detection via Regex.Matches with fire-and-forget dispatch (failure does not fail main operation)"
    - "Background service cross-tenant scanning via IgnoreQueryFilters for activities table"
    - "DueDateNotificationService follows EmailSyncBackgroundService pattern exactly"

key-files:
  created:
    - src/GlobCRM.Api/Controllers/NotificationsController.cs
    - src/GlobCRM.Api/Controllers/FeedController.cs
    - src/GlobCRM.Infrastructure/Notifications/DueDateNotificationService.cs
  modified:
    - src/GlobCRM.Domain/Interfaces/INotificationRepository.cs
    - src/GlobCRM.Domain/Interfaces/IFeedRepository.cs
    - src/GlobCRM.Infrastructure/Notifications/NotificationRepository.cs
    - src/GlobCRM.Infrastructure/Feed/FeedRepository.cs
    - src/GlobCRM.Api/Program.cs

key-decisions:
  - "Controller DTOs defined as records in controller file (matching EmailsController pattern, not separate Dtos folder)"
  - "Feed delete restricted to author or Admin role (matching ActivityComment author-only pattern)"
  - "@mention lookup by first name or username with fire-and-forget dispatch"
  - "DueDateNotificationService uses IgnoreQueryFilters for cross-tenant scanning since background service has no tenant context"

patterns-established:
  - "Notification preferences endpoint returns defaults for all types when no stored preferences exist"
  - "Feed comments dispatched via SignalR with FeedCommentAdded event containing parent FeedItemId"

# Metrics
duration: 3min
completed: 2026-02-17
---

# Phase 8 Plan 3: Notification & Feed API Endpoints Summary

**NotificationsController (7 endpoints) and FeedController (5 endpoints) with @mention detection, real-time SignalR push, and DueDateNotificationService hourly background scanner**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-17T16:39:51Z
- **Completed:** 2026-02-17T16:43:20Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- NotificationsController with 7 endpoints: paged list, unread count, mark-read, mark-unread, mark-all-read, get preferences, update preferences
- FeedController with 5 endpoints: paged list, detail with comments, create social post, add comment, delete (author/admin only)
- @mention detection via regex dispatches Mention notifications to matched users
- Real-time SignalR FeedUpdate and FeedCommentAdded events on post/comment creation
- DueDateNotificationService runs hourly, checks activities due within 24h, dispatches without duplicates, creates SystemEvent feed items

## Task Commits

Each task was committed atomically:

1. **Task 1: NotificationsController and FeedController** - `5001052` (feat)
2. **Task 2: DueDateNotificationService background service** - `69d332b` (feat)

## Files Created/Modified
- `src/GlobCRM.Api/Controllers/NotificationsController.cs` - 7 notification endpoints with DTOs (list, unread count, read/unread, preferences)
- `src/GlobCRM.Api/Controllers/FeedController.cs` - 5 feed endpoints with DTOs (list, detail, post, comment, delete) with @mention and SignalR
- `src/GlobCRM.Infrastructure/Notifications/DueDateNotificationService.cs` - Hourly background service for due date approaching notifications
- `src/GlobCRM.Domain/Interfaces/INotificationRepository.cs` - Added GetByIdAsync, MarkAsUnreadAsync methods
- `src/GlobCRM.Domain/Interfaces/IFeedRepository.cs` - Added DeleteAsync method
- `src/GlobCRM.Infrastructure/Notifications/NotificationRepository.cs` - Implemented GetByIdAsync, MarkAsUnreadAsync
- `src/GlobCRM.Infrastructure/Feed/FeedRepository.cs` - Implemented DeleteAsync
- `src/GlobCRM.Api/Program.cs` - Registered DueDateNotificationService as hosted service

## Decisions Made
- Controller DTOs defined as records in controller file matching the EmailsController pattern, not in a separate Dtos folder
- Feed delete restricted to author or Admin role with 403 Forbidden for unauthorized attempts
- @mention detection uses regex `@(\w+)` matching against user first names or usernames, with fire-and-forget dispatch
- DueDateNotificationService uses IgnoreQueryFilters for cross-tenant activity scanning since background services lack tenant context
- Notification preferences endpoint returns defaults (both channels enabled) for all NotificationType enum values when no stored preference exists

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added GetByIdAsync, MarkAsUnreadAsync to INotificationRepository**
- **Found during:** Task 1 (NotificationsController implementation)
- **Issue:** Controller needs to verify notification exists and belongs to user before marking read/unread, and needs MarkAsUnread which was not in the interface
- **Fix:** Added GetByIdAsync and MarkAsUnreadAsync to INotificationRepository interface and NotificationRepository implementation
- **Files modified:** src/GlobCRM.Domain/Interfaces/INotificationRepository.cs, src/GlobCRM.Infrastructure/Notifications/NotificationRepository.cs
- **Verification:** Build passes, endpoints correctly verify ownership
- **Committed in:** 5001052 (Task 1 commit)

**2. [Rule 2 - Missing Critical] Added DeleteAsync to IFeedRepository**
- **Found during:** Task 1 (FeedController DELETE endpoint)
- **Issue:** FeedController DELETE endpoint requires delete capability not present in IFeedRepository
- **Fix:** Added DeleteAsync to IFeedRepository interface and FeedRepository implementation
- **Files modified:** src/GlobCRM.Domain/Interfaces/IFeedRepository.cs, src/GlobCRM.Infrastructure/Feed/FeedRepository.cs
- **Verification:** Build passes, delete endpoint functional
- **Committed in:** 5001052 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 missing critical functionality)
**Impact on plan:** Both additions required for controller endpoints to function. No scope creep.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All notification and feed REST endpoints ready for Angular frontend integration in 08-04/08-05
- DueDateNotificationService active and scanning for due dates on application startup
- @mention notification flow complete from detection through dispatch to real-time push
- Feed real-time events ready for Angular SignalR client subscription

## Self-Check: PASSED

All 3 created files verified on disk. Both task commits (5001052, 69d332b) confirmed in git log.

---
*Phase: 08-real-time-and-notifications*
*Completed: 2026-02-17*

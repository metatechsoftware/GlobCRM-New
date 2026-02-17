---
phase: 08-real-time-and-notifications
plan: 05
subsystem: ui
tags: [signalr, websocket, notifications, real-time, angular, ngrx-signals, bell-icon]

# Dependency graph
requires:
  - phase: 08-02
    provides: "CrmHub SignalR hub at /hubs/crm with ReceiveNotification, FeedUpdate, FeedCommentAdded events"
  - phase: 08-03
    provides: "NotificationsController REST endpoints for list, unread count, mark read/unread, preferences"
provides:
  - "SignalRService singleton with typed hub event observables and auto-reconnect"
  - "NotificationStore (root-provided) with real-time push, unread count, mark read/unread"
  - "NotificationCenterComponent with bell icon badge and dropdown panel in navbar"
  - "SignalR lifecycle tied to auth state (start on login, stop on logout)"
  - "NotificationService HTTP client matching all NotificationsController endpoints"
affects: [08-06, 08-07]

# Tech tracking
tech-stack:
  added: ["@microsoft/signalr@10.0.0"]
  patterns:
    - "SignalRService as root-provided singleton managing WebSocket lifecycle via effect() in AppComponent"
    - "NotificationStore root-provided with SignalR subscription for real-time notification push"
    - "HostListener document:click for outside-click panel dismiss"
    - "Relative time display via simple diff calculation (no library)"

key-files:
  created:
    - globcrm-web/src/app/core/signalr/signalr.service.ts
    - globcrm-web/src/app/features/notifications/notification.models.ts
    - globcrm-web/src/app/features/notifications/notification.service.ts
    - globcrm-web/src/app/features/notifications/notification.store.ts
    - globcrm-web/src/app/features/notifications/notification-center/notification-center.component.ts
  modified:
    - globcrm-web/src/app/shared/components/navbar/navbar.component.ts
    - globcrm-web/src/app/shared/components/navbar/navbar.component.html
    - globcrm-web/src/app/app.component.ts
    - globcrm-web/package.json

key-decisions:
  - "SignalRService uses promise-based start/stop (not async/await) to match Angular lifecycle patterns"
  - "NotificationStore subscribes to SignalR in withMethods factory for immediate real-time push"
  - "Panel loads notifications on open (lazy) rather than on init for performance"
  - "Outside-click dismiss via HostListener on document:click with ElementRef.contains check"

patterns-established:
  - "SignalR hub event subscription pattern: Subject -> asObservable() with typed DTOs"
  - "Notification panel with entity-type routing map for deep navigation on click"

# Metrics
duration: 4min
completed: 2026-02-17
---

# Phase 8 Plan 5: SignalR Client & Notification UI Summary

**@microsoft/signalr client with typed hub event observables, root-provided NotificationStore with real-time push, and bell icon dropdown panel in navbar with unread badge and entity navigation**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-17T16:46:13Z
- **Completed:** 2026-02-17T16:51:00Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- @microsoft/signalr@10.0.0 installed with SignalRService singleton managing WebSocket lifecycle with auto-reconnect [0, 2s, 10s, 30s]
- NotificationStore (root-provided) subscribes to SignalR notification$ for live push, manages unread count and panel state
- NotificationCenterComponent with bell icon, mat-badge unread count, dropdown panel showing notifications with type icons and relative time
- AppComponent effect ties SignalR start/stop to auth state and loads initial unread count on login
- NotificationService with 7 API methods matching all NotificationsController endpoints

## Task Commits

Each task was committed atomically:

1. **Task 1: Install SignalR client and create SignalRService + notification models/service** - `dd51aea` (feat)
2. **Task 2: NotificationStore, NotificationCenter component, navbar integration** - `52b27e8` (feat)

## Files Created/Modified
- `globcrm-web/src/app/core/signalr/signalr.service.ts` - SignalR connection wrapper with typed event observables (ReceiveNotification, FeedUpdate, FeedCommentAdded)
- `globcrm-web/src/app/features/notifications/notification.models.ts` - NotificationDto, NotificationPreferenceDto, NotificationType enum, response types
- `globcrm-web/src/app/features/notifications/notification.service.ts` - HTTP service for all 7 notification API endpoints
- `globcrm-web/src/app/features/notifications/notification.store.ts` - Root-provided signal store with real-time SignalR subscription, unread count, panel toggle
- `globcrm-web/src/app/features/notifications/notification-center/notification-center.component.ts` - Bell icon with badge, dropdown panel with notification list, mark read, entity navigation
- `globcrm-web/src/app/shared/components/navbar/navbar.component.ts` - Added NotificationCenterComponent import
- `globcrm-web/src/app/shared/components/navbar/navbar.component.html` - Added app-notification-center between spacer and user menu
- `globcrm-web/src/app/app.component.ts` - Added SignalR lifecycle effect and initial unread count load
- `globcrm-web/package.json` - Added @microsoft/signalr@10.0.0 dependency

## Decisions Made
- SignalRService uses promise-based start/stop (not async/await) to keep start() synchronous for simpler lifecycle management from effect()
- NotificationStore subscribes to SignalR notification$ directly in the withMethods factory function for immediate real-time push without separate initialization
- Panel loads notifications lazily on open (togglePanel) rather than on app init, reducing initial API calls
- Outside-click dismiss uses HostListener on document:click with ElementRef.nativeElement.contains for panel close

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- SignalR client infrastructure ready for feed UI components in 08-06 (Activity Feed UI)
- NotificationStore and SignalRService available for any component needing real-time updates
- FeedUpdate$ and FeedComment$ observables ready for feed store subscription in 08-06

## Self-Check: PASSED

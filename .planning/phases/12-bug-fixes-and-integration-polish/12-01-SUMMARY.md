---
phase: 12-bug-fixes-and-integration-polish
plan: 01
subsystem: ui, api
tags: [angular, routing, rbac, permission-guard, gmail-oauth, navbar]

# Dependency graph
requires:
  - phase: 08-rbac-permissions
    provides: permissionGuard and PermissionStore for route-level RBAC
  - phase: 09-email-integration
    provides: EmailService and EmailAccountsController connect endpoint
provides:
  - Gmail OAuth connect flow uses correct HTTP method (GET)
  - Import page discoverable via navbar navigation
  - Route-level RBAC enforcement on all 8 CRM entity routes
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "permissionGuard('EntityType', 'View') after authGuard in canActivate arrays"

key-files:
  created: []
  modified:
    - globcrm-web/src/app/features/emails/email.service.ts
    - globcrm-web/src/app/shared/components/navbar/navbar.component.ts
    - globcrm-web/src/app/app.routes.ts

key-decisions:
  - "authGuard always first in canActivate array to ensure PermissionStore loads after authentication"
  - "Only 8 CRM entity routes get permissionGuard; utility routes (dashboard, settings, emails, feed, calendar, import) excluded"

patterns-established:
  - "Route-level RBAC: canActivate: [authGuard, permissionGuard('Entity', 'View')] for CRM entity routes"

# Metrics
duration: 3min
completed: 2026-02-18
---

# Phase 12 Plan 01: Frontend Bug Fixes Summary

**Fixed Gmail connect POST-to-GET method mismatch, added Import to navbar, and wired permissionGuard into 8 CRM entity routes**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-18T16:31:15Z
- **Completed:** 2026-02-18T16:34:28Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Gmail OAuth connect endpoint now calls GET matching backend [HttpGet("connect")], fixing 405 Method Not Allowed
- Import page is discoverable via navbar Admin group with upload_file icon
- All 8 CRM entity routes enforce route-level RBAC via permissionGuard, redirecting unauthorized users to dashboard

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix Gmail connect HTTP method and add Import to navbar** - `df36ccc` (fix)
2. **Task 2: Add permissionGuard to CRM entity routes** - `5467689` (feat)

## Files Created/Modified
- `globcrm-web/src/app/features/emails/email.service.ts` - Changed connect() from api.post to api.get
- `globcrm-web/src/app/shared/components/navbar/navbar.component.ts` - Added Import nav item to Admin group
- `globcrm-web/src/app/app.routes.ts` - Added permissionGuard import and applied to 8 CRM entity routes

## Decisions Made
- authGuard must always precede permissionGuard in canActivate arrays to ensure the user is authenticated and PermissionStore is populated before permission checks run
- Only CRM entity routes (companies, contacts, products, deals, activities, quotes, requests, notes) receive permissionGuard; utility routes use different authorization strategies

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing Angular build errors (exit code 1) in ActivityDetailComponent and DealDetailComponent templates unrelated to this plan's changes. These are template-level warnings/errors from other phases that do not affect the files modified in this plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All 3 frontend audit gaps addressed (Gmail connect, navbar import, route RBAC)
- Ready for plan 12-02 execution
- Note: Pre-existing build errors in activity and deal detail templates should be addressed in a future cleanup

## Self-Check: PASSED

All files exist. All commits verified (df36ccc, 5467689).

---
*Phase: 12-bug-fixes-and-integration-polish*
*Completed: 2026-02-18*

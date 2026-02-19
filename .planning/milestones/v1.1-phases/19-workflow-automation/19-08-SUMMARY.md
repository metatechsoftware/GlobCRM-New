---
phase: 19-workflow-automation
plan: 08
subsystem: auth
tags: [angular, interceptor, permissions, token-refresh, 401-retry]

# Dependency graph
requires:
  - phase: 19-workflow-automation
    provides: Workflow entity types and RBAC permissions that triggered the stale-permission UAT failure
provides:
  - Permission reload after 401-triggered token refresh in auth interceptor
affects: [auth, permissions, workflow-automation]

# Tech tracking
tech-stack:
  added: []
  patterns: [fire-and-forget permission reload on token refresh]

key-files:
  created: []
  modified:
    - globcrm-web/src/app/core/auth/auth.interceptor.ts

key-decisions:
  - "Fire-and-forget loadPermissions() call -- does not block request retry since JWT already valid and permissions update reactively via signals"

patterns-established:
  - "Token refresh side-effects: auth interceptor 401-retry path is the canonical place to reload dependent stores after token rotation"

requirements-completed: [WFLOW-01]

# Metrics
duration: 2min
completed: 2026-02-19
---

# Phase 19 Plan 08: Permission Reload After Token Refresh Summary

**Auth interceptor now reloads PermissionStore after 401 token refresh, preventing stale permission state for new entity types like Workflows**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-19T15:55:54Z
- **Completed:** 2026-02-19T15:57:33Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Auth interceptor reloads permissions after successful 401 token refresh (fire-and-forget)
- Normal (non-401) request flow remains completely unchanged
- Resolves UAT Test 1 failure where /workflows redirected to dashboard due to missing Workflow:View permission in stale PermissionStore

## Task Commits

Each task was committed atomically:

1. **Task 1: Add PermissionStore.loadPermissions() call after 401-retry token refresh** - `d10313e` (fix)

## Files Created/Modified
- `globcrm-web/src/app/core/auth/auth.interceptor.ts` - Added PermissionStore import, injection, and fire-and-forget loadPermissions() call in 401 refresh switchMap

## Decisions Made
- Fire-and-forget pattern chosen for loadPermissions() -- the retried request already has a valid JWT, and permission state updates reactively via Angular signals once the load completes. Blocking the retry on permission loading would add unnecessary latency.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All gap closure plans for Phase 19 are now complete
- Permission reload ensures seamless entity-type additions across sessions
- Ready for Phase 20 or final integration testing

## Self-Check: PASSED

- FOUND: globcrm-web/src/app/core/auth/auth.interceptor.ts
- FOUND: commit d10313e
- FOUND: 19-08-SUMMARY.md

---
*Phase: 19-workflow-automation*
*Completed: 2026-02-19*

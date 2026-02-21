---
phase: 27-localization-foundation
plan: 05
subsystem: i18n
tags: [angular, transloco, language-persistence, auth, profile-api]

# Dependency graph
requires:
  - phase: 27-02
    provides: LanguageService with syncFromProfile method and backend persistence write path
  - phase: 27-04
    provides: syncFromProfile resolution chain (user pref > org default API > browser > 'en')
provides:
  - Complete language persistence read path wired into AuthService login flow
  - Automatic language restoration from backend profile on every user-initiated login
  - New user org default language inheritance via syncFromProfile fallback chain
affects: [auth, profile, i18n]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fire-and-forget profile preference fetch in auth login flow"
    - "syncLanguage parameter to distinguish user-initiated vs automatic token refresh"

key-files:
  created: []
  modified:
    - globcrm-web/src/app/core/auth/auth.service.ts

key-decisions:
  - "syncLanguage parameter on handleLoginSuccess skips language sync during automatic token refresh to avoid wasteful API calls and disruptive mid-session language switches"
  - "Language sync is fire-and-forget — does not block login navigation or UI rendering"
  - "On preferences fetch failure, syncFromProfile(null) triggers org default fallback chain rather than silently failing"

patterns-established:
  - "Auth login success hooks: fire-and-forget side-effects after core auth flow (permissions, language) with error isolation"

requirements-completed: [LOCL-02, LOCL-07]

# Metrics
duration: 2min
completed: 2026-02-21
---

# Phase 27 Plan 05: Gap Closure - syncFromProfile Auth Wiring Summary

**Wired LanguageService.syncFromProfile() into AuthService.handleLoginSuccess() to restore backend language preference on login, completing the persistence read path for LOCL-02/LOCL-07**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-21T07:38:01Z
- **Completed:** 2026-02-21T07:40:16Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Injected LanguageService and ProfileService into AuthService, closing the one remaining gap in the language persistence chain
- After login, user's backend language preference is fetched via ProfileService.getPreferences() and passed to LanguageService.syncFromProfile() for restoration
- Added syncLanguage parameter to handleLoginSuccess() to skip language sync during automatic token refresh (every ~24 min), preventing wasteful API calls and disruptive mid-session switches
- Complete persistence chain now wired: save path (switchLanguage -> updatePreferences) and restore path (handleLoginSuccess -> getPreferences -> syncFromProfile)

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire syncFromProfile into AuthService login flow** - `244620a` (feat)

**Plan metadata:** (pending final commit)

## Files Created/Modified
- `globcrm-web/src/app/core/auth/auth.service.ts` - Added LanguageService/ProfileService injection and syncFromProfile() call in handleLoginSuccess() with syncLanguage parameter

## Decisions Made
- **syncLanguage parameter:** handleLoginSuccess receives a syncLanguage boolean (default true) to distinguish user-initiated login from automatic token refresh. Auto-refresh passes false to avoid wasteful API calls and mid-session language switches.
- **Fire-and-forget pattern:** Language sync does not block login navigation or UI rendering — follows the same pattern as permissionStore.loadPermissions().
- **Failure fallback:** When preferences API fails, syncFromProfile(null) is called rather than silently skipping, ensuring org default language fallback chain is triggered for new users.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 27 (Localization Foundation) is now fully complete with all gaps closed
- Language persistence works end-to-end: save on switch, restore on login
- New users inherit organization default language on first login
- Ready for Phase 28 planning

## Self-Check: PASSED

- FOUND: globcrm-web/src/app/core/auth/auth.service.ts
- FOUND: .planning/phases/27-localization-foundation/27-05-SUMMARY.md
- FOUND: commit 244620a

---
*Phase: 27-localization-foundation*
*Plan: 05 (Gap Closure)*
*Completed: 2026-02-21*

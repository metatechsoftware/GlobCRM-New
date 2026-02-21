---
phase: 27-localization-foundation
plan: 02
subsystem: ui
tags: [angular, navbar, language-switcher, i18n, transloco, persistence]

# Dependency graph
requires:
  - phase: 27-01
    provides: "LanguageService with browser detection, localStorage cache, and Transloco switching"
provides:
  - "Language switcher EN/TR segmented toggle in navbar user dropdown menu"
  - "Lang badge (EN/TR pill) visible near avatar on desktop and mobile without opening menu"
  - "Backend profile persistence for language preference via fire-and-forget updatePreferences"
  - "syncFromProfile() method for post-login language sync from backend source of truth"
affects: [27-03, 27-04]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Fire-and-forget backend sync for language preference", "Self-translating label (Language/Dil) without Transloco dependency", "stopPropagation to keep mat-menu open during toggle interaction"]

key-files:
  created: []
  modified:
    - "globcrm-web/src/app/core/i18n/language.service.ts"
    - "globcrm-web/src/app/shared/components/navbar/navbar.component.ts"
    - "globcrm-web/src/app/shared/components/navbar/navbar.component.html"
    - "globcrm-web/src/app/shared/components/navbar/navbar.component.scss"

key-decisions:
  - "Backend persistence is fire-and-forget with silent error handling to never block the UI"
  - "Language toggle uses self-translating label (Language/Dil) instead of Transloco pipe for bootstrap reliability"
  - "stopPropagation on lang-toggle container keeps dropdown menu open during language switching"

patterns-established:
  - "Fire-and-forget pattern for non-critical backend sync: subscribe with empty error handler inside try/catch"
  - "Segmented button toggle pattern for binary options in dropdown menus"

requirements-completed: [LOCL-01, LOCL-02]

# Metrics
duration: 2min
completed: 2026-02-21
---

# Phase 27 Plan 02: Navbar Language Switcher Summary

**EN/TR segmented toggle in navbar user dropdown with fire-and-forget backend persistence and lang badge visible near avatar**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-21T07:16:03Z
- **Completed:** 2026-02-21T07:17:58Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Added backend persistence to LanguageService with fire-and-forget updatePreferences call and syncFromProfile() for post-login sync
- Built EN/TR segmented toggle in the user dropdown menu between Security and Sign Out, with self-translating label
- Added lang badge (EN/TR pill) visible near avatar on both desktop content header and mobile top bar
- Menu stays open when toggling language (stopPropagation), switching is instant without confirmation dialog

## Task Commits

Each task was committed atomically:

1. **Task 1: Add backend persistence to LanguageService and wire profile sync on login** - `7a9a1d8` (feat)
2. **Task 2: Build language switcher toggle in navbar user menu with lang badge** - `2c57ef5` (feat)

## Files Created/Modified
- `globcrm-web/src/app/core/i18n/language.service.ts` - Added ProfileService injection, fire-and-forget backend sync, syncFromProfile() method
- `globcrm-web/src/app/shared/components/navbar/navbar.component.ts` - Injected LanguageService, exposed currentLang signal and switchLanguage method
- `globcrm-web/src/app/shared/components/navbar/navbar.component.html` - Added lang badge on desktop/mobile, EN/TR segmented toggle in user menu
- `globcrm-web/src/app/shared/components/navbar/navbar.component.scss` - Styled lang badge, lang toggle, segmented buttons with active state

## Decisions Made
- Backend persistence is fire-and-forget with silent error handling (try/catch + empty error subscriber) to never block the UI or fail during unauthenticated bootstrap
- Language toggle label uses inline conditional (Language/Dil) instead of Transloco pipe, ensuring the toggle works even before translations load
- stopPropagation on the lang-toggle container prevents mat-menu from closing when user clicks the toggle buttons

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Language switcher UI complete and building successfully
- Ready for Plan 03 (entity page translation with Transloco pipes)
- LanguageService persistence chain fully wired: Transloco <-> localStorage <-> backend profile
- syncFromProfile() available for auth flow integration

## Self-Check: PASSED

All modified files verified present. All commit hashes (7a9a1d8, 2c57ef5) verified in git log.

---
*Phase: 27-localization-foundation*
*Completed: 2026-02-21*

---
phase: 27-localization-foundation
plan: 01
subsystem: ui
tags: [transloco, i18n, localization, angular, turkish]

# Dependency graph
requires: []
provides:
  - "@jsverse/transloco and @jsverse/transloco-locale packages installed"
  - "TranslocoHttpLoader for loading translation JSON files"
  - "LanguageService with browser detection, localStorage cache, and language switching"
  - "Global EN and TR translation files with common, nav, auth, userMenu, paginator, table, and validation keys"
  - "Transloco configured at app root with fallback to EN for missing keys"
  - "Turkish locale data registered for Angular Material DateAdapter"
affects: [27-02, 27-03, 27-04]

# Tech tracking
tech-stack:
  added: ["@jsverse/transloco@8.2.1", "@jsverse/transloco-locale@8.2.1"]
  patterns: ["TranslocoHttpLoader for translation file loading", "LanguageService as central language orchestrator", "localStorage-based language persistence with browser detection fallback"]

key-files:
  created:
    - "globcrm-web/src/app/core/i18n/transloco-loader.ts"
    - "globcrm-web/src/app/core/i18n/language.service.ts"
    - "globcrm-web/src/assets/i18n/en.json"
    - "globcrm-web/src/assets/i18n/tr.json"
  modified:
    - "globcrm-web/package.json"
    - "globcrm-web/angular.json"
    - "globcrm-web/src/app/app.config.ts"
    - "globcrm-web/src/app/app.component.ts"

key-decisions:
  - "LanguageService uses localStorage-only persistence; backend profile API integration deferred to Plan 02"
  - "Turkish locale data registered at app config level for Angular Material NativeDateAdapter support"
  - "missingHandler configured with useFallbackTranslation: true and logMissingKey: true for graceful degradation"

patterns-established:
  - "Translation files at src/assets/i18n/{lang}.json with nested key structure (common, nav, auth, userMenu)"
  - "LanguageService.switchLanguage() updates Transloco, document.documentElement.lang, and localStorage atomically"
  - "Language detection priority: localStorage > browser navigator.language > default 'en'"

requirements-completed: [LOCL-06]

# Metrics
duration: 3min
completed: 2026-02-21
---

# Phase 27 Plan 01: Transloco i18n Foundation Summary

**Transloco i18n infrastructure with TranslocoHttpLoader, LanguageService (browser detection + localStorage cache), and global EN/TR translation files covering common, nav, auth, and userMenu keys**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-21T07:10:10Z
- **Completed:** 2026-02-21T07:13:36Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Installed @jsverse/transloco and @jsverse/transloco-locale as the i18n foundation
- Created TranslocoHttpLoader and LanguageService with browser language detection, localStorage caching, and reactive currentLang signal
- Built comprehensive EN and TR global translation files with 50+ keys each covering common, nav, auth, userMenu, paginator, table, and validation scopes
- Wired Transloco providers into app.config.ts with EN default, TR available, fallback to EN for missing keys, and locale mapping to en-US/tr-TR
- Registered Turkish locale data and initialized language on app bootstrap via AppComponent constructor

## Task Commits

Each task was committed atomically:

1. **Task 1: Install Transloco packages, create loader and LanguageService, create global translation files** - `fd60da7` (feat)
2. **Task 2: Wire Transloco providers into app.config.ts and initialize language in app.component.ts** - `3dccbfd` (feat)

## Files Created/Modified
- `globcrm-web/src/app/core/i18n/transloco-loader.ts` - Injectable HTTP loader for translation JSON files
- `globcrm-web/src/app/core/i18n/language.service.ts` - Central language orchestrator with detection, switching, and reactive signal
- `globcrm-web/src/assets/i18n/en.json` - Global English translations (50+ keys)
- `globcrm-web/src/assets/i18n/tr.json` - Global Turkish translations (50+ keys with proper Turkish characters)
- `globcrm-web/package.json` - Added @jsverse/transloco and @jsverse/transloco-locale dependencies
- `globcrm-web/angular.json` - Added i18n asset paths to build and test configs
- `globcrm-web/src/app/app.config.ts` - Added provideTransloco, provideTranslocoLocale, Turkish locale registration
- `globcrm-web/src/app/app.component.ts` - Injected LanguageService and initialized language on bootstrap

## Decisions Made
- LanguageService uses localStorage-only persistence for now; backend profile API integration deferred to Plan 02 when the navbar language switcher is built
- Turkish locale data registered at app config level via registerLocaleData(localeTr) for Angular Material NativeDateAdapter support
- missingHandler configured with useFallbackTranslation: true so missing TR keys gracefully fall back to EN text without showing raw keys (LOCL-06)
- Language detection priority: localStorage > navigator.language > default 'en'

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- i18n infrastructure fully wired and building successfully
- Ready for Plan 02 (navbar language switcher and auth page localization)
- LanguageService.switchLanguage() ready for UI binding
- Translation file structure established for feature-scoped translations in Plans 03-04

## Self-Check: PASSED

All created files verified present. All commit hashes verified in git log.

---
*Phase: 27-localization-foundation*
*Completed: 2026-02-21*

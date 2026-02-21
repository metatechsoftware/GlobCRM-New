---
phase: 28-localization-string-extraction
plan: 11
subsystem: ui
tags: [transloco, i18n, angular, scope-loader, column-translation]

# Dependency graph
requires:
  - phase: 27-i18n-framework
    provides: TranslocoHttpLoader, LanguageService, provideTranslocoScope infrastructure
provides:
  - Scope-aware TranslocoHttpLoader that loads feature-scoped translation files
  - Immediate UI language switch from Settings language page
  - ColumnDefinition labelKey field for translated column headers
  - DynamicTable and ColumnPicker translation-ready infrastructure
affects: [28-12, all-entity-list-components, contacts, deals, companies, leads, tasks, products, quotes, requests]

# Tech tracking
tech-stack:
  added: []
  patterns: [TranslocoLoaderData scope parameter for scoped file loading, labelKey pattern for ColumnDefinition translation]

key-files:
  created: []
  modified:
    - globcrm-web/src/app/core/i18n/transloco-loader.ts
    - globcrm-web/src/app/features/settings/language/language-settings.component.ts
    - globcrm-web/src/app/shared/components/saved-views/view.models.ts
    - globcrm-web/src/app/shared/components/dynamic-table/dynamic-table.component.ts
    - globcrm-web/src/app/shared/components/dynamic-table/column-picker.component.ts

key-decisions:
  - "TranslocoLoaderData.scope used to construct scoped file path (assets/i18n/{scope}/{lang}.json)"
  - "LanguageService.switchLanguage() called in settings success handler for immediate UI update"
  - "labelKey checked before label in getColumnLabel/getLabel for backward-compatible translation"

patterns-established:
  - "labelKey pattern: ColumnDefinition.labelKey -> TranslocoService.translate() with label fallback for custom fields"

requirements-completed: [LOCL-03, LOCL-09, LOCL-10]

# Metrics
duration: 2min
completed: 2026-02-21
---

# Phase 28 Plan 11: Foundational Localization Fixes Summary

**Scope-aware TranslocoHttpLoader for feature translation files, immediate language switch in settings, and labelKey translation infrastructure for DynamicTable column headers**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-21T16:38:41Z
- **Completed:** 2026-02-21T16:40:29Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- TranslocoHttpLoader now loads scoped translation files (contacts/en.json, deals/en.json, etc.) when navigating to feature routes
- Settings > Language page switches the UI language immediately after saving via LanguageService.switchLanguage()
- ColumnDefinition interface supports optional labelKey for translation-ready column headers
- DynamicTable.getColumnLabel() and ColumnPicker.getLabel() translate labelKey via TranslocoService with raw label fallback

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix TranslocoHttpLoader scope support and Settings language immediate switch** - `ea0bd07` (fix)
2. **Task 2: Add labelKey to ColumnDefinition and translate in DynamicTable + ColumnPicker** - `e618b0b` (feat)

## Files Created/Modified
- `globcrm-web/src/app/core/i18n/transloco-loader.ts` - Added TranslocoLoaderData scope parameter for scoped file loading
- `globcrm-web/src/app/features/settings/language/language-settings.component.ts` - Added LanguageService.switchLanguage() call after DB save
- `globcrm-web/src/app/shared/components/saved-views/view.models.ts` - Added optional labelKey field to ColumnDefinition interface
- `globcrm-web/src/app/shared/components/dynamic-table/dynamic-table.component.ts` - Updated getColumnLabel() to translate labelKey when available
- `globcrm-web/src/app/shared/components/dynamic-table/column-picker.component.ts` - Added TranslocoService injection and getLabel() method for translated labels

## Decisions Made
- TranslocoLoaderData.scope used to construct scoped file path (assets/i18n/{scope}/{lang}.json) -- matches Transloco's built-in scope mechanism
- LanguageService.switchLanguage() called after successful DB save in settings (mirrors profile switcher pattern)
- labelKey checked before label in getColumnLabel/getLabel -- custom fields without labelKey continue to use raw label string

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Scoped translation file loading is now functional for all feature routes (contacts, deals, dashboard, settings, etc.)
- Entity list components can now adopt labelKey in their ColumnDefinition arrays
- Plan 12 can proceed with entity-specific column translations using this infrastructure

## Self-Check: PASSED

All 5 modified files verified present. Both task commits (ea0bd07, e618b0b) verified in git log.

---
*Phase: 28-localization-string-extraction*
*Completed: 2026-02-21*

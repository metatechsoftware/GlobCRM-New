---
phase: 28-localization-string-extraction
plan: 12
subsystem: ui
tags: [angular, transloco, i18n, entity-list, notifications, column-headers]

# Dependency graph
requires:
  - phase: 28-localization-string-extraction
    provides: "labelKey field on ColumnDefinition + scope-aware TranslocoHttpLoader (Plan 11)"
provides:
  - "Translated column headers for all 9 entity list pages via labelKey pattern"
  - "PascalCase enum-matched notification type translation keys for My Day widget"
  - "Translation-based notification preference labels/descriptions in Settings"
  - "Locale-aware relative time labels in notification digest widget"
affects: [28-localization-string-extraction]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "labelKey on coreColumnDefs with scope-prefixed translation keys ({scope}.columns.{fieldId})"
    - "Dual-key notification types (PascalCase enum + snake_case API) for universal resolution"
    - "TranslocoService.translate() for programmatic label/description lookup replacing hardcoded consts"

key-files:
  created: []
  modified:
    - "globcrm-web/src/app/features/contacts/contact-list/contact-list.component.ts"
    - "globcrm-web/src/app/features/deals/deal-list/deal-list.component.ts"
    - "globcrm-web/src/app/features/companies/company-list/company-list.component.ts"
    - "globcrm-web/src/app/features/leads/lead-list/lead-list.component.ts"
    - "globcrm-web/src/app/features/activities/activity-list/activity-list.component.ts"
    - "globcrm-web/src/app/features/products/product-list/product-list.component.ts"
    - "globcrm-web/src/app/features/quotes/quote-list/quote-list.component.ts"
    - "globcrm-web/src/app/features/requests/request-list/request-list.component.ts"
    - "globcrm-web/src/app/features/emails/email-list/email-list.component.ts"
    - "globcrm-web/src/assets/i18n/*/en.json (9 scopes)"
    - "globcrm-web/src/assets/i18n/*/tr.json (9 scopes)"
    - "globcrm-web/src/assets/i18n/my-day/en.json"
    - "globcrm-web/src/assets/i18n/my-day/tr.json"
    - "globcrm-web/src/assets/i18n/settings/en.json"
    - "globcrm-web/src/assets/i18n/settings/tr.json"
    - "globcrm-web/src/app/features/my-day/widgets/notification-digest-widget/notification-digest-widget.component.ts"
    - "globcrm-web/src/app/features/settings/notification-preferences/notification-preferences.component.ts"

key-decisions:
  - "Dual-key approach for notification types: both PascalCase (backend enum) and snake_case (MyDay API) keys in same JSON section for universal resolution"
  - "toLocaleUpperCase() replaces toUpperCase() in notification widget fallback for Turkish I/i safety"
  - "Products component uses module-level PRODUCT_CORE_COLUMNS const (not instance property) so labelKey added at module level"
  - "Emails component skips labelKey for isRead/isStarred/hasAttachments columns (empty string labels, icon-only columns)"

patterns-established:
  - "labelKey pattern: all 9 entity list coreColumnDefs use '{scope}.columns.{fieldId}' with raw label as fallback"
  - "Notification type translation: dual PascalCase+snake_case keys in my-day scope JSON"
  - "Settings notification prefs: transloco.translate() with typeLabels/typeDescriptions namespace replaces hardcoded consts"

requirements-completed: [LOCL-03, LOCL-09]

# Metrics
duration: 6min
completed: 2026-02-21
---

# Phase 28 Plan 12: Entity Column Header Translations and Notification Key Fixes Summary

**All 9 entity list column headers translate via labelKey pattern, notification types use enum-matched keys, and notification preferences use transloco instead of hardcoded English**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-02-21T16:46:00Z
- **Completed:** 2026-02-21T16:48:03Z
- **Tasks:** 2
- **Files modified:** 33

## Accomplishments
- Added labelKey to coreColumnDefs in all 9 entity list components (contacts, deals, companies, leads, activities, products, quotes, requests, emails) with corresponding EN/TR translations in scope JSONs
- Fixed notification type translation key mismatch by adding PascalCase enum-matched keys alongside existing snake_case keys in my-day scope JSONs
- Replaced hardcoded NOTIFICATION_TYPE_LABELS and NOTIFICATION_TYPE_DESCRIPTIONS consts with TranslocoService.translate() calls in notification-preferences component
- Fixed Turkish locale safety by replacing toUpperCase() with toLocaleUpperCase() in notification digest widget fallback
- Replaced hardcoded English relative time strings (just now, Xm, Xh) with transloco translation keys

## Task Commits

Each task was committed atomically:

1. **Task 1: Convert all entity list coreColumnDefs to use labelKey and add column translation keys to scope JSONs** - `d78d713` (feat)
2. **Task 2: Fix notification type translation key mismatch and hardcoded labels** - `f84bfef` (fix)

**Plan metadata:** _(pending)_ (docs: complete plan)

## Files Created/Modified

### Task 1 (27 files)
- `globcrm-web/src/app/features/contacts/contact-list/contact-list.component.ts` - Added labelKey to 9 core columns
- `globcrm-web/src/app/features/deals/deal-list/deal-list.component.ts` - Added labelKey to 10 core columns
- `globcrm-web/src/app/features/companies/company-list/company-list.component.ts` - Added labelKey to 8 core columns
- `globcrm-web/src/app/features/leads/lead-list/lead-list.component.ts` - Added labelKey to 11 core columns
- `globcrm-web/src/app/features/activities/activity-list/activity-list.component.ts` - Added labelKey to 9 core columns
- `globcrm-web/src/app/features/products/product-list/product-list.component.ts` - Added labelKey to 6 core columns
- `globcrm-web/src/app/features/quotes/quote-list/quote-list.component.ts` - Added labelKey to 11 core columns
- `globcrm-web/src/app/features/requests/request-list/request-list.component.ts` - Added labelKey to 10 core columns
- `globcrm-web/src/app/features/emails/email-list/email-list.component.ts` - Added labelKey to 5 core columns (3 icon-only skipped)
- `globcrm-web/src/assets/i18n/{contacts,deals,companies,leads,activities,products,quotes,requests,emails}/en.json` - Added columns section
- `globcrm-web/src/assets/i18n/{contacts,deals,companies,leads,activities,products,quotes,requests,emails}/tr.json` - Added columns section with proper Turkish Unicode

### Task 2 (6 files)
- `globcrm-web/src/app/features/my-day/widgets/notification-digest-widget/notification-digest-widget.component.ts` - Fixed toLocaleUpperCase fallback, replaced hardcoded relativeTime with transloco translate
- `globcrm-web/src/app/features/settings/notification-preferences/notification-preferences.component.ts` - Removed NOTIFICATION_TYPE_LABELS/DESCRIPTIONS consts, replaced with transloco.translate()
- `globcrm-web/src/assets/i18n/my-day/en.json` - Added PascalCase enum keys + time section
- `globcrm-web/src/assets/i18n/my-day/tr.json` - Added PascalCase enum keys + time section
- `globcrm-web/src/assets/i18n/settings/en.json` - Added typeLabels + typeDescriptions sections
- `globcrm-web/src/assets/i18n/settings/tr.json` - Added typeLabels + typeDescriptions sections

## Decisions Made
- Used dual-key approach (PascalCase + snake_case) for notification types to support both backend enum values and MyDay API grouping without breaking either consumer
- Used toLocaleUpperCase() instead of toUpperCase() for Turkish I/i safety in notification widget humanize fallback
- Products component had module-level const (not instance property) so labelKey was added at that level
- Skipped labelKey for icon-only email columns (isRead, isStarred, hasAttachments) that have empty string labels

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All 9 entity list pages now support translated column headers via the labelKey pattern established in Plan 11
- Notification type translations cover both PascalCase enum values and snake_case API grouping keys
- Phase 28 gap closure complete -- all UAT issues addressed across Plans 11 and 12
- Ready for Phase 29 checkpoint verification and Phase 30+ planning

## Self-Check: PASSED

- All 2 commits verified (d78d713, f84bfef)
- All 11 key component files verified present
- SUMMARY.md file verified present

---
*Phase: 28-localization-string-extraction*
*Completed: 2026-02-21*

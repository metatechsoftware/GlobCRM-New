---
phase: 28-localization-string-extraction
plan: 03
subsystem: ui
tags: [transloco, angular, i18n, activities, products, quotes, requests]

# Dependency graph
requires:
  - phase: 27-localization-foundation
    provides: "Transloco infrastructure, scoped translation lazy-loading pattern"
provides:
  - "Activities feature translation scope (en/tr) with ~165 keys"
  - "Products feature translation scope (en/tr) with ~75 keys"
  - "Quotes feature translation scope (en/tr) with ~140 keys"
  - "Requests feature translation scope (en/tr) with ~65 keys"
  - "All 4 feature routes wired with provideTranslocoScope"
affects: [28-localization-string-extraction]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "TranslocoService injected for programmatic translations in snackBar.open calls"
    - "mat-tab label binding uses [label] property with transloco pipe for dynamic tab labels"

key-files:
  created:
    - globcrm-web/src/assets/i18n/activities/en.json
    - globcrm-web/src/assets/i18n/activities/tr.json
    - globcrm-web/src/assets/i18n/products/en.json
    - globcrm-web/src/assets/i18n/products/tr.json
    - globcrm-web/src/assets/i18n/quotes/en.json
    - globcrm-web/src/assets/i18n/quotes/tr.json
    - globcrm-web/src/assets/i18n/requests/en.json
    - globcrm-web/src/assets/i18n/requests/tr.json
  modified:
    - globcrm-web/src/app/features/activities/activities.routes.ts
    - globcrm-web/src/app/features/products/products.routes.ts
    - globcrm-web/src/app/features/quotes/quotes.routes.ts
    - globcrm-web/src/app/features/requests/requests.routes.ts
    - globcrm-web/src/app/features/quotes/quote-detail/quote-detail.component.ts
    - globcrm-web/src/app/features/quotes/quote-detail/quote-detail.component.html
    - globcrm-web/src/app/features/quotes/quote-form/quote-form.component.ts
    - globcrm-web/src/app/features/quotes/quote-list/quote-list.component.ts
    - globcrm-web/src/app/features/quotes/quote-list/quote-list.component.html
    - globcrm-web/src/app/features/requests/request-detail/request-detail.component.ts
    - globcrm-web/src/app/features/requests/request-form/request-form.component.ts
    - globcrm-web/src/app/features/requests/request-list/request-list.component.ts

key-decisions:
  - "Used TranslocoService.translate() for snackBar messages and getTransitionLabel methods since these are programmatic TS calls"
  - "Used [label] property binding with transloco pipe for mat-tab labels to support dynamic translation"

patterns-established:
  - "Inline template components use same transloco pipe pattern as external template components"
  - "getTransitionLabel() switch-case methods use TranslocoService.translate() for each case"

requirements-completed: [LOCL-03, LOCL-10]

# Metrics
duration: 25min
completed: 2026-02-21
---

# Phase 28 Plan 03: Activities/Products/Quotes/Requests i18n Summary

**Transloco scoped translation files (en/tr) for activities, products, quotes, and requests with ~445 total translation keys wired to all component templates**

## Performance

- **Duration:** 25 min
- **Started:** 2026-02-21T10:23:19Z
- **Completed:** 2026-02-21T10:48:00Z
- **Tasks:** 2
- **Files modified:** 22

## Accomplishments
- Created 8 translation scope JSON files (4 features x 2 languages) with ~445 total keys
- Wired provideTranslocoScope in all 4 feature route files using parent route wrapper pattern
- Replaced all hardcoded English strings with transloco pipe bindings across 12 component files
- Added TranslocoService for programmatic translations in snackBar messages and status transition labels

## Task Commits

Each task was committed atomically:

1. **Task 1: Activities + Products translation scopes** - `594416b` (feat) - committed in prior session
2. **Task 2: Quotes + Requests translation scopes** - `1240284` (feat)

## Files Created/Modified

### Translation Files (Created)
- `assets/i18n/activities/en.json` - Activities English translations (~165 keys)
- `assets/i18n/activities/tr.json` - Activities Turkish translations
- `assets/i18n/products/en.json` - Products English translations (~75 keys)
- `assets/i18n/products/tr.json` - Products Turkish translations
- `assets/i18n/quotes/en.json` - Quotes English translations (~140 keys)
- `assets/i18n/quotes/tr.json` - Quotes Turkish translations
- `assets/i18n/requests/en.json` - Requests English translations (~65 keys)
- `assets/i18n/requests/tr.json` - Requests Turkish translations

### Route Files (Modified)
- `features/activities/activities.routes.ts` - provideTranslocoScope('activities')
- `features/products/products.routes.ts` - provideTranslocoScope('products')
- `features/quotes/quotes.routes.ts` - provideTranslocoScope('quotes')
- `features/requests/requests.routes.ts` - provideTranslocoScope('requests')

### Component Files (Modified)
- Activity: list, detail, form, kanban, calendar components
- Product: list, detail, form components
- Quote: list, detail, form components (detail + form include TranslocoService)
- Request: list, detail, form components (detail + form include TranslocoService)

## Decisions Made
- Used TranslocoService.translate() for snackBar.open() calls and getTransitionLabel() methods since these are programmatic TS calls that cannot use the pipe
- Used [label] property binding with transloco pipe for mat-tab labels (`[label]="'key' | transloco"`) to enable dynamic translation
- Used `common.cancel` global key for cancel buttons instead of feature-scoped keys

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Task 1 (activities + products) was already committed in a prior session as part of commit `594416b`. Verified via git log and diff that all work was present. Proceeded directly to Task 2.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- 4 more feature scopes fully localized, ready for remaining plans in phase 28
- Pattern established for inline template components (quotes/requests) is identical to external template pattern

## Self-Check: PASSED

- All 8 translation JSON files exist on disk
- All 4 route files modified with provideTranslocoScope
- Commit 594416b (Task 1) found in git log
- Commit 1240284 (Task 2) found in git log
- SUMMARY.md created at expected path

---
*Phase: 28-localization-string-extraction*
*Completed: 2026-02-21*

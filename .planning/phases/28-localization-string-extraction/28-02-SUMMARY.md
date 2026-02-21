---
phase: 28-localization-string-extraction
plan: 02
subsystem: ui
tags: [transloco, i18n, angular, translations, deals, companies, leads, contacts]

# Dependency graph
requires:
  - phase: 28-localization-string-extraction
    plan: 01
    provides: "Extended global EN/TR JSON files with 235 keys, 17 shared components wired with TranslocoPipe"
  - phase: 27-localization-foundation
    provides: "Contacts translation scope files (en.json, tr.json), provideTranslocoScope in contacts.routes.ts"
provides:
  - "Three new translation scopes (deals, companies, leads) with EN/TR JSON files totaling 351 keys"
  - "Extended contacts scope from 50 to 145+ keys covering all detail, form, and message strings"
  - "16+ component templates in 4 feature areas fully wired with transloco pipe references"
  - "All snackBar.open() calls in core entity features use TranslocoService.translate()"
affects: [28-03-PLAN, 28-04-PLAN, 28-05-PLAN, 28-06-PLAN, 28-07-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Feature-scoped translation keys follow page-section grouping: list.*, detail.*, form.*, kanban.*, convert.*, messages.*"
    - "provideTranslocoScope in route files wraps child routes in parent route with providers array"
    - "TranslocoService.translate() for programmatic translations in snackBar.open() calls"
    - "Parameterized translations with {{param}} syntax for dynamic values (stage names, contact names)"
    - "Global common.* keys used for shared labels (edit, delete, cancel, close) across all features"

key-files:
  created:
    - "globcrm-web/src/assets/i18n/deals/en.json"
    - "globcrm-web/src/assets/i18n/deals/tr.json"
    - "globcrm-web/src/assets/i18n/companies/en.json"
    - "globcrm-web/src/assets/i18n/companies/tr.json"
    - "globcrm-web/src/assets/i18n/leads/en.json"
    - "globcrm-web/src/assets/i18n/leads/tr.json"
  modified:
    - "globcrm-web/src/assets/i18n/contacts/en.json"
    - "globcrm-web/src/assets/i18n/contacts/tr.json"
    - "globcrm-web/src/app/features/deals/deals.routes.ts"
    - "globcrm-web/src/app/features/deals/deal-list/deal-list.component.ts"
    - "globcrm-web/src/app/features/deals/deal-list/deal-list.component.html"
    - "globcrm-web/src/app/features/deals/deal-detail/deal-detail.component.ts"
    - "globcrm-web/src/app/features/deals/deal-detail/deal-detail.component.html"
    - "globcrm-web/src/app/features/deals/deal-form/deal-form.component.ts"
    - "globcrm-web/src/app/features/deals/deal-form/deal-form.component.html"
    - "globcrm-web/src/app/features/deals/deal-kanban/deal-kanban.component.ts"
    - "globcrm-web/src/app/features/deals/deal-kanban/deal-kanban.component.html"
    - "globcrm-web/src/app/features/deals/deal-calendar/deal-calendar.component.ts"
    - "globcrm-web/src/app/features/deals/deal-calendar/deal-calendar.component.html"
    - "globcrm-web/src/app/features/companies/companies.routes.ts"
    - "globcrm-web/src/app/features/companies/company-list/company-list.component.ts"
    - "globcrm-web/src/app/features/companies/company-list/company-list.component.html"
    - "globcrm-web/src/app/features/companies/company-detail/company-detail.component.ts"
    - "globcrm-web/src/app/features/companies/company-detail/company-detail.component.html"
    - "globcrm-web/src/app/features/companies/company-form/company-form.component.ts"
    - "globcrm-web/src/app/features/companies/company-form/company-form.component.html"
    - "globcrm-web/src/app/features/leads/leads.routes.ts"
    - "globcrm-web/src/app/features/leads/lead-list/lead-list.component.ts"
    - "globcrm-web/src/app/features/leads/lead-list/lead-list.component.html"
    - "globcrm-web/src/app/features/leads/lead-detail/lead-detail.component.ts"
    - "globcrm-web/src/app/features/leads/lead-detail/lead-detail.component.html"
    - "globcrm-web/src/app/features/leads/lead-form/lead-form.component.ts"
    - "globcrm-web/src/app/features/leads/lead-form/lead-form.component.html"
    - "globcrm-web/src/app/features/leads/lead-kanban/lead-kanban.component.ts"
    - "globcrm-web/src/app/features/leads/lead-kanban/lead-kanban.component.html"
    - "globcrm-web/src/app/features/leads/lead-convert/lead-convert-dialog.component.ts"
    - "globcrm-web/src/app/features/leads/lead-convert/lead-convert-dialog.component.html"
    - "globcrm-web/src/app/features/contacts/contact-list/contact-list.component.ts"
    - "globcrm-web/src/app/features/contacts/contact-list/contact-list.component.html"
    - "globcrm-web/src/app/features/contacts/contact-detail/contact-detail.component.ts"
    - "globcrm-web/src/app/features/contacts/contact-detail/contact-detail.component.html"
    - "globcrm-web/src/app/features/contacts/contact-form/contact-form.component.ts"
    - "globcrm-web/src/app/features/contacts/contact-form/contact-form.component.html"

key-decisions:
  - "Contacts scope JSON extended from ~50 to ~145 keys to cover all detail page tabs, form fields, and messages"
  - "Lead conversion dialog uses scoped leads translation keys (convert.*) since it is opened from lead-detail within the leads scope"
  - "Temperature toggle values (Hot/Warm/Cold) translated in form but dynamic kanban card values kept as-is since they come from the lead model"
  - "Stage names and source names are API-provided dynamic data and not translated"
  - "Turkish translations use Lead as English loanword per Phase 28 CONTEXT.md convention"

patterns-established:
  - "deals scope: list.*, detail.contacts.*, detail.products.*, detail.activities.*, detail.quotes.*, detail.notes.*, form.*, kanban.*, calendar.*, messages.*"
  - "companies scope: list.*, detail.contacts.*, detail.deals.*, detail.activities.*, detail.quotes.*, detail.requests.*, detail.emails.*, detail.notes.*, form.*, messages.*"
  - "leads scope: list.*, detail.activities.*, detail.notes.*, detail.conversion.*, form.*, kanban.*, convert.*, messages.*"
  - "contacts scope: list.*, detail.sections.*, detail.company.*, detail.deals.*, detail.activities.*, detail.quotes.*, detail.requests.*, detail.emails.*, detail.notes.*, form.*, messages.*"

requirements-completed: [LOCL-03, LOCL-10]

# Metrics
duration: ~25min
completed: 2026-02-21
---

# Phase 28 Plan 02: Core Entity Features i18n Summary

**351 new translation keys (EN+TR) across 3 new scopes + 95 extended contacts keys, with 16 component templates fully wired with transloco pipe**

## Performance

- **Duration:** ~25 min (across two sessions)
- **Completed:** 2026-02-21
- **Tasks:** 2
- **Files created:** 6
- **Files modified:** 37

## Accomplishments

- Created deals translation scope with 116 keys (EN+TR) covering list, detail (contacts/products/activities/quotes/notes), form, kanban, calendar, and messages
- Created companies translation scope with 89 keys (EN+TR) covering list, detail (contacts/deals/activities/quotes/requests/emails/notes), form, and messages
- Created leads translation scope with 146 keys (EN+TR) covering list, detail (activities/notes/conversion), form, kanban, convert dialog, and messages
- Extended contacts scope from ~50 to ~145 keys adding detail sections, tabs, company, deals, activities, quotes, requests, emails, notes, form fields/validation, and messages
- Wired provideTranslocoScope in deals.routes.ts, companies.routes.ts, leads.routes.ts
- Replaced all hardcoded English strings in 16 component templates with transloco pipe references
- Translated all snackBar.open() calls (~60+) across all four feature areas to use TranslocoService.translate()
- Turkish translations use formal register with English loanwords preserved (Pipeline, Lead, Kanban, CRM)
- Angular builds without errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Create deals, companies, and leads translation scope JSON files** - `458b0e8` (feat)
   - 6 files created, 926 insertions
   - EN/TR key parity verified: deals 116/116, companies 89/89, leads 146/146

2. **Task 2: Wire scopes in routes and replace hardcoded strings** - `c8a66a5` (feat)
   - 37 files changed, 916 insertions, 632 deletions
   - Deals: list, detail, form, kanban, calendar (5 components)
   - Companies: list, detail, form (3 components)
   - Leads: list, detail, form, kanban, convert dialog (5 components)
   - Contacts: list, detail, form (3 components)
   - Contacts EN/TR JSON extended with ~95 new keys

## Component Coverage

| Feature | Components | Scope Keys | snackBar Messages |
|---------|-----------|------------|-------------------|
| Deals | 5 (list, detail, form, kanban, calendar) | 116 | ~10 |
| Companies | 3 (list, detail, form) | 89 | ~6 |
| Leads | 5 (list, detail, form, kanban, convert) | 146 | ~18 |
| Contacts | 3 (list, detail, form) | ~145 | ~8 |
| **Total** | **16** | **~496** | **~42** |

## Decisions Made

- Contacts scope JSON extended from ~50 to ~145 keys since Phase 27 only created initial keys for list/detail/form titles
- Lead conversion dialog uses scoped leads keys (convert.*) since it is opened from lead-detail within the leads route scope
- Temperature toggle values translated in form template but dynamic kanban card values from lead model left as-is
- Stage names, source names, pipeline names are API-provided dynamic data and not translated
- Turkish translations use "Lead" as English loanword per Phase 28 CONTEXT.md convention

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing functionality] Extended contacts JSON scope files**
- **Found during:** Task 2 (contacts template wiring)
- **Issue:** Phase 27 contacts JSON had only ~50 keys covering list/detail titles and basic fields. Templates required ~145 keys for full coverage including detail page tabs, company section, activities, quotes, requests, emails, notes, form validation, and messages.
- **Fix:** Extended both contacts en.json and tr.json with ~95 additional keys before wiring templates
- **Files modified:** contacts/en.json, contacts/tr.json

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All four core CRM entity features (deals, companies, leads, contacts) are fully i18n-ready
- Feature-scoped translation files and route wiring established for remaining plans (28-03 through 28-07)
- The pattern of provideTranslocoScope in routes + TranslocoPipe in components + TranslocoService for programmatic use is proven and consistent

## Self-Check: PASSED

- FOUND: globcrm-web/src/assets/i18n/deals/en.json
- FOUND: globcrm-web/src/assets/i18n/deals/tr.json
- FOUND: globcrm-web/src/assets/i18n/companies/en.json
- FOUND: globcrm-web/src/assets/i18n/companies/tr.json
- FOUND: globcrm-web/src/assets/i18n/leads/en.json
- FOUND: globcrm-web/src/assets/i18n/leads/tr.json
- FOUND: globcrm-web/src/assets/i18n/contacts/en.json (extended)
- FOUND: globcrm-web/src/assets/i18n/contacts/tr.json (extended)
- FOUND: commit 458b0e8 (Task 1)
- FOUND: commit c8a66a5 (Task 2)

---
*Phase: 28-localization-string-extraction*
*Completed: 2026-02-21*

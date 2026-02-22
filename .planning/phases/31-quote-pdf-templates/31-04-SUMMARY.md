---
phase: 31-quote-pdf-templates
plan: 04
subsystem: ui
tags: [quote-templates, card-grid, template-list, routes, settings-hub, template-selector, pdf-generation, angular-material]

# Dependency graph
requires:
  - phase: 31-quote-pdf-templates-02
    provides: QuoteTemplatesController CRUD endpoints, QuoteTemplateService API
  - phase: 31-quote-pdf-templates-03
    provides: QuoteTemplateEditorComponent, QuoteTemplateStore, QuoteTemplateService, quote-template.models
provides:
  - QuoteTemplateListComponent with card grid layout, thumbnail previews, and management actions (clone/delete/set-default)
  - QUOTE_TEMPLATE_ROUTES lazy-loaded routes file for list and editor
  - App.routes.ts integration with auth and permission guards
  - Settings hub "Quote Templates" card for discoverability
  - Quote detail page template selector for PDF generation with default template auto-selection
  - Quote detail "Manage Templates" navigation link
  - English and Turkish i18n translations for all new UI
affects: [31-05]

# Tech tracking
tech-stack:
  added: []
  patterns: [card grid with A4-aspect thumbnail placeholders, template selector on detail page for PDF generation, route-level store provision for shared state]

key-files:
  created:
    - globcrm-web/src/app/features/quote-templates/quote-template-list/quote-template-list.component.ts
    - globcrm-web/src/app/features/quote-templates/quote-template-list/quote-template-list.component.html
    - globcrm-web/src/app/features/quote-templates/quote-template-list/quote-template-list.component.scss
    - globcrm-web/src/app/features/quote-templates/quote-templates.routes.ts
  modified:
    - globcrm-web/src/app/app.routes.ts
    - globcrm-web/src/app/features/settings/settings-hub.component.ts
    - globcrm-web/src/app/features/quotes/quote-detail/quote-detail.component.ts
    - globcrm-web/src/app/features/quotes/quote-detail/quote-detail.component.html
    - globcrm-web/src/app/features/quotes/quote-detail/quote-detail.component.scss
    - globcrm-web/src/assets/i18n/en.json
    - globcrm-web/src/assets/i18n/tr.json
    - globcrm-web/src/assets/i18n/quotes/en.json
    - globcrm-web/src/assets/i18n/quotes/tr.json
    - globcrm-web/src/assets/i18n/settings/en.json
    - globcrm-web/src/assets/i18n/settings/tr.json

key-decisions:
  - "QuoteTemplateStore provided at route level (not component level) following BoardStore pattern so list and editor share state"
  - "Template selector auto-selects default template on load, falls back to built-in QuestPDF when no templates exist"
  - "Clone has no dialog -- instant copy with auto-naming per CONTEXT.md decision"
  - "Card grid uses A4 aspect ratio (210/297) for thumbnails to match page proportions"
  - "Quote detail PDF generation uses QuoteTemplateService.generatePdf (not QuoteService) to support optional templateId parameter"

patterns-established:
  - "Template selector pattern: load available templates on detail page init, auto-select default, pass templateId to PDF generation"
  - "Card grid with thumbnail aspect ratio matching output format (A4 portrait)"

requirements-completed: [QTPL-06, QTPL-07, QTPL-08, QTPL-12]

# Metrics
duration: 7min
completed: 2026-02-22
---

# Phase 31 Plan 04: Template List and Navigation Summary

**Card grid template management page with A4 thumbnail previews, clone/delete/set-default actions, lazy-loaded routes, settings hub integration, and quote detail template selector for PDF generation**

## Performance

- **Duration:** 7 min
- **Started:** 2026-02-22T06:27:38Z
- **Completed:** 2026-02-22T06:34:26Z
- **Tasks:** 2
- **Files modified:** 15

## Accomplishments
- Template list component with responsive card grid, A4-aspect thumbnail placeholders, three-dot menu actions (edit, clone, set-default, delete), default badge, and Fraunces italic empty state
- Lazy-loaded routes for /quote-templates with QuoteTemplateStore at route level, app.routes.ts entry with auth and permission guards
- Settings hub "Quote Templates" card in Organization section for QTPL-12 discoverability
- Quote detail page template selector dropdown with auto-selection of default template, and "Manage Templates" navigation link
- Full English and Turkish i18n translations for all new UI elements

## Task Commits

Each task was committed atomically:

1. **Task 1: Create template list component with card grid and management actions** - `f40c217` (feat)
2. **Task 2: Set up routes, navigation integration, and quote detail shortcut** - `a317bc3` (feat)

## Files Created/Modified
- `globcrm-web/src/app/features/quote-templates/quote-template-list/quote-template-list.component.ts` - Card grid list component with clone, delete, set-default, edit actions
- `globcrm-web/src/app/features/quote-templates/quote-template-list/quote-template-list.component.html` - Template with card grid, thumbnail previews, three-dot menu, empty state
- `globcrm-web/src/app/features/quote-templates/quote-template-list/quote-template-list.component.scss` - Responsive grid styles with design system compliance
- `globcrm-web/src/app/features/quote-templates/quote-templates.routes.ts` - Lazy-loaded routes for list, new, edit with route-level store
- `globcrm-web/src/app/app.routes.ts` - Added quote-templates route with authGuard and permissionGuard
- `globcrm-web/src/app/features/settings/settings-hub.component.ts` - Added Quote Templates card to Organization section
- `globcrm-web/src/app/features/quotes/quote-detail/quote-detail.component.ts` - Template selector state, loadTemplates, templateId in PDF generation
- `globcrm-web/src/app/features/quotes/quote-detail/quote-detail.component.html` - Template selector dropdown and Manage Templates link
- `globcrm-web/src/app/features/quotes/quote-detail/quote-detail.component.scss` - Template selector and PDF actions styling
- `globcrm-web/src/assets/i18n/en.json` - QuoteTemplates section with list, editor, and messages keys
- `globcrm-web/src/assets/i18n/tr.json` - Turkish translations for quoteTemplates section
- `globcrm-web/src/assets/i18n/quotes/en.json` - Template selector and manage templates action keys
- `globcrm-web/src/assets/i18n/quotes/tr.json` - Turkish translations for template actions
- `globcrm-web/src/assets/i18n/settings/en.json` - Quote Templates settings hub item keys
- `globcrm-web/src/assets/i18n/settings/tr.json` - Turkish settings hub item keys

## Decisions Made
- QuoteTemplateStore provided at route level (not component level) following BoardStore pattern so list and editor share state
- Template selector auto-selects default template on load, falls back to built-in QuestPDF when no templates exist
- Clone action is instant with no dialog (per CONTEXT.md: "Clone creates instant copy with name '[Original] (Copy)' -- no dialog")
- Card grid uses A4 aspect ratio (210/297) for thumbnail placeholders to match document proportions
- Quote detail PDF generation routed through QuoteTemplateService.generatePdf (not QuoteService) to support optional templateId parameter for dual-path PDF generation

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added i18n translation keys for all new UI elements**
- **Found during:** Task 1 and Task 2
- **Issue:** Plan specified transloco translation keys in templates but didn't include creating the actual translation JSON entries
- **Fix:** Added quoteTemplates section to global en.json/tr.json, template selector keys to quotes scope en/tr, settings hub keys to settings scope en/tr
- **Files modified:** en.json, tr.json, quotes/en.json, quotes/tr.json, settings/en.json, settings/tr.json
- **Verification:** Angular build compiles successfully
- **Committed in:** a317bc3 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical - i18n keys)
**Impact on plan:** Essential for UI text rendering. No scope creep.

## Issues Encountered
- Angular build cache corruption (TypeScript .tsbuildinfo path comparison failure) -- resolved by clearing .angular/cache directory

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Template list, editor, and routes fully wired -- ready for Plan 05 (integration testing, starter templates, and polish)
- All CRUD actions functional through QuoteTemplateStore
- PDF generation supports template selection from quote detail page

## Self-Check: PASSED

- All 4 created files verified on disk
- Both commit hashes (f40c217, a317bc3) verified in git log
- Angular build compiles successfully

---
*Phase: 31-quote-pdf-templates*
*Completed: 2026-02-22*

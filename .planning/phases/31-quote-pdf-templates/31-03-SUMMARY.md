---
phase: 31-quote-pdf-templates
plan: 03
subsystem: ui
tags: [quote-templates, unlayer, angular, signal-store, merge-tags, document-mode, pdf-templates]

# Dependency graph
requires:
  - phase: 31-quote-pdf-templates-02
    provides: QuoteTemplatesController with CRUD, clone, set-default, preview, merge-fields endpoints
  - phase: 14-email-templates
    provides: EmailEditorModule (angular-email-editor), email template editor pattern, merge tag configuration
provides:
  - QuoteTemplate and QuoteTemplateListItem TypeScript interfaces matching backend DTOs
  - QuoteTemplateService with full CRUD, clone, set-default, merge fields, preview (text), and PDF generation (blob) API calls
  - QuoteTemplateStore with callback-based async methods (route-level provided, not root)
  - QuoteTemplateEditorComponent with Unlayer web displayMode, 6-category merge tags with line items repeat rules, page settings toolbar
affects: [31-04, 31-05]

# Tech tracking
tech-stack:
  added: []
  patterns: [Unlayer web displayMode for document layout (not email), route-level signal store for shared state across list/editor, hardcoded merge tags with color-coded entity categories]

key-files:
  created:
    - globcrm-web/src/app/features/quote-templates/quote-template.models.ts
    - globcrm-web/src/app/features/quote-templates/quote-template.service.ts
    - globcrm-web/src/app/features/quote-templates/quote-template.store.ts
    - globcrm-web/src/app/features/quote-templates/quote-template-editor/quote-template-editor.component.ts
    - globcrm-web/src/app/features/quote-templates/quote-template-editor/quote-template-editor.component.html
    - globcrm-web/src/app/features/quote-templates/quote-template-editor/quote-template-editor.component.scss
  modified: []

key-decisions:
  - "Merge tags hardcoded in component (not loaded from API) for immediate editor availability -- API merge-fields endpoint available for future dynamic loading"
  - "QuoteTemplateStore provided at route level (not root) so list and editor pages share state instance"
  - "No merge field side panel (unlike email templates) -- quote merge tags accessed via Unlayer built-in dropdown per CONTEXT.md decision"
  - "QuoteTemplateService uses HttpClient directly for text (preview) and blob (PDF) responses alongside ApiService for JSON endpoints"

patterns-established:
  - "Unlayer web displayMode pattern: editorOptions computed signal with displayMode 'web' for full-page document layout"
  - "Color-coded merge tag groups: entity-specific colors (orange, blue, green, yellow, purple) for visual chip differentiation in Unlayer"
  - "Line items repeat rules: Fluid {% for %} loop via Unlayer merge tag rules.repeat (before/after) for server-side iteration"

requirements-completed: [QTPL-01, QTPL-02, QTPL-09]

# Metrics
duration: 4min
completed: 2026-02-22
---

# Phase 31 Plan 03: Frontend Editor Foundation Summary

**Unlayer-based quote template editor with web displayMode, 6-category color-coded merge tags (including line items repeat rules), page settings toolbar, and signal store for state management**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-22T06:20:16Z
- **Completed:** 2026-02-22T06:24:13Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Frontend models (QuoteTemplate, QuoteTemplateListItem, requests, MergeTagGroup) matching backend DTOs exactly
- QuoteTemplateService with 9 API methods covering full CRUD, clone, set-default, merge fields, preview (text response), and PDF generation (blob response)
- QuoteTemplateStore with callback-based async methods for templates, merge fields, and all mutation operations
- Full-page Unlayer template editor with `displayMode: 'web'` for document layout (not email-constrained 600px)
- 39 merge tags across 6 categories (quote, line_items, contact, company, deal, organization) with entity-specific colors
- Line items category includes Fluid `{% for %}` loop repeat rules for server-side template rendering
- Editor toolbar with template name input, page size (A4/Letter), orientation (portrait/landscape), default toggle, and save button

## Task Commits

Each task was committed atomically:

1. **Task 1: Create frontend models, API service, and signal store** - `6f4ddca` (feat)
2. **Task 2: Create full-page Unlayer template editor component** - `744cd76` (feat)

## Files Created/Modified
- `globcrm-web/src/app/features/quote-templates/quote-template.models.ts` - TypeScript interfaces for QuoteTemplate, QuoteTemplateListItem, request types, MergeTagGroup
- `globcrm-web/src/app/features/quote-templates/quote-template.service.ts` - API service with CRUD, clone, set-default, merge fields, preview (text), PDF (blob) endpoints
- `globcrm-web/src/app/features/quote-templates/quote-template.store.ts` - Signal store with callback-based async methods, route-level provided
- `globcrm-web/src/app/features/quote-templates/quote-template-editor/quote-template-editor.component.ts` - Full-page Unlayer editor with web displayMode, merge tag builder, save flow
- `globcrm-web/src/app/features/quote-templates/quote-template-editor/quote-template-editor.component.html` - Toolbar with name/page size/orientation/default/save + full-height Unlayer editor
- `globcrm-web/src/app/features/quote-templates/quote-template-editor/quote-template-editor.component.scss` - Full viewport layout with design system tokens, responsive breakpoints

## Decisions Made
- Merge tags hardcoded in component (buildQuoteMergeTags method) rather than dynamically loaded from API merge-fields endpoint -- provides immediate editor availability without API dependency; API endpoint still available for future enhancement
- QuoteTemplateStore provided at route level (not providedIn root) following BoardStore pattern from Phase 30 so list and editor pages share the same state instance
- No merge field side panel in editor (unlike EmailTemplateEditorComponent) -- per CONTEXT.md decision, quote merge tags are accessed via Unlayer's built-in merge tag dropdown in the text toolbar
- QuoteTemplateService uses HttpClient directly for text (preview HTML) and blob (PDF file) responses since ApiService only handles JSON

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None - both tasks compiled successfully on first attempt.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Editor component ready for wiring into routes (Plan 04 will create routes and template list)
- Models and store ready for template list/management components
- Service supports all API endpoints for full template lifecycle
- Merge tags include all categories needed for template design

## Self-Check: PASSED

All 6 key files verified as existing. Both task commits (6f4ddca, 744cd76) verified in git log.

---
*Phase: 31-quote-pdf-templates*
*Completed: 2026-02-22*

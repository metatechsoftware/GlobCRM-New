---
phase: 31-quote-pdf-templates
plan: 02
subsystem: api
tags: [quote-templates, crud, pdf-generation, playwright, questpdf, fluid, merge-fields, thumbnails]

# Dependency graph
requires:
  - phase: 31-quote-pdf-templates-01
    provides: QuoteTemplate entity, IQuoteTemplateRepository, PlaywrightPdfService, Organization branding fields
  - phase: 08-quotes-requests
    provides: Quote entity, QuoteLineItem, QuotesController, QuotePdfDocument (QuestPDF)
provides:
  - QuoteTemplatesController with full CRUD, clone, set-default, thumbnail, preview, and merge-fields endpoints
  - Updated QuotesController.GeneratePdf with optional templateId for Playwright-based custom template rendering
  - BuildQuoteMergeDataAsync resolving quote, line items, contact, company, deal, organization into Fluid-compatible dictionary
  - MergeFieldService extended with quote and organization field groups
  - Preview endpoint returning rendered HTML for frontend modal display
affects: [31-03, 31-04, 31-05]

# Tech tracking
tech-stack:
  added: []
  patterns: [fire-and-forget thumbnail generation on save/update/clone, dual PDF path (Playwright custom + QuestPDF fallback), merge data builder pattern for Fluid template rendering]

key-files:
  created:
    - src/GlobCRM.Api/Controllers/QuoteTemplatesController.cs
  modified:
    - src/GlobCRM.Api/Controllers/QuotesController.cs
    - src/GlobCRM.Infrastructure/EmailTemplates/MergeFieldService.cs

key-decisions:
  - "QuoteTemplatesController uses Permission:Quote:View/Edit policies (reuses quote permissions rather than creating separate QuoteTemplate permissions)"
  - "ThumbnailUrl constructed via Url.Action pointing to dedicated /thumbnail endpoint rather than direct file storage URL for consistent access control"
  - "Preview endpoint added to QuoteTemplatesController (not QuotesController) since it operates on templates with optional quote data"
  - "Dual PDF generation path: templateId present -> Playwright+Fluid, templateId absent -> QuestPDF fallback (backward compatible)"

patterns-established:
  - "Fire-and-forget thumbnail generation: non-blocking async call after save/update/clone with try/catch logging"
  - "Merge data builder pattern: private async method building Dictionary<string, object?> from entity graph for Fluid rendering"
  - "Dual PDF path: optional templateId query param selects between custom (Playwright) and built-in (QuestPDF) generators"

requirements-completed: [QTPL-02, QTPL-03, QTPL-05, QTPL-06, QTPL-07, QTPL-08, QTPL-10, QTPL-11]

# Metrics
duration: 5min
completed: 2026-02-22
---

# Phase 31 Plan 02: API Controllers & Merge Data Summary

**QuoteTemplatesController with 10 CRUD/clone/preview endpoints, GeneratePdf dual path (Playwright custom + QuestPDF fallback), and full quote merge data resolution for Fluid template rendering**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-22T06:12:11Z
- **Completed:** 2026-02-22T06:17:26Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- QuoteTemplatesController with 10 endpoints: list, get, create, update, delete, clone, set-default, thumbnail, preview, merge-fields
- QuotesController.GeneratePdf updated with optional templateId: custom template uses Fluid+Playwright, no template uses QuestPDF fallback
- Complete merge data builder resolving quote properties, line items array, contact, company, deal, and organization branding into Fluid-compatible dictionary
- MergeFieldService extended with 12 quote fields and 6 organization fields for email template compatibility
- Fire-and-forget thumbnail generation on template save/update/clone with non-blocking error handling

## Task Commits

Each task was committed atomically:

1. **Task 1: Create QuoteTemplatesController with CRUD, clone, set-default, and thumbnail endpoints** - `a6a7e26` (feat)
2. **Task 2: Update QuotesController.GeneratePdf for custom templates and extend MergeFieldService** - `2300782` (feat)

## Files Created/Modified
- `src/GlobCRM.Api/Controllers/QuoteTemplatesController.cs` - Full CRUD + clone + set-default + thumbnail + preview + merge-fields endpoints with co-located DTOs and validators
- `src/GlobCRM.Api/Controllers/QuotesController.cs` - GeneratePdf updated with optional templateId, added IQuoteTemplateRepository/TemplateRenderService/PlaywrightPdfService dependencies, BuildQuoteMergeDataAsync method
- `src/GlobCRM.Infrastructure/EmailTemplates/MergeFieldService.cs` - Added quote (12 fields) and organization (6 fields) merge field groups

## Decisions Made
- QuoteTemplatesController reuses Permission:Quote:View/Edit policies instead of creating separate QuoteTemplate-specific permissions -- templates are a sub-feature of quotes
- ThumbnailUrl uses Url.Action to build API endpoint URLs rather than exposing raw file storage paths -- maintains authorization on thumbnail access
- Preview endpoint placed on QuoteTemplatesController since it is template-centric (GET /api/quote-templates/{id}/preview?quoteId=)
- Dual PDF path selected by templateId presence: Playwright+Fluid for custom templates, QuestPDF for built-in default (QTPL-11 backward compat)
- Sample merge data pulls organization name from tenant provider for realistic thumbnail previews

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed nullable decimal ToString format in merge data builders**
- **Found during:** Task 2 (build verification)
- **Issue:** `Deal.Value` is `decimal?` (nullable), and `Nullable<decimal>.ToString("N2")` has no format overload -- causes CS1501 compile error
- **Fix:** Changed to `Deal.Value?.ToString("N2") ?? string.Empty` using null-conditional operator to access underlying decimal's format ToString
- **Files modified:** QuotesController.cs, QuoteTemplatesController.cs
- **Verification:** Build succeeds with 0 errors
- **Committed in:** 2300782 (Task 2 commit)

**2. [Rule 2 - Missing Critical] Added preview endpoint for template rendering with real quote data**
- **Found during:** Task 2 (plan specifies QTPL-04 preview support)
- **Issue:** Plan requires preview endpoint returning rendered HTML for frontend modal display -- QuoteTemplatesController needed IQuoteRepository injection and BuildQuoteMergeDataForPreviewAsync
- **Fix:** Added GET /api/quote-templates/{id}/preview?quoteId= endpoint, IQuoteRepository dependency, and preview merge data builder
- **Files modified:** QuoteTemplatesController.cs
- **Verification:** Build succeeds, endpoint returns HTML content type
- **Committed in:** 2300782 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 missing critical)
**Impact on plan:** Both auto-fixes necessary for correct compilation and feature completeness. No scope creep.

## Issues Encountered
None -- plan executed cleanly after auto-fixes.

## User Setup Required
None - no external service configuration required. Playwright Chromium was already installed in Plan 01.

## Next Phase Readiness
- Full API surface ready for frontend consumption (Plans 03-04)
- Template CRUD endpoints support the template gallery UI
- Preview endpoint supports the real-data preview modal
- Merge fields endpoint provides categorized field definitions for Unlayer editor
- PDF generation dual path ensures backward compatibility while enabling custom templates

## Self-Check: PASSED

All 3 key files verified as existing. Both task commits (a6a7e26, 2300782) verified in git log.

---
*Phase: 31-quote-pdf-templates*
*Completed: 2026-02-22*

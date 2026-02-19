---
phase: 20-advanced-reporting-builder
plan: 08
subsystem: ui
tags: [angular, material, signals, error-handling, mat-select, recursive-components]

# Dependency graph
requires:
  - phase: 20-advanced-reporting-builder
    provides: Report gallery, builder sidebar panels, filter builder, report store
provides:
  - Gallery error display with retry button
  - Clean entity type dropdown labels (no icon ligature leak)
  - Builder sidebar error visibility near config panels
  - Recursive filter group delete propagation
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "mat-select-trigger for custom display text in Material select dropdowns"
    - "Recursive component output binding for child-to-parent event propagation"

key-files:
  created: []
  modified:
    - globcrm-web/src/app/features/reports/report-gallery/report-gallery.component.html
    - globcrm-web/src/app/features/reports/report-gallery/report-gallery.component.ts
    - globcrm-web/src/app/features/reports/report-gallery/report-gallery.component.scss
    - globcrm-web/src/app/features/reports/report-builder/entity-source-panel.component.ts
    - globcrm-web/src/app/features/reports/report-builder/report-builder.component.html
    - globcrm-web/src/app/features/reports/report-builder/report-builder.component.scss
    - globcrm-web/src/app/features/reports/report.store.ts
    - globcrm-web/src/app/features/reports/report-builder/filter-builder-panel.component.ts

key-decisions:
  - "mat-select-trigger with computed signal for entity label -- avoids mat-icon CSS ligature text leak in selected display"
  - "loadFieldMetadata clears fieldMetadata and error at start -- prevents stale data from prior entity type selection"
  - "Recursive filter (removeRequest) binding on child instance -- parent onChildGroupRemove splices child from groups array"

patterns-established:
  - "mat-select-trigger pattern: Use mat-select-trigger with a computed signal to customize selected display text when mat-option contains non-text elements like mat-icon"

requirements-completed: [RPT-01, RPT-02, RPT-04]

# Metrics
duration: 3min
completed: 2026-02-19
---

# Phase 20 Plan 08: UAT Gap Closure Summary

**Fixed gallery error display, entity type dropdown ligature leak, builder sidebar error visibility, and recursive filter group delete propagation**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-19T19:28:15Z
- **Completed:** 2026-02-19T19:31:15Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Gallery shows meaningful error state with retry button instead of misleading "No reports found" on API failure
- Entity type dropdown displays clean label text ("Leads") instead of ligature-polluted text ("trending_upLeads")
- Builder sidebar shows error messages near config panels so users see errors without scrolling to preview area
- Recursive filter group delete button correctly removes child groups from parent's groups array via output binding

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix gallery error display and entity source panel mat-select-trigger** - `85da4c1` (fix)
2. **Task 2: Fix builder error visibility, store loadFieldMetadata feedback, and filter group delete** - `6ce826c` (fix)

## Files Created/Modified
- `report-gallery.component.html` - Added error state block with retry, guarded empty/grid states with !error() check
- `report-gallery.component.ts` - Made loadReports() public for template retry binding
- `report-gallery.component.scss` - Added .report-gallery__error styling
- `entity-source-panel.component.ts` - Added mat-select-trigger and selectedEntityLabel computed signal
- `report-builder.component.html` - Added sidebar error feedback block between panels and actions
- `report-builder.component.scss` - Added .report-builder__sidebar-error styling
- `report.store.ts` - Improved loadFieldMetadata to clear stale state and extract API error messages
- `filter-builder-panel.component.ts` - Added (removeRequest) binding on recursive child and onChildGroupRemove handler

## Decisions Made
- Used mat-select-trigger with computed signal for entity label to avoid mat-icon CSS ligature text contamination in the selected display
- loadFieldMetadata clears both fieldMetadata and error at start to prevent stale data from prior entity type selection persisting
- Error extraction chain: err.error.error (API structure) -> err.message (HTTP error) -> fallback string with entity type for diagnostics

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All four UAT gaps (2-5) from 20-UAT.md are now addressed
- The 7 tests that were skipped due to these 4 issues can now be re-tested
- Phase 20 gap closure plans complete

## Self-Check: PASSED
- All 8 modified files verified present on disk
- Commit 85da4c1 (Task 1) verified in git log
- Commit 6ce826c (Task 2) verified in git log
- Angular build passes with no compilation errors

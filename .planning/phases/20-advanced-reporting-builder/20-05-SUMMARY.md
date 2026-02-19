---
phase: 20-advanced-reporting-builder
plan: 05
subsystem: ui
tags: [angular, ngrx-signals, mat-expansion-panel, filter-builder, recursive-component]

# Dependency graph
requires:
  - phase: 20-04
    provides: "ReportStore, ReportService, report models, builder shell with 320px sidebar"
provides:
  - "EntitySourcePanelComponent: entity type selector with name/description/category inputs"
  - "FieldSelectorPanelComponent: categorized checkbox list with search for column selection"
  - "FilterBuilderPanelComponent: recursive AND/OR filter groups with field-type-adaptive operators"
  - "GroupingPanelComponent: group-by fields with date truncation and aggregation type pickers"
  - "ChartConfigPanelComponent: chart type toggle (table/bar/line/pie/funnel) with display options"
  - "Full report builder layout with 5 collapsible sidebar panels, Run Report and Save buttons"
affects: [20-06]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Recursive self-referencing component for nested filter groups", "Local signal state for builder panels with effect-based edit mode pre-population"]

key-files:
  created:
    - "globcrm-web/src/app/features/reports/report-builder/entity-source-panel.component.ts"
    - "globcrm-web/src/app/features/reports/report-builder/field-selector-panel.component.ts"
    - "globcrm-web/src/app/features/reports/report-builder/filter-builder-panel.component.ts"
    - "globcrm-web/src/app/features/reports/report-builder/grouping-panel.component.ts"
    - "globcrm-web/src/app/features/reports/report-builder/chart-config-panel.component.ts"
    - "globcrm-web/src/app/features/reports/report-builder/report-builder.component.html"
    - "globcrm-web/src/app/features/reports/report-builder/report-builder.component.scss"
  modified:
    - "globcrm-web/src/app/features/reports/report-builder/report-builder.component.ts"

key-decisions:
  - "Checkbox list with search for field selection (not drag-drop) -- simpler UX for column picking"
  - "Recursive FilterBuilderPanelComponent self-references for nested AND/OR groups with isNested input for wrapper toggle"
  - "Local signals in builder component for all panel state -- avoids premature store persistence, enables canSave/canRun computed guards"
  - "EntitySourcePanel includes category selector alongside name/description -- keeps report metadata in one panel"
  - "Field selector groups: System, Custom, Formula, Related (sub-grouped by entity) with expandable collapsible sections"

patterns-established:
  - "Recursive component pattern: isNested input controls wrapper rendering, ngTemplateOutlet for shared content"
  - "Builder panel communication: input/output signals with parent local signal state, not direct store mutation"
  - "Field-type-adaptive operators: separate operator arrays per data type (string/number/date/boolean)"

requirements-completed: [RPT-01, RPT-02, RPT-03, RPT-07]

# Metrics
duration: 6min
completed: 2026-02-19
---

# Phase 20 Plan 05: Report Builder Sidebar Summary

**5 collapsible sidebar panels for report configuration: entity source, field checkbox picker, recursive AND/OR filter builder, grouping with aggregation, and chart type selector**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-19T18:13:02Z
- **Completed:** 2026-02-19T18:19:12Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Entity source panel with dropdown for 8 CRM entity types plus report name, description, and category fields
- Field selector panel with categorized checkbox lists (system/custom/formula/related), search filtering, and selected column count badge
- Recursive filter builder supporting nestable AND/OR condition groups with field-type-adaptive operators (string/number/date/boolean)
- Grouping panel with date truncation (day/week/month/quarter/year) for date fields and aggregation type selection for numeric fields
- Chart configuration panel with table/bar/line/pie/funnel toggle and legend/data label display options
- Full builder layout replacing placeholder shell with all 5 panels wired via local signals and fixed Run Report/Save buttons

## Task Commits

Each task was committed atomically:

1. **Task 1: Entity source, field selector, grouping, and chart config panels** - `eb16cfa` (feat)
2. **Task 2: Filter builder panel and builder layout wiring** - `bc08d9b` (feat)

## Files Created/Modified
- `globcrm-web/src/app/features/reports/report-builder/entity-source-panel.component.ts` - Entity type dropdown, name/description/category inputs
- `globcrm-web/src/app/features/reports/report-builder/field-selector-panel.component.ts` - Categorized checkbox list with search for report column selection
- `globcrm-web/src/app/features/reports/report-builder/filter-builder-panel.component.ts` - Recursive AND/OR filter groups with field-type-adaptive operators
- `globcrm-web/src/app/features/reports/report-builder/grouping-panel.component.ts` - Group-by field selector with date truncation and aggregation pickers
- `globcrm-web/src/app/features/reports/report-builder/chart-config-panel.component.ts` - Chart type toggle and display option toggles
- `globcrm-web/src/app/features/reports/report-builder/report-builder.component.ts` - Full builder with 5 sidebar panels, local signal state, save/run logic
- `globcrm-web/src/app/features/reports/report-builder/report-builder.component.html` - Builder layout template with sidebar and preview areas
- `globcrm-web/src/app/features/reports/report-builder/report-builder.component.scss` - Sidebar/preview layout styles with responsive breakpoints

## Decisions Made
- Checkbox list with search for field selection (not drag-drop) -- simpler UX, easier to implement, fields have sortOrder for ordering
- Recursive FilterBuilderPanelComponent uses isNested input to toggle mat-expansion-panel wrapper vs plain nested group rendering
- Local signals in ReportBuilderComponent for all panel state rather than direct store mutation -- enables computed canSave/canRun guards
- EntitySourcePanel includes category selector alongside name/description -- keeps all report metadata in a single panel
- Field selector sub-groups related fields by entity (e.g., "Related: Company", "Related: Owner") for intuitive navigation

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added CommonModule import to FilterBuilderPanelComponent**
- **Found during:** Task 2 (Filter builder panel)
- **Issue:** Component uses *ngTemplateOutlet directive which requires CommonModule import
- **Fix:** Added CommonModule to component imports array
- **Files modified:** filter-builder-panel.component.ts
- **Verification:** Angular build passes with 0 errors
- **Committed in:** bc08d9b (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Auto-fix necessary for template compilation. No scope creep.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All 5 sidebar configuration panels complete and wired into builder layout
- Plan 06 can implement report viewer components (data table, chart visualization, aggregate cards) in the preview area
- Preview area currently shows execution status placeholder -- Plan 06 replaces with full chart + table rendering
- Builder save/run logic connected to ReportStore methods (createReport, updateReport, executeReport)

## Self-Check: PASSED

- All 7 created files verified present on disk
- 1 modified file verified present on disk
- Commit eb16cfa (Task 1) verified in git log
- Commit bc08d9b (Task 2) verified in git log
- Angular build passes with 0 errors

---
*Phase: 20-advanced-reporting-builder*
*Completed: 2026-02-19*

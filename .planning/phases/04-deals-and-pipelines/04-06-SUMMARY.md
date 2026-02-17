---
phase: 04-deals-and-pipelines
plan: 06
subsystem: ui
tags: [angular, material, dynamic-table, saved-views, filter-panel, custom-fields, reactive-forms, pipeline-cascade, autocomplete, deals]

# Dependency graph
requires:
  - phase: 04-deals-and-pipelines
    plan: 04
    provides: "DealListDto, DealDetailDto, CreateDealRequest, UpdateDealRequest, DealService, PipelineService, DealStore"
  - phase: 03-core-crm-entities
    plan: 06
    provides: "CompanyListComponent pattern, CompanyFormComponent pattern, entity list/form page conventions"
  - phase: 02-core-infrastructure
    provides: "DynamicTableComponent, ViewStore, ViewSidebar, FilterPanel, FilterChips, HasPermissionDirective, CustomFieldFormComponent"
provides:
  - "DealListComponent with dynamic table, pipeline filter dropdown, view mode switcher, saved views, and custom field columns"
  - "DealFormComponent with pipeline/stage cascade, company autocomplete, owner selection, custom fields, and date picker"
  - "DEAL_ROUTES: lazy-loaded routes for list, new, :id, :id/edit"
  - "/deals route registered in app.routes.ts with authGuard"
affects: [04-07, 04-08, 04-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pipeline filter dropdown pattern: mat-select with PipelineService.getAll() feeding DealStore.setPipelineId()"
    - "Pipeline-Stage cascade: pipelineId valueChanges loads stages, auto-selects first stage on create, preserves stage on edit"
    - "Stage probability auto-fill: defaultProbability from stage applied unless user manually overrides"

key-files:
  created:
    - "globcrm-web/src/app/features/deals/deal-list/deal-list.component.ts"
    - "globcrm-web/src/app/features/deals/deal-list/deal-list.component.html"
    - "globcrm-web/src/app/features/deals/deal-list/deal-list.component.scss"
    - "globcrm-web/src/app/features/deals/deal-form/deal-form.component.ts"
    - "globcrm-web/src/app/features/deals/deals.routes.ts"
  modified:
    - "globcrm-web/src/app/app.routes.ts"

key-decisions:
  - "View mode switcher uses mat-button-toggle-group with routerLink for Kanban/Calendar navigation (inactive until those components built)"
  - "Owner selection loads team directory via ProfileService.getTeamDirectory (pageSize: 100) rather than a separate user list endpoint"
  - "Pipeline-Stage cascade uses separate API call (PipelineService.getStages) rather than loading full PipelineDetailDto"
  - "provideNativeDateAdapter at component level for deal form datepicker (same pattern as CustomFieldFormComponent)"

patterns-established:
  - "Deal list pipeline filtering: dropdown + DealStore.setPipelineId for pipeline-scoped list views"
  - "Deal form cascade pattern: pipelineId change triggers stage load, auto-populates stage and probability"

# Metrics
duration: 6min
completed: 2026-02-17
---

# Phase 4 Plan 06: Deal List and Form Pages Summary

**Deal list page with dynamic table, pipeline filter dropdown, and view mode switcher alongside deal create/edit form with pipeline-stage cascade, company autocomplete, and custom fields**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-17T08:08:59Z
- **Completed:** 2026-02-17T08:14:51Z
- **Tasks:** 2
- **Files created/modified:** 6

## Accomplishments
- DealListComponent with DynamicTableComponent, ViewSidebar for saved views, FilterPanel/FilterChips, pipeline filter dropdown, view mode switcher (List/Kanban/Calendar), and HasPermission-guarded "New Deal" button
- DealFormComponent supporting both create and edit modes with reactive form validation, pipeline/stage cascade selection (auto-select first stage, auto-fill probability from stage default), company autocomplete via debounced search, owner selection from team directory, and custom field integration
- DEAL_ROUTES with list, new, :id, and :id/edit paths, registered in app.routes.ts with authGuard

## Task Commits

Each task was committed atomically:

1. **Task 1: Create DealListComponent with dynamic table and pipeline filter** - `c1bc80d` (feat)
2. **Task 2: Create DealFormComponent for deal creation and editing** - `e317f9d` (feat)

## Files Created/Modified
- `globcrm-web/src/app/features/deals/deal-list/deal-list.component.ts` - List page with DynamicTable, ViewSidebar, FilterPanel, pipeline filter, view mode switcher, delete with ConfirmDeleteDialogComponent
- `globcrm-web/src/app/features/deals/deal-list/deal-list.component.html` - Template with entity-list-layout, header actions (pipeline filter, view toggle, new button), filter chips/panel, dynamic table
- `globcrm-web/src/app/features/deals/deal-list/deal-list.component.scss` - Styles for header actions, pipeline filter compact form field, view mode toggle, responsive layout
- `globcrm-web/src/app/features/deals/deal-form/deal-form.component.ts` - Create/edit form with 8 core fields, pipeline-stage cascade, company autocomplete, owner select, custom fields, mat-datepicker
- `globcrm-web/src/app/features/deals/deals.routes.ts` - DEAL_ROUTES with list, new, :id, :id/edit paths
- `globcrm-web/src/app/app.routes.ts` - Added /deals lazy-loaded route with authGuard

## Decisions Made
- View mode switcher uses mat-button-toggle-group with routerLink for Kanban and Calendar navigation -- buttons are visible but those routes are not yet implemented (placeholder for plans 04-07, 04-08)
- Owner selection uses ProfileService.getTeamDirectory with pageSize 100 to populate a simple mat-select dropdown rather than an autocomplete search pattern
- Pipeline-Stage cascade uses PipelineService.getStages(pipelineId) rather than loading the full PipelineDetailDto, keeping the API call lightweight
- provideNativeDateAdapter provided at component level (not app-wide) for the expectedCloseDate mat-datepicker, consistent with the CustomFieldFormComponent pattern from Phase 3

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added DEAL_ROUTES and /deals app route**
- **Found during:** Task 1 (DealListComponent)
- **Issue:** No routes file existed for deals feature; list component would not be routable
- **Fix:** Created deals.routes.ts with list/new/:id/:id/edit routes and registered /deals in app.routes.ts with authGuard
- **Files modified:** deals.routes.ts (created), app.routes.ts (modified)
- **Verification:** ng build compiles, routes registered
- **Committed in:** c1bc80d (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Route file was a necessary prerequisite for the components to function. No scope creep.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Deal list and form pages complete, ready for deal detail page (Plan 04-07 or later)
- Kanban and Calendar view mode buttons wired with routerLinks to /deals/kanban and /deals/calendar (future plans)
- DealStore integration tested via ng build; full runtime testing requires backend API (Plans 04-02, 04-03)
- Pipeline filter dropdown functional when pipelines exist in the system

## Self-Check: PASSED

- [x] deal-list.component.ts exists
- [x] deal-list.component.html exists
- [x] deal-list.component.scss exists
- [x] deal-form.component.ts exists
- [x] deals.routes.ts exists
- [x] Commit c1bc80d (Task 1) exists in git log
- [x] Commit e317f9d (Task 2) exists in git log
- [x] ng build compiles without errors

---
*Phase: 04-deals-and-pipelines*
*Completed: 2026-02-17*

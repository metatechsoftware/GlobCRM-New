---
phase: 04-deals-and-pipelines
plan: 05
subsystem: ui
tags: [angular, material, settings, pipelines, stages, drag-drop, cdk, reactive-forms, admin]

# Dependency graph
requires:
  - phase: 04-deals-and-pipelines
    plan: 04
    provides: "PipelineService, PipelineDto, PipelineDetailDto, PipelineStageDto, CreatePipelineRequest, UpdatePipelineRequest models"
  - phase: 02-core-infrastructure
    provides: "ConfirmDeleteDialogComponent, adminGuard, settings route pattern"
provides:
  - "PipelineListComponent: admin list page for pipeline CRUD with table display"
  - "PipelineEditComponent: pipeline editor with stage FormArray, CdkDrag reorder, color/probability/required fields per stage"
  - "Pipeline routes in settings.routes.ts protected by adminGuard"
affects: [04-06, 04-07, 04-08]

# Tech tracking
tech-stack:
  added: []
  patterns: ["FormArray with CdkDrag for reorderable stage management", "Stage preview chips with contrast color calculation", "Expandable required fields panel per stage using MatExpansionPanel"]

key-files:
  created:
    - "globcrm-web/src/app/features/settings/pipelines/pipeline-list.component.ts"
    - "globcrm-web/src/app/features/settings/pipelines/pipeline-edit.component.ts"
  modified:
    - "globcrm-web/src/app/features/settings/settings.routes.ts"

key-decisions:
  - "Inline templates for pipeline components (single .ts file per component) to keep plan scope minimal"
  - "Stage probability stored as percentage in form (0-100), converted to 0-1 decimal on save to match backend format"
  - "Required fields use expansion panel per stage with checkbox grid for deal field requirements (DEAL-10)"

patterns-established:
  - "FormArray + CdkDrag pattern: Drag reorder with moveItemInArray then rebuild FormArray controls in new order"
  - "Contrast color utility: Perceived brightness formula for readable text on colored stage chips"

# Metrics
duration: 4min
completed: 2026-02-17
---

# Phase 4 Plan 05: Pipeline Settings UI Summary

**Admin pipeline configuration pages with drag-reorderable stage management, color/probability config, and per-stage required field settings**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-17T08:08:49Z
- **Completed:** 2026-02-17T08:12:20Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created PipelineListComponent with mat-table displaying name, description, team, stage count, deal count, default badge, and edit/delete actions with ConfirmDeleteDialog reuse
- Created PipelineEditComponent with reactive form for pipeline details, FormArray-based stage management with CdkDrag reorder, hex color input, probability percentage, won/lost flags, and expandable required fields panel per stage
- Added three pipeline routes to settings.routes.ts (list, new, edit by id) all protected by adminGuard

## Task Commits

Each task was committed atomically:

1. **Task 1: Create PipelineListComponent and PipelineEditComponent** - `842ca1f` (feat)
2. **Task 2: Add pipeline routes to settings** - `b31a46b` (feat)

## Files Created/Modified
- `globcrm-web/src/app/features/settings/pipelines/pipeline-list.component.ts` - Pipeline admin list page with table, loading/error states, delete with confirmation
- `globcrm-web/src/app/features/settings/pipelines/pipeline-edit.component.ts` - Pipeline editor with stage FormArray, CdkDrag reorder, color/probability, required fields expansion panels
- `globcrm-web/src/app/features/settings/settings.routes.ts` - Added pipelines, pipelines/new, pipelines/:id routes with adminGuard

## Decisions Made
- **Inline templates:** Used single .ts file with inline template/styles per component, keeping file count to planned scope
- **Probability conversion:** Form displays 0-100 percentage for UX, converts to 0-1 decimal on save to match backend PipelineStageDto format
- **Required fields as expansion panel:** Each stage has a collapsible section with checkboxes for deal fields (value, probability, expectedCloseDate, companyId, ownerId) per DEAL-10 requirement
- **FormArray rebuild on drag:** After CdkDrag reorder, controls are rebuilt in new order to maintain FormArray consistency

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Pipeline admin pages ready for end-to-end testing once backend API is running
- PipelineService already created in plan 04-04, wired into both components
- Stage configuration feeds into deal form (expected close date required, company required, etc.) for plans 04-06/07

## Self-Check: PASSED

All 2 created files verified present. Both task commits (842ca1f, b31a46b) verified in git log. Angular build passes without errors.

---
*Phase: 04-deals-and-pipelines*
*Completed: 2026-02-17*

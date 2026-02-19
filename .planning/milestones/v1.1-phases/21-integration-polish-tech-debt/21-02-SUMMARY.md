---
phase: 21-integration-polish-tech-debt
plan: 02
subsystem: ui, api
tags: [angular, mat-select, workflow-builder, stale-reference, usage-endpoint, postgresql-jsonb]

# Dependency graph
requires:
  - phase: 19-workflow-automation
    provides: Workflow builder visual canvas, ActionConfigComponent, WorkflowBuilderComponent
  - phase: 14-email-template-engine
    provides: EmailTemplateService, EmailTemplateListItem model
  - phase: 18-email-sequences
    provides: SequenceService, SequenceListItem model
provides:
  - Searchable mat-select dropdowns for Send Email and Enroll in Sequence workflow actions
  - Stale reference detection and amber warning banner in workflow builder
  - Save validation blocking stale references
  - Backend usage endpoints for template/sequence deletion warnings
  - Frontend getTemplateUsage/getSequenceUsage service methods
affects: [workflow-builder, email-templates, sequences]

# Tech tracking
tech-stack:
  added: []
  patterns: [searchable-mat-select-dropdown, stale-reference-detection, jsonb-text-search-usage-query]

key-files:
  created: []
  modified:
    - globcrm-web/src/app/features/workflows/workflow-builder/panels/action-config.component.ts
    - globcrm-web/src/app/features/workflows/workflow-builder/workflow-builder.component.ts
    - globcrm-web/src/app/features/workflows/workflow-builder/workflow-builder.component.html
    - globcrm-web/src/app/features/workflows/workflow-builder/workflow-builder.component.scss
    - globcrm-web/src/app/features/email-templates/email-template.service.ts
    - globcrm-web/src/app/features/sequences/sequence.service.ts
    - src/GlobCRM.Api/Controllers/EmailTemplatesController.cs
    - src/GlobCRM.Api/Controllers/SequencesController.cs

key-decisions:
  - "Raw SQL CAST(definition AS text) ILIKE for JSONB text search in usage endpoints -- EF Core owned ToJson() types don't support LINQ text search"
  - "forkJoin for parallel template/sequence list loading with stale detection on completion"
  - "Styled spans (not MatChip) for sequence status badges -- simpler, no extra module import"
  - "Template entity type highlighting skipped -- EmailTemplateListItem has no entityType field (documented gap)"

patterns-established:
  - "Searchable mat-select: sticky search header inside mat-select with signal-based filtering and keydown.stopPropagation"
  - "Stale reference detection: compare loaded node configs against picker data sets, show amber banner, block save"

requirements-completed: [WFLOW-07, WFLOW-09]

# Metrics
duration: 6min
completed: 2026-02-19
---

# Phase 21 Plan 02: Workflow Action Picker Dropdowns Summary

**Searchable mat-select pickers for Send Email/Enroll in Sequence actions with stale reference detection, save validation, and backend usage endpoints**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-19T20:45:00Z
- **Completed:** 2026-02-19T20:51:19Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Replaced free-text UUID inputs for email template and sequence selection with searchable mat-select dropdowns showing name + metadata
- Implemented stale reference detection on workflow open with amber warning banner and save-blocking validation
- Added backend usage endpoints (GET /api/email-templates/{id}/usage, GET /api/sequences/{id}/usage) using raw SQL JSONB text search
- Added frontend service methods for template and sequence usage queries

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace free-text UUID inputs with searchable mat-select dropdowns** - `715e5c0` (feat)
2. **Task 2: Add picker data loading, stale reference detection, save validation, and usage endpoints** - `96979e4` (feat)

## Files Created/Modified
- `globcrm-web/src/app/features/workflows/workflow-builder/panels/action-config.component.ts` - Searchable mat-select for email template (name + subject) and sequence (name + steps + status badge) selection; search signals and computed filters
- `globcrm-web/src/app/features/workflows/workflow-builder/workflow-builder.component.ts` - Template/sequence list loading via forkJoin, stale reference detection, save validation blocking
- `globcrm-web/src/app/features/workflows/workflow-builder/workflow-builder.component.html` - Amber stale warning banner, templates/sequences inputs passed to action config
- `globcrm-web/src/app/features/workflows/workflow-builder/workflow-builder.component.scss` - Stale warning banner styles (amber/warning colors)
- `globcrm-web/src/app/features/email-templates/email-template.service.ts` - getTemplateUsage() method
- `globcrm-web/src/app/features/sequences/sequence.service.ts` - getSequenceUsage() method
- `src/GlobCRM.Api/Controllers/EmailTemplatesController.cs` - GET {id}/usage endpoint with JSONB text search, ApplicationDbContext injection
- `src/GlobCRM.Api/Controllers/SequencesController.cs` - GET {id}/usage endpoint with JSONB text search

## Decisions Made
- Used raw SQL `CAST(definition AS text) ILIKE` for JSONB text search in usage endpoints because EF Core owned types mapped via ToJson() don't support LINQ-based text search on the serialized JSON
- Used forkJoin to load templates and sequences in parallel, with stale detection running after both complete
- Used styled spans instead of MatChip for sequence status badges (active/draft/paused/archived) to avoid an extra module import
- Skipped template entity type highlighting since EmailTemplateListItem has no entityType field (documented as known gap requiring model change)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Workflow builder action pickers fully functional with searchable dropdowns
- Stale reference safety system in place (open warning + save validation)
- Backend usage endpoints available for deletion confirmation dialogs in template/sequence list pages
- All integration polish for workflow builder action configuration complete

## Self-Check: PASSED

- All 8 modified files verified present on disk
- Commit `715e5c0` (Task 1) verified in git log
- Commit `96979e4` (Task 2) verified in git log
- Angular build: success (0 new errors)
- .NET build: success (0 errors)

---
*Phase: 21-integration-polish-tech-debt*
*Completed: 2026-02-19*

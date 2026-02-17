---
phase: 04-deals-and-pipelines
plan: 03
subsystem: api
tags: [rest-api, controllers, crud, pipeline, deal, stage-transition, kanban, timeline, entity-linking, fluent-validation, ownership-scope]

# Dependency graph
requires:
  - phase: 04-deals-and-pipelines
    plan: 02
    provides: "IPipelineRepository, IDealRepository with CRUD, Kanban, stage history queries"
  - phase: 03-core-crm-entities
    plan: 05
    provides: "CompaniesController pattern with ownership scope, IsWithinScope helper, GetTeamMemberIds, FluentValidation, timeline generation"
provides:
  - "PipelinesController with 6 admin-only endpoints for pipeline and stage CRUD"
  - "DealsController with 12 endpoints: CRUD, stage transition, contact/product linking, Kanban, timeline"
  - "Stage transitions create DealStageHistory records with auto-probability and ActualCloseDate"
  - "Kanban endpoint returns structured pipeline stages with grouped deals"
  - "Timeline aggregates creation, updates, stage changes, contact links, and product links"
  - "DTOs: PipelineDto, PipelineDetailDto, PipelineStageDto, DealListDto, DealDetailDto, KanbanDto, DealKanbanCardDto, DealTimelineEntryDto"
affects: [04-05, 04-06, 04-07, 04-08, 04-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pipeline controller: admin-config entity pattern with Authorize(Roles = Admin) at controller level"
    - "Stage update: full replacement strategy with deal-safety checks via HasDealsInStageAsync"
    - "Deal stage transition: DealStageHistory audit trail, auto-probability from stage DefaultProbability, ActualCloseDate on terminal stages"
    - "Kanban data endpoint: pipeline stages with grouped deals, terminal stage exclusion toggle"
    - "Deal timeline: aggregated events from entity lifecycle, stage history, and entity links"
    - "Entity linking: DealContact/DealProduct CRUD with duplicate prevention and referential integrity"

key-files:
  created:
    - src/GlobCRM.Api/Controllers/PipelinesController.cs
    - src/GlobCRM.Api/Controllers/DealsController.cs
  modified:
    - src/GlobCRM.Infrastructure/Persistence/Repositories/DealRepository.cs

key-decisions:
  - "Pipeline controller uses admin-only authorization at controller level (not per-endpoint permission policies)"
  - "Stage update uses full replacement strategy with deal-safety check before stage removal"
  - "Kanban endpoint filters terminal stages at both repository and controller level for consistency"
  - "Deal timeline uses separate DealTimelineEntryDto to avoid collision with CompaniesController TimelineEntryDto"
  - "Added Pipeline include to DealRepository GetPagedAsync and GetByIdAsync for PipelineName in DTOs"

patterns-established:
  - "Admin-config controller: Authorize(Roles = Admin) at controller level, no ownership scope needed"
  - "Stage transition pattern: validate stage belongs to pipeline, create history, update probability, set ActualCloseDate"
  - "Entity linking pattern: POST to create link, DELETE to remove, with existence and duplicate checks"
  - "Kanban data pattern: pipeline stages + grouped deals with terminal stage exclusion"

# Metrics
duration: 4min
completed: 2026-02-17
---

# Phase 04 Plan 03: API Controllers Summary

**PipelinesController with 6 admin endpoints and DealsController with 12 endpoints covering CRUD, stage transitions with DealStageHistory, entity linking, Kanban board data, and deal timeline**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-17T09:00:00Z
- **Completed:** 2026-02-17T09:04:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created PipelinesController with 6 admin-only REST endpoints for pipeline CRUD and stage management with deal-safety checks
- Created DealsController with 12 REST endpoints covering CRUD, dedicated stage transition (for Kanban drag-drop), contact/product entity linking, Kanban board data, and deal timeline
- Stage transitions automatically create DealStageHistory records, update Probability from stage defaults, and set ActualCloseDate on terminal stages
- Kanban endpoint returns structured data with pipeline stages and grouped deals, respecting ownership scope and terminal stage exclusion
- Deal timeline aggregates creation, updates, stage change history, contact link, and product link events in chronological order

## Task Commits

Each task was committed atomically:

1. **Task 1: Create PipelinesController with admin CRUD and stage management** - `4b21251` (feat)
2. **Task 2: Create DealsController with CRUD, stage transitions, entity linking, Kanban, and timeline** - `e2c9e0f` (feat)

## Files Created/Modified
- `src/GlobCRM.Api/Controllers/PipelinesController.cs` - 6 endpoints: list, detail, create, update, delete, list-stages (all admin-only)
- `src/GlobCRM.Api/Controllers/DealsController.cs` - 12 endpoints: CRUD (5), stage transition (1), contact link/unlink (2), product link/unlink (2), Kanban (1), timeline (1)
- `src/GlobCRM.Infrastructure/Persistence/Repositories/DealRepository.cs` - Added Pipeline include to GetPagedAsync and GetByIdAsync for PipelineName in DTOs

## Decisions Made
- Pipeline controller uses admin-only authorization at controller level (Authorize Roles = Admin) rather than per-endpoint permission policies, since pipeline configuration is purely admin functionality
- Stage update uses full replacement strategy: identifies removed stages, checks for active deals before removal, updates existing stages, and adds new ones
- Kanban endpoint filters terminal stages at both repository level (GetByPipelineForKanbanAsync) and controller level (stage list filtering) for consistent behavior
- Deal timeline uses separate DealTimelineEntryDto to avoid namespace collision with CompaniesController's TimelineEntryDto
- Added Pipeline include to DealRepository GetPagedAsync and GetByIdAsync so DealListDto can populate PipelineName field

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added Pipeline include to DealRepository queries**
- **Found during:** Task 2 (DealsController implementation)
- **Issue:** DealRepository.GetPagedAsync and GetByIdAsync did not include Pipeline navigation, causing PipelineName to be null in DealListDto
- **Fix:** Added `.Include(d => d.Pipeline)` to both GetPagedAsync and GetByIdAsync queries
- **Files modified:** src/GlobCRM.Infrastructure/Persistence/Repositories/DealRepository.cs
- **Verification:** Build succeeds, Pipeline navigation loaded for DTO mapping
- **Committed in:** e2c9e0f (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Auto-fix was necessary for correct DTO mapping. No scope creep.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 18 REST endpoints (6 pipeline + 12 deal) ready for frontend consumption
- Pipeline admin endpoints ready for pipeline configuration UI (04-05)
- Deal CRUD endpoints ready for deal list and form pages (04-06, already built)
- Kanban data endpoint ready for Kanban board component (04-07)
- Deal timeline endpoint ready for deal detail timeline (04-08)
- Stage transition endpoint ready for Kanban drag-drop interaction (04-07)
- Entity linking endpoints ready for deal detail contacts/products tabs

## Self-Check: PASSED

All 2 created files and 1 modified file verified on disk. Both task commits (4b21251, e2c9e0f) verified in git log. Solution builds with 0 errors.

---
*Phase: 04-deals-and-pipelines*
*Completed: 2026-02-17*

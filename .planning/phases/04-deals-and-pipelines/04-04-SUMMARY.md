---
phase: 04-deals-and-pipelines
plan: 04
subsystem: ui
tags: [angular, ngrx-signals, typescript, api-services, signal-stores, entity-models, deals, pipelines, kanban]

# Dependency graph
requires:
  - phase: 02-core-infrastructure
    provides: "ApiService, ViewStore pattern, ViewFilter/ViewSort models, @ngrx/signals"
  - phase: 03-core-crm-entities
    provides: "CompanyService/CompanyStore pattern, shared query models (PagedResult, EntityQueryParams, FilterParam, TimelineEntry)"
provides:
  - "DealListDto, DealDetailDto, CreateDealRequest, UpdateDealRequest TypeScript interfaces"
  - "PipelineDto, PipelineDetailDto, PipelineStageDto, CreatePipelineRequest, UpdatePipelineRequest TypeScript interfaces"
  - "KanbanDto, KanbanStageDto, DealKanbanCardDto TypeScript interfaces for Kanban board"
  - "LinkedContactDto, LinkedProductDto for deal entity linking"
  - "DealService API client with 12 methods: CRUD, stage transition, contact/product linking, Kanban, timeline"
  - "PipelineService API client with 6 methods: CRUD and stage listing"
  - "DealStore NgRx Signal Store with list/detail state and pipeline filtering"
affects: [04-05, 04-06, 04-07, 04-08, 04-09]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Deal signal store with pipelineId filtering for Kanban/list views", "Extended EntityQueryParams with pipelineId/stageId for deal list endpoint"]

key-files:
  created:
    - "globcrm-web/src/app/features/deals/deal.models.ts"
    - "globcrm-web/src/app/features/deals/deal.service.ts"
    - "globcrm-web/src/app/features/deals/pipeline.service.ts"
    - "globcrm-web/src/app/features/deals/deal.store.ts"
  modified: []

key-decisions:
  - "DealService.getList extends EntityQueryParams with pipelineId/stageId for pipeline-scoped list and Kanban views"
  - "DealStore adds pipelineId to state with setPipelineId method for pipeline-specific deal loading"
  - "PipelineService is a separate service from DealService (pipeline admin vs deal operations)"

patterns-established:
  - "Extended query params pattern: DealService.getList adds domain-specific params (pipelineId, stageId) alongside standard EntityQueryParams"
  - "PATCH endpoint pattern: DealService.updateStage uses ApiService.patch for partial deal updates"

# Metrics
duration: 2min
completed: 2026-02-17
---

# Phase 4 Plan 04: Frontend Deal Data Layer Summary

**TypeScript models for Deal, Pipeline, Stage, and Kanban DTOs with API services (12+6 methods) and NgRx signal store with pipeline filtering**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-17T07:30:38Z
- **Completed:** 2026-02-17T07:32:41Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Created 17 TypeScript interfaces covering all deal and pipeline DTOs, including Kanban board models and entity linking types
- Built DealService with 12 API methods: full CRUD, stage transition (PATCH), contact/product linking, Kanban endpoint, and timeline
- Built PipelineService with 6 API methods: CRUD for pipeline admin and stage listing
- Created DealStore signal store following CompanyStore pattern with added pipelineId filtering for Kanban and list views

## Task Commits

Each task was committed atomically:

1. **Task 1: Create deal and pipeline TypeScript models and API services** - `ee71098` (feat)
2. **Task 2: Create DealStore NgRx signal store** - `79b4ac1` (feat)

## Files Created/Modified
- `globcrm-web/src/app/features/deals/deal.models.ts` - 17 TypeScript interfaces: Pipeline*, Deal*, Kanban*, LinkedContact/Product, Create/Update requests
- `globcrm-web/src/app/features/deals/deal.service.ts` - DealService with 12 methods: CRUD, updateStage, link/unlink contact/product, getKanban, getTimeline
- `globcrm-web/src/app/features/deals/pipeline.service.ts` - PipelineService with 6 methods: getAll, getById, create, update, delete, getStages
- `globcrm-web/src/app/features/deals/deal.store.ts` - DealStore NgRx signal store with list/detail state, pagination, filtering, and pipelineId support

## Decisions Made
- **Extended query params:** DealService.getList accepts pipelineId and stageId alongside standard EntityQueryParams, handled in buildQueryParams
- **Separate pipeline service:** PipelineService is independent from DealService since pipeline admin operations are distinct from deal operations
- **PATCH for stage updates:** DealService.updateStage uses ApiService.patch matching the backend PATCH /api/deals/{id}/stage endpoint pattern

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All deal and pipeline data layer files ready for UI components (list, form, detail, Kanban, calendar)
- Backend API endpoints not yet created (plans 04-01/02/03 build those)
- DealStore designed for DynamicTableComponent integration via items/totalCount/isLoading signals
- PipelineService ready for settings/pipelines admin pages

## Self-Check: PASSED

All 4 created files verified present. Both task commits (ee71098, 79b4ac1) verified in git log. Angular build passes without errors.

---
*Phase: 04-deals-and-pipelines*
*Completed: 2026-02-17*

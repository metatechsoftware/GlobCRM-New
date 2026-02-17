---
phase: 05-activities-and-workflow
plan: 03
subsystem: api
tags: [rest-api, controller, crud, workflow, kanban, timeline, fluent-validation, authorization, dto]

# Dependency graph
requires:
  - phase: 05-activities-and-workflow
    plan: 01
    provides: "Activity entity with 6 child entities, 3 enums, 7 EF Core configurations"
  - phase: 05-activities-and-workflow
    plan: 02
    provides: "IActivityRepository with 8 methods, ownership scope, entity-scoped queries, Kanban grouping"
provides:
  - "ActivitiesController with 9 endpoints: list, detail, create, update, delete, status transition, kanban, timeline, allowed-transitions"
  - "ActivityWorkflow static class with CanTransition and GetAllowedTransitions methods"
  - "Activity DTOs: ActivityListDto, ActivityDetailDto, ActivityCommentDto, ActivityAttachmentDto, ActivityTimeEntryDto, ActivityFollowerDto, ActivityLinkDto"
  - "Kanban DTOs: ActivityKanbanDto, ActivityKanbanColumnDto, ActivityKanbanCardDto"
  - "Timeline DTO: ActivityTimelineEntryDto aggregating 6 event types"
  - "Request DTOs: CreateActivityRequest, UpdateActivityRequest, UpdateActivityStatusRequest"
  - "FluentValidation: CreateActivityRequestValidator (subject 3-500 chars, type/priority enum validation)"
affects: [05-04, 05-05, 05-06, 05-07, 05-08, 05-09, 05-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Activity workflow state machine: static transition map with CanTransition validation"
    - "Dual-field ownership scope in controller: IsWithinScope checks OwnerId + AssignedToId"
    - "Timeline aggregation from 6 child entity types into unified ActivityTimelineEntryDto list"

key-files:
  created:
    - src/GlobCRM.Domain/Entities/ActivityWorkflow.cs
    - src/GlobCRM.Api/Controllers/ActivitiesController.cs
  modified: []

key-decisions:
  - "ActivityWorkflow is a static class in Domain/Entities (not a service) for zero-dependency transition validation"
  - "IsWithinScope checks both OwnerId and AssignedToId for activity dual-ownership scope (matching repository pattern)"
  - "Create/Update request use string type/priority fields with Enum.TryParse for flexible API input"
  - "Status changes only via dedicated PATCH /status endpoint (PUT update does not allow status change)"

patterns-established:
  - "Activity workflow state machine pattern: static Dictionary of allowed transitions with CanTransition/GetAllowedTransitions"
  - "Dual-field scope check pattern: IsWithinScope accepts both ownerId and assignedToId for entities with separate owner and assignee"

# Metrics
duration: 3min
completed: 2026-02-17
---

# Phase 5 Plan 3: Activity API Controller Summary

**ActivitiesController with 9 REST endpoints: CRUD, workflow state machine status transitions, Kanban grouping, timeline aggregation, and allowed-transitions for frontend drop targets**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-17T11:00:24Z
- **Completed:** 2026-02-17T11:03:28Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created ActivityWorkflow static class with transition map defining allowed status changes across 5 workflow states
- Built ActivitiesController with 9 endpoints following DealsController/CompaniesController conventions
- Implemented workflow state machine validation preventing invalid status transitions (returns 400)
- Status changes automatically create ActivityStatusHistory audit records and set/clear CompletedAt on Done transitions
- Timeline endpoint aggregates 6 event types: creation, status changes, comments, attachments, time entries, entity links
- Kanban endpoint groups non-Done activities by status with priority/due-date ordering
- Entity-scoped listing supports linkedEntityType + linkedEntityId for cross-entity activity queries
- Dual-field ownership scope checking both OwnerId and AssignedToId on all endpoints

## Task Commits

Each task was committed atomically:

1. **Task 1: Create ActivityWorkflow validation class** - `580ccc3` (feat)
2. **Task 2: Create ActivitiesController with CRUD, status transition, Kanban data, and timeline** - `a310c00` (feat)

## Files Created/Modified
- `src/GlobCRM.Domain/Entities/ActivityWorkflow.cs` - Static workflow transition validation with CanTransition and GetAllowedTransitions methods
- `src/GlobCRM.Api/Controllers/ActivitiesController.cs` - 9 REST endpoints with DTOs, request models, FluentValidation, and helper methods

## Decisions Made
- ActivityWorkflow is a static class in Domain/Entities (not an injected service) -- transition rules are fixed logic with no dependencies
- IsWithinScope checks both OwnerId and AssignedToId for activity dual-ownership scope, matching the repository pattern from 05-02
- Create/Update requests accept type and priority as strings with Enum.TryParse validation for flexible API input
- Status changes only allowed via dedicated PATCH /status endpoint -- PUT update endpoint does not modify status to enforce workflow discipline

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Activity CRUD API complete, ready for Plan 05-04 (sub-resource endpoints: comments, attachments, time entries, links, followers)
- ActivityWorkflow provides transition validation used by both controller and future Kanban drag-drop
- All DTOs ready for Angular frontend consumption in Plan 05-06

## Self-Check: PASSED

- `src/GlobCRM.Domain/Entities/ActivityWorkflow.cs` verified present on disk
- `src/GlobCRM.Api/Controllers/ActivitiesController.cs` verified present on disk
- Task 1 commit `580ccc3` verified in git log
- Task 2 commit `a310c00` verified in git log
- `dotnet build` passes with 0 errors
- 9 endpoints verified: GET list, GET detail, POST, PUT, DELETE, PATCH status, GET kanban, GET timeline, GET allowed-transitions

---
*Phase: 05-activities-and-workflow*
*Completed: 2026-02-17*

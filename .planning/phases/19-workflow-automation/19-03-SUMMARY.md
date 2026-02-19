---
phase: 19-workflow-automation
plan: 03
subsystem: api
tags: [rest-api, workflow, crud, templates, hangfire, fluent-validation, cache-invalidation]

# Dependency graph
requires:
  - phase: 19-workflow-automation
    plan: 01
    provides: "Workflow, WorkflowExecutionLog, WorkflowActionLog, WorkflowTemplate entities, IWorkflowRepository"
provides:
  - "WorkflowsController with 12 REST endpoints for workflow CRUD, enable/disable, clone, logs, entity fields"
  - "WorkflowTemplatesController with 5 REST endpoints for template gallery, apply, save-as-template, delete"
  - "DateTriggerScanService hourly Hangfire recurring job for date-based workflow triggers"
  - "5 system workflow templates covering sales, engagement, and operational categories"
  - "Co-located DTOs with static FromEntity() factory methods and FluentValidation validators"
affects: [19-04, 19-05, 19-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "IMemoryCache direct injection for cache invalidation without compile-time dependency on event handler"
    - "Parallel plan execution: stub action classes to unblock concurrent 19-02 execution engine"
    - "Template apply creates full definition copy with no link to original"

key-files:
  created:
    - src/GlobCRM.Api/Controllers/WorkflowsController.cs
    - src/GlobCRM.Api/Controllers/WorkflowTemplatesController.cs
    - src/GlobCRM.Infrastructure/Workflows/DateTriggerScanService.cs
    - src/GlobCRM.Infrastructure/Workflows/Actions/UpdateFieldAction.cs
    - src/GlobCRM.Infrastructure/Workflows/Actions/SendNotificationAction.cs
    - src/GlobCRM.Infrastructure/Workflows/Actions/CreateActivityAction.cs
    - src/GlobCRM.Infrastructure/Workflows/Actions/SendEmailAction.cs
    - src/GlobCRM.Infrastructure/Workflows/Actions/FireWebhookAction.cs
    - src/GlobCRM.Infrastructure/Workflows/Actions/EnrollInSequenceAction.cs
  modified:
    - src/GlobCRM.Api/Program.cs
    - src/GlobCRM.Infrastructure/MultiTenancy/TenantSeeder.cs
    - src/GlobCRM.Domain/Enums/NotificationType.cs

key-decisions:
  - "IMemoryCache injected directly into controller for cache invalidation — avoids compile-time dependency on WorkflowDomainEventHandler from parallel 19-02 plan"
  - "Stub action classes created to resolve pre-existing 19-02 build errors — 19-02 replaces them with real implementations"
  - "DateTriggerScanService created as hourly Hangfire recurring job — initially supports Deal.ExpectedCloseDate and Activity.DueDate"
  - "NotificationType.WorkflowAction enum value added to unblock 19-02 SendNotificationAction"

patterns-established:
  - "Cache invalidation via private helper method on all mutation endpoints"
  - "WorkflowDefinitionDto bidirectional mapping: FromEntity for read, MapDefinition for write, CloneDefinition for copy"

requirements-completed: [WFLOW-11, WFLOW-12, WFLOW-13]

# Metrics
duration: 9min
completed: 2026-02-19
---

# Phase 19 Plan 03: Workflow REST API Summary

**Full workflow REST API with 12 CRUD/toggle/logs endpoints, 5 template gallery endpoints, hourly date trigger scanner, and 5 system templates across sales/engagement/operational categories**

## Performance

- **Duration:** 9 min
- **Started:** 2026-02-19T14:34:50Z
- **Completed:** 2026-02-19T14:43:50Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- WorkflowsController with 12 endpoints: CRUD, enable/disable toggle (WFLOW-12), activate/deactivate with validation, duplicate, paginated execution logs with action-level detail (WFLOW-11), and entity field listing for builder
- WorkflowTemplatesController with 5 endpoints: template gallery listing, detail view, save workflow as template (WFLOW-13), apply template to create workflow (WFLOW-13), delete custom templates
- DateTriggerScanService registered as hourly Hangfire recurring job for date-based workflow triggers
- TenantSeeder enhanced from 3 to 5 system templates covering all locked decision categories: sales (Deal Won Celebration, Lead Qualified Alert), engagement (Welcome New Contact), operational (High-Value Deal Alert, New Company Enrichment Task)
- IMemoryCache cache invalidation on all workflow mutations using shared key pattern compatible with execution engine

## Task Commits

Each task was committed atomically:

1. **Task 1: WorkflowsController with CRUD, enable/disable, and execution logs** - `bb6d5be` (feat)
2. **Task 2: WorkflowTemplatesController, Program.cs wiring, and template seeder enhancement** - `d555bdb` (feat)

## Files Created/Modified
- `src/GlobCRM.Api/Controllers/WorkflowsController.cs` - 12 endpoints with DTOs, validators, cache invalidation helper
- `src/GlobCRM.Api/Controllers/WorkflowTemplatesController.cs` - 5 endpoints for template gallery and apply
- `src/GlobCRM.Infrastructure/Workflows/DateTriggerScanService.cs` - Hourly Hangfire job scanning for date-based triggers
- `src/GlobCRM.Infrastructure/Workflows/Actions/*.cs` - 6 stub action files for parallel 19-02 build compatibility
- `src/GlobCRM.Api/Program.cs` - DateTriggerScanService recurring job registration
- `src/GlobCRM.Infrastructure/MultiTenancy/TenantSeeder.cs` - 2 additional system templates (Lead Qualified Alert, New Company Enrichment Task)
- `src/GlobCRM.Domain/Enums/NotificationType.cs` - Added WorkflowAction enum value

## Decisions Made
- **IMemoryCache direct injection**: Controller injects IMemoryCache directly and calls `_cache.Remove($"workflow_active_{tenantId}_{entityType}")` on every mutation. This avoids a compile-time dependency on WorkflowDomainEventHandler (created by parallel 19-02 plan) while using the same cache key pattern for compatibility.
- **Stub action classes**: Created minimal stub implementations for 6 workflow action classes (UpdateFieldAction, SendNotificationAction, etc.) to resolve pre-existing build errors from 19-02's WorkflowActionExecutor. The 19-02 plan replaces these with real implementations.
- **DateTriggerScanService scope**: Initial implementation supports Deal.ExpectedCloseDate and Activity.DueDate standard fields. Custom field date querying deferred to future enhancement.
- **NotificationType.WorkflowAction**: Added enum value proactively to unblock 19-02's SendNotificationAction which references it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created stub action classes for 19-02 build compatibility**
- **Found during:** Task 1 (WorkflowsController build verification)
- **Issue:** Pre-existing 19-02 files (WorkflowActionExecutor.cs) referenced action classes in `GlobCRM.Infrastructure.Workflows.Actions` namespace that didn't exist yet
- **Fix:** Created 6 stub action files with minimal Task.CompletedTask implementations
- **Files created:** src/GlobCRM.Infrastructure/Workflows/Actions/*.cs (6 files)
- **Verification:** Build passes with 0 errors
- **Committed in:** bb6d5be (Task 1 commit)

**2. [Rule 3 - Blocking] Added NotificationType.WorkflowAction enum value**
- **Found during:** Task 2 (build verification after 19-02 modified action files in working directory)
- **Issue:** 19-02's real SendNotificationAction.cs referenced NotificationType.WorkflowAction which didn't exist in the enum
- **Fix:** Added WorkflowAction to the NotificationType enum
- **Files modified:** src/GlobCRM.Domain/Enums/NotificationType.cs
- **Verification:** Build passes with 0 errors
- **Committed in:** d555bdb (Task 2 commit)

**3. [Rule 2 - Missing Critical] Created DateTriggerScanService**
- **Found during:** Task 2 (Program.cs wiring)
- **Issue:** Plan requires DateTriggerScanService registration in Program.cs, but the class didn't exist (19-02 had not created it)
- **Fix:** Created full DateTriggerScanService with hourly scan logic for date-based workflow triggers
- **Files created:** src/GlobCRM.Infrastructure/Workflows/DateTriggerScanService.cs
- **Verification:** Build passes, Hangfire registration compiles
- **Committed in:** d555bdb (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 missing critical)
**Impact on plan:** All fixes necessary to resolve parallel execution build conflicts between 19-02 and 19-03. No scope creep. Stub files will be replaced by 19-02's real implementations.

## Issues Encountered
- 19-02 plan executing in parallel created partial files (WorkflowActionExecutor, WorkflowExecutionService) that referenced types/classes not yet created, causing build failures. Resolved by creating stub implementations that 19-02 will replace with real code.
- 19-02 replaced stub action files in the working directory during Task 2 execution, introducing a new build error (NotificationType.WorkflowAction missing). Resolved by adding the enum value.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Full REST API surface complete for workflow management, ready for frontend consumption in 19-04
- Template gallery with 5 system templates ready for UI rendering
- Execution log endpoints ready for frontend detail views
- DateTriggerScanService wired for hourly scanning, ready to process date-based triggers once 19-02 execution engine completes

## Self-Check: PASSED

All created files verified present. Both task commits (bb6d5be, d555bdb) verified in git log.

---
*Phase: 19-workflow-automation*
*Completed: 2026-02-19*

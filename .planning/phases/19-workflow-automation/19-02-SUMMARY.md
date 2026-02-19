---
phase: 19-workflow-automation
plan: 02
subsystem: workflows
tags: [hangfire, domain-events, workflow-engine, condition-evaluator, action-executor, loop-guard, date-trigger]

# Dependency graph
requires:
  - phase: 19-workflow-automation
    plan: 01
    provides: "Workflow domain entities, JSONB definition, repository, migration"
  - phase: 17-webhooks
    provides: "WebhookDomainEventHandler pattern, WebhookSsrfValidator, WebhookDelivery HttpClient"
  - phase: 18-email-sequences
    provides: "SequenceExecutionService, enrollment repository, Hangfire job pattern"
  - phase: 14-email-templates
    provides: "TemplateRenderService, MergeFieldService, IEmailService.SendRawEmailAsync"
provides:
  - "WorkflowDomainEventHandler (IDomainEventHandler) matching events to cached active workflows"
  - "WorkflowExecutionService (Hangfire job) with condition eval and graph traversal"
  - "WorkflowConditionEvaluator with AND/OR grouping and changed_to/changed_from_to operators"
  - "WorkflowLoopGuard with depth 5 limit and AsyncLocal + Hangfire parameter passthrough"
  - "WorkflowActionExecutor dispatching to 6 action implementations"
  - "6 action types: UpdateField, SendNotification, CreateActivity, SendEmail, FireWebhook, EnrollInSequence"
  - "DateTriggerScanService hourly recurring Hangfire job for date-based triggers"
  - "WorkflowServiceExtensions centralizing all workflow DI registrations"
affects: [19-03, 19-04, 19-05, 19-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Domain event handler with cached workflow matching and Hangfire job enqueue"
    - "Graph traversal with branch/wait node support for workflow execution"
    - "AsyncLocal depth tracking + Hangfire job parameter passthrough for cross-job loop prevention"
    - "Action executor dispatching to reusable infrastructure services"

key-files:
  created:
    - src/GlobCRM.Infrastructure/Workflows/WorkflowDomainEventHandler.cs
    - src/GlobCRM.Infrastructure/Workflows/WorkflowExecutionService.cs
    - src/GlobCRM.Infrastructure/Workflows/WorkflowConditionEvaluator.cs
    - src/GlobCRM.Infrastructure/Workflows/WorkflowLoopGuard.cs
    - src/GlobCRM.Infrastructure/Workflows/WorkflowActionExecutor.cs
    - src/GlobCRM.Infrastructure/Workflows/WorkflowTriggerContext.cs
    - src/GlobCRM.Infrastructure/Workflows/WorkflowServiceExtensions.cs
    - src/GlobCRM.Infrastructure/Workflows/Actions/UpdateFieldAction.cs
    - src/GlobCRM.Infrastructure/Workflows/Actions/SendNotificationAction.cs
    - src/GlobCRM.Infrastructure/Workflows/Actions/CreateActivityAction.cs
    - src/GlobCRM.Infrastructure/Workflows/Actions/SendEmailAction.cs
    - src/GlobCRM.Infrastructure/Workflows/Actions/FireWebhookAction.cs
    - src/GlobCRM.Infrastructure/Workflows/Actions/EnrollInSequenceAction.cs
  modified:
    - src/GlobCRM.Infrastructure/Workflows/DateTriggerScanService.cs
    - src/GlobCRM.Infrastructure/DependencyInjection.cs

key-decisions:
  - "WorkflowTriggerContext as positional record with all primitive/string types for Hangfire serialization safety"
  - "Branch node evaluation returns bool mapped to 'yes'/'no' connection SourceOutput for graph traversal"
  - "Wait nodes schedule continuation as separate Hangfire delayed jobs and halt current traversal"
  - "Loop guard depth passed through Hangfire job parameters since AsyncLocal does not survive serialization"
  - "Entity data loaded fresh in execution service (not from domain event) to get complete entity state"
  - "Action implementations reuse existing infrastructure services exclusively -- no new service layer"

patterns-established:
  - "Workflow graph traversal: BFS with visited set, branch routing, and wait scheduling"
  - "Action executor dispatch pattern: ActionType switch to scoped action implementations"
  - "Cross-Hangfire-job depth tracking via explicit parameter passthrough"

requirements-completed: [WFLOW-01, WFLOW-02, WFLOW-03, WFLOW-04, WFLOW-05, WFLOW-06, WFLOW-07, WFLOW-08, WFLOW-09, WFLOW-10]

# Metrics
duration: 11min
completed: 2026-02-19
---

# Phase 19 Plan 02: Workflow Execution Engine Summary

**Complete workflow execution pipeline: domain event handler with cached matching, condition evaluator with AND/OR and field-change operators, graph traversal with branch/wait support, 6 action implementations reusing existing infrastructure, loop guard with depth 5 limit, and hourly date trigger scanner**

## Performance

- **Duration:** 11 min
- **Started:** 2026-02-19T14:34:07Z
- **Completed:** 2026-02-19T14:46:04Z
- **Tasks:** 2
- **Files modified:** 15

## Accomplishments
- Domain event handler matches entity lifecycle events to cached active workflows and enqueues Hangfire execution jobs, mirroring the proven WebhookDomainEventHandler pattern
- Execution service traverses the workflow graph supporting sequential actions, branch (if/else) routing via condition evaluation, and wait (delay) nodes via Hangfire delayed job scheduling
- All 6 action types implemented as orchestration over existing services: UpdateField (reflection+JSONB), SendNotification (NotificationDispatcher), CreateActivity (Activity+ActivityLink), SendEmail (TemplateRenderService+MergeFieldService), FireWebhook (SSRF validator+HttpClient), EnrollInSequence (enrollment repo+execution service)
- Loop guard prevents infinite cascading with MaxDepth=5, AsyncLocal for within-request cascading, and depth passthrough across Hangfire job boundaries
- DateTriggerScanService enhanced with duplicate prevention via execution log checks

## Task Commits

Each task was committed atomically:

1. **Task 1: Domain event handler, condition evaluator, loop guard, and execution service** - `aab19c0` (feat)
2. **Task 2: Six action implementations, date trigger scan, and DI registration** - `8947880` (feat)

## Files Created/Modified
- `src/GlobCRM.Infrastructure/Workflows/WorkflowDomainEventHandler.cs` - IDomainEventHandler matching domain events to cached active workflows, enqueuing Hangfire jobs
- `src/GlobCRM.Infrastructure/Workflows/WorkflowExecutionService.cs` - Hangfire job evaluating conditions and traversing workflow graph with branch/wait support
- `src/GlobCRM.Infrastructure/Workflows/WorkflowConditionEvaluator.cs` - AND/OR condition evaluation with equals, contains, changed_to, changed_from_to, numeric, null operators
- `src/GlobCRM.Infrastructure/Workflows/WorkflowLoopGuard.cs` - AsyncLocal depth tracking with MaxDepth=5 and processed pair deduplication
- `src/GlobCRM.Infrastructure/Workflows/WorkflowActionExecutor.cs` - ActionType switch dispatch to 6 action implementations
- `src/GlobCRM.Infrastructure/Workflows/WorkflowTriggerContext.cs` - Serializable record for Hangfire job parameters
- `src/GlobCRM.Infrastructure/Workflows/WorkflowServiceExtensions.cs` - Centralized DI registration for all workflow services
- `src/GlobCRM.Infrastructure/Workflows/Actions/UpdateFieldAction.cs` - Updates entity fields via reflection (standard) or JSONB (custom)
- `src/GlobCRM.Infrastructure/Workflows/Actions/SendNotificationAction.cs` - Dispatches in-app notifications with dynamic recipient resolution
- `src/GlobCRM.Infrastructure/Workflows/Actions/CreateActivityAction.cs` - Creates activities with ActivityLink to triggering entity
- `src/GlobCRM.Infrastructure/Workflows/Actions/SendEmailAction.cs` - Renders and sends email templates via existing template infrastructure
- `src/GlobCRM.Infrastructure/Workflows/Actions/FireWebhookAction.cs` - HTTP POST with SSRF validation and custom headers
- `src/GlobCRM.Infrastructure/Workflows/Actions/EnrollInSequenceAction.cs` - Contact enrollment via existing sequence pipeline
- `src/GlobCRM.Infrastructure/Workflows/DateTriggerScanService.cs` - Enhanced with duplicate prevention and IgnoreQueryFilters for cross-tenant scan
- `src/GlobCRM.Infrastructure/DependencyInjection.cs` - Replaced direct repository registration with AddWorkflowServices()

## Decisions Made
- **WorkflowTriggerContext as positional record**: All properties are primitive/string types for reliable Hangfire JSON serialization. ChangedProperties and OldPropertyValues serialized as JSON strings.
- **Branch node 'yes'/'no' routing**: Branch condition evaluation returns bool, mapped to SourceOutput connection matching for graph traversal.
- **Wait node scheduling**: Wait nodes schedule continuation as separate Hangfire delayed jobs with remaining graph nodes, halting current traversal. Uses ContinueFromNodeAsync entry point.
- **Entity data loaded fresh**: Execution service loads entity from DbContext rather than relying on domain event data, ensuring complete and current entity state for condition evaluation and action execution.
- **Action implementations are orchestration only**: Each action delegates to an existing infrastructure service (NotificationDispatcher, TemplateRenderService, WebhookSsrfValidator, SequenceExecutionService). No new service layers created.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed branch node type mismatch in graph traversal**
- **Found during:** Task 1 (WorkflowExecutionService)
- **Issue:** EvaluateBranchCondition returns bool but GetConnectedNodeIds expects string? for sourceOutput parameter
- **Fix:** Added bool-to-string mapping: `branchResult ? "yes" : "no"` before passing to GetConnectedNodeIds
- **Files modified:** src/GlobCRM.Infrastructure/Workflows/WorkflowExecutionService.cs
- **Verification:** Build succeeds with 0 errors
- **Committed in:** aab19c0 (Task 1 commit)

**2. [Rule 1 - Bug] Fixed Deal.StageId property name**
- **Found during:** Task 1 (WorkflowExecutionService entity data loading)
- **Issue:** Deal entity uses PipelineStageId, not StageId
- **Fix:** Changed `entity.StageId` to `entity.PipelineStageId` in LoadDealDataAsync
- **Files modified:** src/GlobCRM.Infrastructure/Workflows/WorkflowExecutionService.cs
- **Verification:** Build succeeds with 0 errors
- **Committed in:** aab19c0 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both were simple property name corrections caught during compilation. No scope creep.

## Issues Encountered
- Action stub files from 19-01 existed in Actions/ directory and needed to be overwritten with full implementations (expected pattern from plan dependency)

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Complete workflow execution pipeline operational: event -> handler -> Hangfire job -> condition eval -> graph traversal -> action dispatch
- Ready for Plan 03 (Workflow API Controller) to expose CRUD and management endpoints
- All 6 action types tested at compile level; runtime testing will occur with the full system
- WorkflowDomainEventHandler registered alongside WebhookDomainEventHandler via IDomainEventHandler DI

## Self-Check: PASSED

All 13 created files verified present. Both task commits (aab19c0, 8947880) verified in git log.

---
*Phase: 19-workflow-automation*
*Completed: 2026-02-19*

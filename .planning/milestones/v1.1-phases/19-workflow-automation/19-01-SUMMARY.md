---
phase: 19-workflow-automation
plan: 01
subsystem: database
tags: [ef-core, jsonb, workflow, postgresql, rls, migration, repository]

# Dependency graph
requires:
  - phase: 17-webhooks
    provides: "WebhookSubscription entity pattern, DomainEvent infrastructure"
  - phase: 18-email-sequences
    provides: "EmailSequence entity pattern, seeder pattern, Hangfire infrastructure"
provides:
  - "Workflow, WorkflowExecutionLog, WorkflowActionLog, WorkflowTemplate domain entities"
  - "JSONB WorkflowDefinition with nodes, connections, triggers, conditions, actions"
  - "IWorkflowRepository interface and EF Core repository implementation"
  - "PostgreSQL migration creating 4 workflow tables with indexes"
  - "RLS policies for 3 tenant-scoped workflow tables"
  - "Demo seed workflows and system template gallery"
  - "EntityType.Workflow for RBAC permission auto-generation"
affects: [19-02, 19-03, 19-04, 19-05, 19-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "JSONB owned entity with ToJson() for complex nested workflow definition"
    - "TriggerSummary denormalized list for fast event matching without full definition deserialization"
    - "String-typed Config property in nested JSONB to avoid EF Core Dictionary mapping issues"

key-files:
  created:
    - src/GlobCRM.Domain/Entities/Workflow.cs
    - src/GlobCRM.Domain/Entities/WorkflowExecutionLog.cs
    - src/GlobCRM.Domain/Entities/WorkflowActionLog.cs
    - src/GlobCRM.Domain/Entities/WorkflowTemplate.cs
    - src/GlobCRM.Domain/Enums/WorkflowStatus.cs
    - src/GlobCRM.Domain/Enums/WorkflowTriggerType.cs
    - src/GlobCRM.Domain/Enums/WorkflowActionType.cs
    - src/GlobCRM.Domain/Enums/WorkflowExecutionStatus.cs
    - src/GlobCRM.Domain/Interfaces/IWorkflowRepository.cs
    - src/GlobCRM.Infrastructure/Persistence/Configurations/WorkflowConfiguration.cs
    - src/GlobCRM.Infrastructure/Persistence/Configurations/WorkflowExecutionLogConfiguration.cs
    - src/GlobCRM.Infrastructure/Persistence/Configurations/WorkflowActionLogConfiguration.cs
    - src/GlobCRM.Infrastructure/Persistence/Configurations/WorkflowTemplateConfiguration.cs
    - src/GlobCRM.Infrastructure/Workflows/WorkflowRepository.cs
  modified:
    - src/GlobCRM.Domain/Enums/EntityType.cs
    - src/GlobCRM.Infrastructure/Persistence/ApplicationDbContext.cs
    - src/GlobCRM.Infrastructure/DependencyInjection.cs
    - src/GlobCRM.Infrastructure/MultiTenancy/TenantSeeder.cs
    - scripts/rls-setup.sql

key-decisions:
  - "WorkflowActionConfig.Config stored as string (serialized JSON) instead of Dictionary<string, object?> to avoid EF Core ToJson() mapping issues with nested dictionaries"
  - "WorkflowNode.Config stored as nullable string for same reason"
  - "TriggerSummary as JSONB List<string> for fast event matching without loading full definition"

patterns-established:
  - "Nested JSONB owned entity pattern: ToJson() with OwnsMany for complex graph structures"
  - "String-typed config within JSONB owned types for dynamic key-value data"

requirements-completed: [WFLOW-01, WFLOW-02, WFLOW-03, WFLOW-11, WFLOW-12, WFLOW-13]

# Metrics
duration: 8min
completed: 2026-02-19
---

# Phase 19 Plan 01: Workflow Domain Foundation Summary

**Workflow entities with JSONB visual flow definition, execution audit logs, template gallery, EF Core migration, RLS policies, and demo seed data**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-19T14:23:12Z
- **Completed:** 2026-02-19T14:31:48Z
- **Tasks:** 2
- **Files modified:** 23

## Accomplishments
- Workflow entity with JSONB WorkflowDefinition storing full visual flow graph (nodes, connections) and logical configuration (triggers, conditions, actions) as single document
- Execution audit trail via WorkflowExecutionLog and WorkflowActionLog with timing metrics
- WorkflowTemplate entity supporting system templates and tenant-scoped custom templates
- Repository with efficient active workflow retrieval using composite index for trigger matching
- 2 demo workflows and 3 system templates seeded via TenantSeeder

## Task Commits

Each task was committed atomically:

1. **Task 1: Domain entities, enums, and repository interface** - `f0d3366` (feat)
2. **Task 2: EF Core configurations, migration, RLS, repository, and seed data** - `687e225` (feat)

## Files Created/Modified
- `src/GlobCRM.Domain/Entities/Workflow.cs` - Core workflow entity with nested WorkflowDefinition, WorkflowNode, WorkflowConnection, WorkflowTriggerConfig, WorkflowConditionGroup, WorkflowCondition, WorkflowActionConfig classes
- `src/GlobCRM.Domain/Entities/WorkflowExecutionLog.cs` - Execution log with trigger event, conditions, status, timing
- `src/GlobCRM.Domain/Entities/WorkflowActionLog.cs` - Per-action log with type, status, error, duration
- `src/GlobCRM.Domain/Entities/WorkflowTemplate.cs` - Template entity with IsSystem flag and category
- `src/GlobCRM.Domain/Enums/WorkflowStatus.cs` - Draft, Active, Paused
- `src/GlobCRM.Domain/Enums/WorkflowTriggerType.cs` - RecordCreated, RecordUpdated, RecordDeleted, FieldChanged, DateBased
- `src/GlobCRM.Domain/Enums/WorkflowActionType.cs` - UpdateField, SendNotification, CreateActivity, SendEmail, FireWebhook, EnrollInSequence, Branch, Wait
- `src/GlobCRM.Domain/Enums/WorkflowExecutionStatus.cs` - Succeeded, PartiallyFailed, Failed, Skipped
- `src/GlobCRM.Domain/Enums/EntityType.cs` - Added Workflow value for RBAC
- `src/GlobCRM.Domain/Interfaces/IWorkflowRepository.cs` - CRUD, active workflow retrieval, execution logs, template methods
- `src/GlobCRM.Infrastructure/Persistence/Configurations/WorkflowConfiguration.cs` - JSONB definition, composite index
- `src/GlobCRM.Infrastructure/Persistence/Configurations/WorkflowExecutionLogConfiguration.cs` - FK cascade, chronological index
- `src/GlobCRM.Infrastructure/Persistence/Configurations/WorkflowActionLogConfiguration.cs` - FK cascade from execution log
- `src/GlobCRM.Infrastructure/Persistence/Configurations/WorkflowTemplateConfiguration.cs` - JSONB definition, unique name index
- `src/GlobCRM.Infrastructure/Workflows/WorkflowRepository.cs` - Full IWorkflowRepository implementation
- `src/GlobCRM.Infrastructure/Persistence/ApplicationDbContext.cs` - 4 DbSets, configurations, query filters
- `src/GlobCRM.Infrastructure/DependencyInjection.cs` - IWorkflowRepository scoped registration
- `src/GlobCRM.Infrastructure/MultiTenancy/TenantSeeder.cs` - Cleanup + 2 demo workflows + 3 system templates
- `scripts/rls-setup.sql` - RLS policies for workflows, workflow_execution_logs, workflow_templates

## Decisions Made
- **Config as string instead of Dictionary**: EF Core's ToJson() owned entity mapping doesn't support `Dictionary<string, object?>` within nested owned types. Changed WorkflowActionConfig.Config and WorkflowNode.Config to `string` (serialized JSON). This is functionally equivalent and avoids the mapping issue while maintaining full flexibility.
- **TriggerSummary denormalized list**: Stored as JSONB `List<string>` on the Workflow entity for fast event matching queries without needing to deserialize the full WorkflowDefinition.
- **ActionLog inherits tenant isolation**: WorkflowActionLog has no separate global query filter or RLS policy -- inherits isolation through WorkflowExecutionLog FK cascade.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Changed Dictionary<string, object?> to string for JSONB Config properties**
- **Found during:** Task 2 (EF Core configuration and migration)
- **Issue:** EF Core ToJson() owned entity mapping throws error for Dictionary<string, object?> properties inside nested owned types: "The navigation must be configured with an explicit name for the target shared-type entity type"
- **Fix:** Changed WorkflowActionConfig.Config from `Dictionary<string, object?>` to `string` (serialized JSON), and WorkflowNode.Config from `Dictionary<string, object?>?` to `string?`
- **Files modified:** src/GlobCRM.Domain/Entities/Workflow.cs
- **Verification:** Migration created and applied successfully
- **Committed in:** 687e225 (Task 2 commit, entity change included)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor type change for EF Core compatibility. Functionally equivalent -- string stores the same JSON data. No scope creep.

## Issues Encountered
None beyond the Dictionary-to-string change noted in deviations.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Workflow domain foundation complete with all entities, enums, repository, and seed data
- Ready for Plan 02 (Workflow Execution Engine) to build the trigger matching and action execution pipeline
- Active workflow retrieval optimized with composite index for trigger matching queries
- RBAC permissions for Workflow entity auto-generated via existing RoleTemplateSeeder pattern

## Self-Check: PASSED

All 14 created files verified present. Both task commits (f0d3366, 687e225) verified in git log.

---
*Phase: 19-workflow-automation*
*Completed: 2026-02-19*

---
phase: 18-email-sequences
plan: 03
subsystem: api
tags: [rest-api, controllers, dtos, fluentvalidation, rbac, hangfire, enrollment, analytics, sequences]

# Dependency graph
requires:
  - phase: 18-01
    provides: EmailSequence, EmailSequenceStep, SequenceEnrollment entities with repositories and EF configurations
  - phase: 18-02
    provides: SequenceExecutionService, SequenceEmailSender, EmailTrackingService, Hangfire job scheduling
  - phase: 14-foundation-infrastructure-email-templates
    provides: EmailTemplate entity, PermissionPolicyProvider, RoleTemplateSeeder with EntityType enum iteration
provides:
  - SequencesController with 20 REST endpoints for complete sequence management
  - Co-located DTOs (SequenceListItemDto, SequenceDetailDto, SequenceStepDto, EnrollmentListItemDto, SequenceAnalyticsDto, StepMetricsDto, FunnelDataDto)
  - Co-located request records with FluentValidation validators
  - RBAC authorization via Permission:EmailSequence:View/Edit policies
affects: [18-04-frontend, 18-05-tracking-analytics]

# Tech tracking
tech-stack:
  added: []
  patterns: [controller-with-co-located-dtos-and-validators, analytics-per-list-item-query, bulk-enrollment-with-skip-logic, hangfire-job-lifecycle-management-in-controller]

key-files:
  created:
    - src/GlobCRM.Api/Controllers/SequencesController.cs
  modified:
    - src/GlobCRM.Infrastructure/Sequences/SequenceExecutionService.cs

key-decisions:
  - "CalculateDelay changed from internal to public static for reuse in controller resume endpoint"
  - "Task 2 (RBAC + Program.cs) required no code changes -- EntityType enum, RoleTemplateSeeder, PermissionPolicyProvider, and DI wiring already auto-handle EmailSequence from 18-01/18-02"
  - "20 endpoints implemented (exceeding plan's ~18 target) including bulk-pause and bulk-resume"
  - "Funnel data counts contacts who reached each step via CurrentStepNumber or StepsSent comparison"

patterns-established:
  - "Analytics-per-list-item: sequence list endpoint queries enrollment analytics per sequence for inline metrics"
  - "Bulk enrollment with skip-already-enrolled: returns enrolled/skipped counts and skipped contact IDs"
  - "Hangfire job lifecycle in controller: pause deletes scheduled job, resume schedules next step"
  - "Multi-sequence warning: enrollment warns if contact is in other active sequences but doesn't block"

requirements-completed: [ESEQ-01, ESEQ-02, ESEQ-03, ESEQ-06, ESEQ-07]

# Metrics
duration: 5min
completed: 2026-02-19
---

# Phase 18 Plan 03: Sequence API Endpoints Summary

**SequencesController with 20 REST endpoints covering sequence CRUD, step management, single/bulk enrollment with Hangfire scheduling, pause/resume with job lifecycle, and analytics (status counts, per-step metrics, funnel data)**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-19T12:52:30Z
- **Completed:** 2026-02-19T12:57:43Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- SequencesController with 20 endpoints: 5 sequence CRUD, 4 step management, 8 enrollment management, 3 analytics
- Co-located DTOs (7 types), request records (8 types), and FluentValidation validators (6 types) in single controller file
- Single enrollment with duplicate check (skip if already active), multi-sequence warning, and re-enrollment from specific step
- Bulk enrollment with skip-already-enrolled logic returning enrolled/skipped counts and skipped contact IDs
- Pause/resume endpoints managing Hangfire job lifecycle (delete on pause, schedule on resume)
- Bulk pause and bulk resume endpoints for multi-select operations
- Analytics endpoints: enrollment status counts, per-step tracking metrics with open/click rates, funnel data for visualization
- RBAC permissions auto-created for EmailSequence via existing RoleTemplateSeeder (verified via reseed)

## Task Commits

Each task was committed atomically:

1. **Task 1: SequencesController with CRUD, enrollment, and analytics endpoints** - `584a858` (feat)
2. **Task 2: RBAC permissions and Program.cs wiring** - No commit needed (verified existing wiring handles EmailSequence automatically)

## Files Created/Modified
- `src/GlobCRM.Api/Controllers/SequencesController.cs` - Complete REST API with 20 endpoints, 7 DTOs, 8 request records, 6 validators
- `src/GlobCRM.Infrastructure/Sequences/SequenceExecutionService.cs` - Changed CalculateDelay from internal to public static for controller reuse

## Decisions Made
- CalculateDelay visibility changed from `internal static` to `public static` so the controller's resume endpoint can compute delay for next step scheduling (pure utility function, no encapsulation concern)
- Task 2 required zero code changes: RoleTemplateSeeder already iterates Enum.GetNames<EntityType>() which includes EmailSequence from 18-01, PermissionPolicyProvider dynamically creates policies from "Permission:{Entity}:{Operation}" patterns, and AddSequenceServices() is already called from DependencyInjection.cs in 18-02
- 20 endpoints implemented (vs plan's ~18 target) by adding bulk-pause and bulk-resume as distinct endpoints
- Funnel data computation uses in-memory comparison of enrollment progress against step numbers rather than a separate tracking query

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] CalculateDelay visibility for cross-assembly access**
- **Found during:** Task 1 (SequencesController)
- **Issue:** CalculateDelay was `internal static` in SequenceExecutionService (Infrastructure assembly), inaccessible from SequencesController (Api assembly)
- **Fix:** Changed to `public static` since it's a pure utility function with no state access
- **Files modified:** src/GlobCRM.Infrastructure/Sequences/SequenceExecutionService.cs
- **Verification:** Build succeeds with 0 errors
- **Committed in:** 584a858 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Minor visibility change to enable cross-assembly method call. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Full REST API surface ready for frontend consumption (18-04)
- Analytics endpoints ready for tracking dashboard (18-05)
- RBAC permissions seeded for all role templates
- Enrollment management with Hangfire job lifecycle fully operational

## Self-Check: PASSED

All created files verified present. Task commit (584a858) verified in git log. Build succeeds with 0 errors. Reseed completes successfully.

---
*Phase: 18-email-sequences*
*Plan: 03*
*Completed: 2026-02-19*

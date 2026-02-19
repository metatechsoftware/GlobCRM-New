---
phase: 18-email-sequences
plan: 01
subsystem: database
tags: [ef-core, postgresql, rls, multi-tenancy, email-sequences, repositories]

# Dependency graph
requires:
  - phase: 14-foundation-infrastructure-email-templates
    provides: EmailTemplate entity, EF configuration, and Hangfire infrastructure
provides:
  - EmailSequence, EmailSequenceStep, SequenceEnrollment, SequenceTrackingEvent entities
  - IEmailSequenceRepository and ISequenceEnrollmentRepository interfaces + implementations
  - email_sequences, email_sequence_steps, sequence_enrollments, sequence_tracking_events PostgreSQL tables
  - RLS policies for tenant isolation on 3 new tables
  - Seed data for demo sequences with steps and enrollments
affects: [18-02-execution-engine, 18-03-api-endpoints, 18-04-frontend, 18-05-tracking]

# Tech tracking
tech-stack:
  added: []
  patterns: [sequence-step-ordering-via-composite-unique-index, enrollment-state-machine-with-timestamp-audit-trail]

key-files:
  created:
    - src/GlobCRM.Domain/Entities/EmailSequence.cs
    - src/GlobCRM.Domain/Entities/EmailSequenceStep.cs
    - src/GlobCRM.Domain/Entities/SequenceEnrollment.cs
    - src/GlobCRM.Domain/Entities/SequenceTrackingEvent.cs
    - src/GlobCRM.Domain/Enums/SequenceStatus.cs
    - src/GlobCRM.Domain/Enums/EnrollmentStatus.cs
    - src/GlobCRM.Domain/Interfaces/IEmailSequenceRepository.cs
    - src/GlobCRM.Domain/Interfaces/ISequenceEnrollmentRepository.cs
    - src/GlobCRM.Infrastructure/Persistence/Configurations/EmailSequenceConfiguration.cs
    - src/GlobCRM.Infrastructure/Persistence/Configurations/EmailSequenceStepConfiguration.cs
    - src/GlobCRM.Infrastructure/Persistence/Configurations/SequenceEnrollmentConfiguration.cs
    - src/GlobCRM.Infrastructure/Persistence/Configurations/SequenceTrackingEventConfiguration.cs
    - src/GlobCRM.Infrastructure/Persistence/Repositories/EmailSequenceRepository.cs
    - src/GlobCRM.Infrastructure/Persistence/Repositories/SequenceEnrollmentRepository.cs
    - src/GlobCRM.Infrastructure/Persistence/Migrations/App/20260219124047_AddEmailSequences.cs
  modified:
    - src/GlobCRM.Domain/Enums/EntityType.cs
    - src/GlobCRM.Infrastructure/Persistence/ApplicationDbContext.cs
    - src/GlobCRM.Infrastructure/DependencyInjection.cs
    - src/GlobCRM.Infrastructure/MultiTenancy/TenantSeeder.cs
    - scripts/rls-setup.sql

key-decisions:
  - "EmailSequenceStep FK to EmailTemplate uses Restrict delete to prevent template deletion while used by active sequences"
  - "SequenceEnrollment uses timestamp fields (RepliedAt, PausedAt, BouncedAt, CompletedAt) as audit trail rather than separate history table"
  - "StepMetrics record type defined in ISequenceEnrollmentRepository for per-step analytics aggregation"
  - "Sequence seed data references first 3 existing email templates and first 3 contacts for realistic demo data"

patterns-established:
  - "Composite unique index on (sequence_id, step_number) for step ordering integrity"
  - "Enrollment state machine: Active -> Completed/Replied/Bounced/Unenrolled with Paused as toggle"
  - "HangfireJobId on enrollment for pause/cancel job management"
  - "SequenceTrackingEvent as append-only audit table (no UpdatedAt) for open/click/bounce tracking"

requirements-completed: [ESEQ-01]

# Metrics
duration: 6min
completed: 2026-02-19
---

# Phase 18 Plan 01: Email Sequence Data Layer Summary

**Four-entity data model (EmailSequence, EmailSequenceStep, SequenceEnrollment, SequenceTrackingEvent) with EF Core configurations, PostgreSQL migration, RLS policies, repository implementations, and TenantSeeder demo data**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-19T12:35:09Z
- **Completed:** 2026-02-19T12:41:30Z
- **Tasks:** 2
- **Files modified:** 22

## Accomplishments
- Four domain entities with full property sets matching research document specifications
- Four EF Core configurations with snake_case PostgreSQL naming, proper FKs (Restrict/Cascade), and comprehensive indexes
- Migration applied creating all tables with correct column types and constraints
- RLS policies for email_sequences, sequence_enrollments, and sequence_tracking_events
- EmailSequenceRepository with eager-loaded Steps and Templates, SequenceEnrollmentRepository with analytics queries
- TenantSeeder creates "New Customer Onboarding" sequence (3 steps, 3 enrollments with Active/Completed/Replied statuses)

## Task Commits

Each task was committed atomically:

1. **Task 1: Domain entities, enums, and repository interfaces** - `b5bb066` (feat)
2. **Task 2: EF configurations, migration, RLS, repositories, and seed data** - `d18884a` (feat)

## Files Created/Modified
- `src/GlobCRM.Domain/Entities/EmailSequence.cs` - Sequence entity with Name, Description, Status, Steps collection, CreatedByUserId
- `src/GlobCRM.Domain/Entities/EmailSequenceStep.cs` - Step entity with StepNumber, EmailTemplateId, SubjectOverride, DelayDays, PreferredSendTime
- `src/GlobCRM.Domain/Entities/SequenceEnrollment.cs` - Enrollment state machine with status timestamps and HangfireJobId
- `src/GlobCRM.Domain/Entities/SequenceTrackingEvent.cs` - Append-only tracking events for sent/open/click/bounce
- `src/GlobCRM.Domain/Enums/SequenceStatus.cs` - Draft, Active, Paused, Archived
- `src/GlobCRM.Domain/Enums/EnrollmentStatus.cs` - Active, Paused, Completed, Replied, Bounced, Unenrolled
- `src/GlobCRM.Domain/Enums/EntityType.cs` - Added EmailSequence value
- `src/GlobCRM.Domain/Interfaces/IEmailSequenceRepository.cs` - CRUD + step query + template-enriched loading
- `src/GlobCRM.Domain/Interfaces/ISequenceEnrollmentRepository.cs` - CRUD + bulk + analytics + step metrics with StepMetrics record
- `src/GlobCRM.Infrastructure/Persistence/Configurations/*.cs` - Four EF configurations with snake_case, indexes, FKs
- `src/GlobCRM.Infrastructure/Persistence/Repositories/EmailSequenceRepository.cs` - Eager-loaded steps/templates, ordered by StepNumber
- `src/GlobCRM.Infrastructure/Persistence/Repositories/SequenceEnrollmentRepository.cs` - Paged queries, analytics groupBy, step metrics pivot
- `src/GlobCRM.Infrastructure/Persistence/ApplicationDbContext.cs` - 4 DbSets, 4 configurations, 3 global query filters
- `src/GlobCRM.Infrastructure/DependencyInjection.cs` - Scoped repository registrations
- `src/GlobCRM.Infrastructure/MultiTenancy/TenantSeeder.cs` - Sequence cleanup + SeedEmailSequencesAsync method
- `scripts/rls-setup.sql` - 3 new RLS policies

## Decisions Made
- EmailSequenceStep FK to EmailTemplate uses OnDelete Restrict (prevents accidental template deletion while in use)
- SequenceEnrollment tracks state transitions via nullable timestamp fields (CompletedAt, RepliedAt, PausedAt, BouncedAt) -- lightweight audit trail without a separate history table
- StepMetrics defined as a record type in the repository interface namespace for per-step analytics aggregation
- Seed data strategy: reference first 3 existing email templates and contacts, creating realistic demo with varied enrollment statuses

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Data layer complete with all four tables, proper tenant isolation, and operational repositories
- Execution engine (18-02) can build on SequenceEnrollment state machine and HangfireJobId tracking
- API endpoints (18-03) can use both repositories for CRUD and analytics
- Frontend (18-04) can bind to sequence/enrollment data models
- Tracking (18-05) can write to SequenceTrackingEvent table

---
*Phase: 18-email-sequences*
*Plan: 01*
*Completed: 2026-02-19*

---
phase: 05-activities-and-workflow
plan: 01
subsystem: database
tags: [ef-core, postgresql, jsonb, rls, domain-entities, enums, migration]

# Dependency graph
requires:
  - phase: 04-deals-and-pipelines
    provides: "Deal entity patterns, DealConfiguration conventions, ApplicationDbContext structure, RLS script"
provides:
  - "Activity entity with Subject, Description, Type, Status, Priority, DueDate, CustomFields"
  - "6 child entities: ActivityComment, ActivityAttachment, ActivityTimeEntry, ActivityFollower, ActivityLink, ActivityStatusHistory"
  - "3 enums: ActivityType (Task/Call/Meeting), ActivityStatus (Assigned-Done), ActivityPriority (Low-Urgent)"
  - "7 EF Core configurations with snake_case naming and GIN index on custom_fields"
  - "AddActivities migration creating 7 database tables"
  - "RLS policy for activities table"
affects: [05-02, 05-03, 05-04, 05-05, 05-06, 05-07, 05-08, 05-09, 05-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Activity child entity pattern: no TenantId, cascade delete from Activity FK"
    - "Polymorphic ActivityLink: EntityType+EntityId with no FK constraint to target entities"
    - "Composite PK on ActivityFollower (ActivityId+UserId) matching DealContact pattern"

key-files:
  created:
    - src/GlobCRM.Domain/Entities/Activity.cs
    - src/GlobCRM.Domain/Entities/ActivityComment.cs
    - src/GlobCRM.Domain/Entities/ActivityAttachment.cs
    - src/GlobCRM.Domain/Entities/ActivityTimeEntry.cs
    - src/GlobCRM.Domain/Entities/ActivityFollower.cs
    - src/GlobCRM.Domain/Entities/ActivityLink.cs
    - src/GlobCRM.Domain/Entities/ActivityStatusHistory.cs
    - src/GlobCRM.Domain/Enums/ActivityType.cs
    - src/GlobCRM.Domain/Enums/ActivityStatus.cs
    - src/GlobCRM.Domain/Enums/ActivityPriority.cs
    - src/GlobCRM.Infrastructure/Persistence/Configurations/ActivityConfiguration.cs
    - src/GlobCRM.Infrastructure/Persistence/Configurations/ActivityCommentConfiguration.cs
    - src/GlobCRM.Infrastructure/Persistence/Configurations/ActivityAttachmentConfiguration.cs
    - src/GlobCRM.Infrastructure/Persistence/Configurations/ActivityTimeEntryConfiguration.cs
    - src/GlobCRM.Infrastructure/Persistence/Configurations/ActivityFollowerConfiguration.cs
    - src/GlobCRM.Infrastructure/Persistence/Configurations/ActivityLinkConfiguration.cs
    - src/GlobCRM.Infrastructure/Persistence/Configurations/ActivityStatusHistoryConfiguration.cs
    - src/GlobCRM.Infrastructure/Persistence/Migrations/App/20260217105126_AddActivities.cs
  modified:
    - src/GlobCRM.Infrastructure/Persistence/ApplicationDbContext.cs
    - scripts/rls-setup.sql

key-decisions:
  - "ActivityStatusHistory uses enum values (not FK to stage table) unlike DealStageHistory which uses FK to PipelineStage"
  - "ActivityLink is polymorphic (EntityType+EntityId string) with no FK constraints -- enables linking to any CRM entity type"
  - "ActivityFollower uses Cascade delete on User FK (user removal clears follow) unlike other user FKs which use SetNull"

patterns-established:
  - "Activity child entity pattern: no TenantId, inherits isolation via Activity FK cascade"
  - "Polymorphic entity linking via EntityType string + EntityId Guid with unique composite index"

# Metrics
duration: 3min
completed: 2026-02-17
---

# Phase 5 Plan 1: Activity Domain Entities Summary

**7 Activity domain entities, 3 enums, 7 EF Core configurations, AddActivities migration, and RLS policy for the activities table**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-17T10:48:48Z
- **Completed:** 2026-02-17T10:52:07Z
- **Tasks:** 2
- **Files modified:** 22

## Accomplishments
- Created complete Activity data model: 7 entity classes and 3 enum types following Deal entity conventions
- Built 7 EF Core configurations with snake_case naming, string enum conversions, JSONB custom fields with GIN index, and proper FK constraints
- Updated ApplicationDbContext with 7 new DbSets and Activity tenant query filter
- Generated AddActivities migration creating all 7 database tables with proper constraints and indexes
- Added RLS policy for activities table in rls-setup.sql for database-level tenant isolation

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Activity domain entities and enums** - `74dadd8` (feat)
2. **Task 2: Create EF Core configurations, update DbContext, add RLS, and generate migration** - `6b9f0bd` (feat)

## Files Created/Modified
- `src/GlobCRM.Domain/Enums/ActivityType.cs` - Enum: Task, Call, Meeting
- `src/GlobCRM.Domain/Enums/ActivityStatus.cs` - Enum: Assigned, Accepted, InProgress, Review, Done
- `src/GlobCRM.Domain/Enums/ActivityPriority.cs` - Enum: Low, Medium, High, Urgent
- `src/GlobCRM.Domain/Entities/Activity.cs` - Main entity with Subject, Description, Type, Status, Priority, DueDate, CustomFields
- `src/GlobCRM.Domain/Entities/ActivityComment.cs` - Comment child entity with Content and Author
- `src/GlobCRM.Domain/Entities/ActivityAttachment.cs` - File attachment child entity with FileName, StoragePath, ContentType
- `src/GlobCRM.Domain/Entities/ActivityTimeEntry.cs` - Time tracking child entity with DurationMinutes and EntryDate
- `src/GlobCRM.Domain/Entities/ActivityFollower.cs` - Follower join entity with composite PK (ActivityId+UserId)
- `src/GlobCRM.Domain/Entities/ActivityLink.cs` - Polymorphic link to Contact/Company/Deal entities
- `src/GlobCRM.Domain/Entities/ActivityStatusHistory.cs` - Status transition audit trail (follows DealStageHistory pattern)
- `src/GlobCRM.Infrastructure/Persistence/Configurations/ActivityConfiguration.cs` - Main entity config with GIN index, string enum conversions
- `src/GlobCRM.Infrastructure/Persistence/Configurations/ActivityCommentConfiguration.cs` - Comment config with Author SetNull
- `src/GlobCRM.Infrastructure/Persistence/Configurations/ActivityAttachmentConfiguration.cs` - Attachment config with max lengths
- `src/GlobCRM.Infrastructure/Persistence/Configurations/ActivityTimeEntryConfiguration.cs` - Time entry config with decimal(10,2)
- `src/GlobCRM.Infrastructure/Persistence/Configurations/ActivityFollowerConfiguration.cs` - Follower config with composite PK
- `src/GlobCRM.Infrastructure/Persistence/Configurations/ActivityLinkConfiguration.cs` - Link config with unique composite index
- `src/GlobCRM.Infrastructure/Persistence/Configurations/ActivityStatusHistoryConfiguration.cs` - Status history config with string enum conversions
- `src/GlobCRM.Infrastructure/Persistence/ApplicationDbContext.cs` - Added 7 Activity DbSets and tenant query filter
- `scripts/rls-setup.sql` - Added activities RLS policy for tenant isolation
- `src/GlobCRM.Infrastructure/Persistence/Migrations/App/20260217105126_AddActivities.cs` - Migration creating all 7 tables

## Decisions Made
- ActivityStatusHistory uses enum values (FromStatus/ToStatus as ActivityStatus) unlike DealStageHistory which uses FK to PipelineStage -- activities have fixed workflow states, not configurable pipeline stages
- ActivityLink is polymorphic (EntityType string + EntityId Guid) with no FK constraints -- enables flexible linking to any CRM entity type without coupling
- ActivityFollower uses Cascade delete on User FK (user removal clears follow subscriptions) unlike other child entity user FKs which use SetNull

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Activity data model complete, ready for Plan 02 (repository and service layer)
- All 7 entity types registered in ApplicationDbContext with proper tenant filtering
- Migration ready to apply against the database
- RLS policy ready for production deployment

## Self-Check: PASSED

- All 18 created files verified present on disk
- Task 1 commit `74dadd8` verified in git log
- Task 2 commit `6b9f0bd` verified in git log
- `dotnet build` passes with 0 errors

---
*Phase: 05-activities-and-workflow*
*Completed: 2026-02-17*

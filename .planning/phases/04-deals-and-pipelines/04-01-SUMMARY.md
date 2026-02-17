---
phase: 04-deals-and-pipelines
plan: 01
subsystem: database
tags: [ef-core, postgresql, domain-entities, jsonb, rls, multi-tenancy, pipelines, deals]

# Dependency graph
requires:
  - phase: 03-core-crm-entities
    provides: "Company, Contact, Product entities and configurations (FK targets for Deal)"
  - phase: 02-core-infrastructure
    provides: "RBAC (Team entity for Pipeline.TeamId), JSONB custom fields pattern, RLS infrastructure"
provides:
  - "Pipeline entity with tenant scope, optional team scope, and IsDefault flag"
  - "PipelineStage entity with SortOrder, DefaultProbability, terminal states (IsWon/IsLost), JSONB RequiredFields"
  - "Deal entity with pipeline/stage FK, ownership, company link, JSONB custom fields"
  - "DealContact join entity for deal-contact many-to-many linking"
  - "DealProduct join entity with quantity and price override"
  - "DealStageHistory entity for stage transition audit trail"
  - "EF Core configurations for all 6 entities with snake_case naming"
  - "ApplicationDbContext DbSets and query filters for Pipeline and Deal"
  - "RLS policies for pipelines and deals tables"
  - "AddDealsAndPipelines migration creating all 6 tables"
affects: [04-deals-and-pipelines, 05-activities-notes]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Child entity FK isolation: PipelineStage, DealContact, DealProduct, DealStageHistory inherit tenant via parent FK"
    - "Composite PK for join entities: DealContact(DealId,ContactId), DealProduct(DealId,ProductId)"
    - "JSONB RequiredFields on PipelineStage for stage-gate validation metadata"
    - "Restrict delete on Pipeline/Stage with active Deals (referential integrity)"

key-files:
  created:
    - src/GlobCRM.Domain/Entities/Pipeline.cs
    - src/GlobCRM.Domain/Entities/PipelineStage.cs
    - src/GlobCRM.Domain/Entities/Deal.cs
    - src/GlobCRM.Domain/Entities/DealContact.cs
    - src/GlobCRM.Domain/Entities/DealProduct.cs
    - src/GlobCRM.Domain/Entities/DealStageHistory.cs
    - src/GlobCRM.Infrastructure/Persistence/Configurations/PipelineConfiguration.cs
    - src/GlobCRM.Infrastructure/Persistence/Configurations/PipelineStageConfiguration.cs
    - src/GlobCRM.Infrastructure/Persistence/Configurations/DealConfiguration.cs
    - src/GlobCRM.Infrastructure/Persistence/Configurations/DealContactConfiguration.cs
    - src/GlobCRM.Infrastructure/Persistence/Configurations/DealProductConfiguration.cs
    - src/GlobCRM.Infrastructure/Persistence/Configurations/DealStageHistoryConfiguration.cs
    - src/GlobCRM.Infrastructure/Persistence/Migrations/App/20260217073317_AddDealsAndPipelines.cs
  modified:
    - src/GlobCRM.Domain/Entities/Company.cs
    - src/GlobCRM.Infrastructure/Persistence/ApplicationDbContext.cs
    - scripts/rls-setup.sql

key-decisions:
  - "Child entities (PipelineStage, DealContact, DealProduct, DealStageHistory) have no TenantId -- tenant isolation inherited via parent FK"
  - "Pipeline.TeamId uses SetNull delete behavior -- pipeline survives team deletion but loses team scope"
  - "Deal uses Restrict delete on PipelineId and PipelineStageId -- can't delete pipeline/stage with active deals"
  - "DealProduct.UnitPrice is nullable decimal(18,4) -- null means use Product.UnitPrice as default"

patterns-established:
  - "Join entity with composite PK and cascade delete from both sides (DealContact, DealProduct)"
  - "Stage transition audit trail pattern: DealStageHistory with FromStage/ToStage/ChangedBy"
  - "JSONB RequiredFields on stage for declarative stage-gate validation"

# Metrics
duration: 3min
completed: 2026-02-17
---

# Phase 04 Plan 01: Domain Entities Summary

**6 deal/pipeline domain entities with EF Core configs, JSONB custom fields, RLS policies, and AddDealsAndPipelines migration**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-17T07:30:30Z
- **Completed:** 2026-02-17T07:34:17Z
- **Tasks:** 2
- **Files modified:** 18

## Accomplishments
- Created 6 domain entities: Pipeline, PipelineStage, Deal, DealContact, DealProduct, DealStageHistory
- Created 6 EF Core configurations with snake_case naming, proper FK constraints, cascade rules, and indexes
- Updated ApplicationDbContext with 6 new DbSets and query filters for Pipeline and Deal
- Added RLS policies for pipelines and deals tables (triple-layer tenant isolation)
- Generated AddDealsAndPipelines migration creating all tables with GIN indexes on JSONB columns

## Task Commits

Each task was committed atomically:

1. **Task 1: Create domain entities** - `46032b9` (feat)
2. **Task 2: EF Core configs, DbContext, RLS, migration** - `55dd9f1` (feat)

## Files Created/Modified
- `src/GlobCRM.Domain/Entities/Pipeline.cs` - Pipeline entity with tenant scope, optional team, IsDefault
- `src/GlobCRM.Domain/Entities/PipelineStage.cs` - Stage with SortOrder, DefaultProbability, IsWon/IsLost, JSONB RequiredFields
- `src/GlobCRM.Domain/Entities/Deal.cs` - Deal with pipeline/stage FK, ownership, company link, JSONB custom fields
- `src/GlobCRM.Domain/Entities/DealContact.cs` - Many-to-many join for deal-contact linking
- `src/GlobCRM.Domain/Entities/DealProduct.cs` - Many-to-many join with quantity and price override
- `src/GlobCRM.Domain/Entities/DealStageHistory.cs` - Stage transition audit trail
- `src/GlobCRM.Domain/Entities/Company.cs` - Added Deals navigation collection
- `src/GlobCRM.Infrastructure/Persistence/Configurations/PipelineConfiguration.cs` - Pipeline EF Core config
- `src/GlobCRM.Infrastructure/Persistence/Configurations/PipelineStageConfiguration.cs` - PipelineStage EF Core config
- `src/GlobCRM.Infrastructure/Persistence/Configurations/DealConfiguration.cs` - Deal EF Core config with GIN index
- `src/GlobCRM.Infrastructure/Persistence/Configurations/DealContactConfiguration.cs` - Composite PK join config
- `src/GlobCRM.Infrastructure/Persistence/Configurations/DealProductConfiguration.cs` - Composite PK join config
- `src/GlobCRM.Infrastructure/Persistence/Configurations/DealStageHistoryConfiguration.cs` - Audit trail config
- `src/GlobCRM.Infrastructure/Persistence/ApplicationDbContext.cs` - Added 6 DbSets and 2 query filters
- `scripts/rls-setup.sql` - Added RLS policies for pipelines and deals tables
- `src/GlobCRM.Infrastructure/Persistence/Migrations/App/20260217073317_AddDealsAndPipelines.cs` - Migration

## Decisions Made
- Child entities (PipelineStage, DealContact, DealProduct, DealStageHistory) have no TenantId -- tenant isolation inherited via parent FK (consistent with Phase 2 RBAC pattern)
- Pipeline.TeamId uses SetNull delete behavior -- pipeline survives team deletion but loses team scope
- Deal uses Restrict delete on PipelineId and PipelineStageId -- prevents data integrity issues from pipeline/stage deletion with active deals
- DealProduct.UnitPrice is nullable decimal(18,4) -- null means use Product.UnitPrice as default price

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All 6 domain entities ready for repository and service layer implementation (04-02, 04-03)
- Company entity updated with Deals navigation for cross-entity queries
- Migration ready to apply to database when backend starts

## Self-Check: PASSED

All 13 created files verified on disk. Both task commits (46032b9, 55dd9f1) verified in git log.

---
*Phase: 04-deals-and-pipelines*
*Completed: 2026-02-17*

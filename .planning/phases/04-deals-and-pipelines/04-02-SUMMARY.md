---
phase: 04-deals-and-pipelines
plan: 02
subsystem: api
tags: [ef-core, repository-pattern, pagination, ownership-scope, pipeline, deal, kanban, seed-data]

# Dependency graph
requires:
  - phase: 04-deals-and-pipelines
    plan: 01
    provides: "Pipeline, PipelineStage, Deal, DealContact, DealProduct, DealStageHistory domain entities and EF Core configs"
  - phase: 03-core-crm-entities
    plan: 04
    provides: "CompanyRepository pattern, CrmEntityServiceExtensions, TenantSeeder entity creation pattern"
provides:
  - "IPipelineRepository with GetAllAsync, GetByIdWithStagesAsync, HasDealsInStageAsync"
  - "IDealRepository with GetPagedAsync (pipeline/stage filters, ownership scope), GetByPipelineForKanbanAsync, GetByIdWithLinksAsync, GetStageHistoryAsync"
  - "PipelineRepository with ordered stage includes and default pipeline ordering"
  - "DealRepository with full filter/sort/page/scope pipeline following CompanyRepository pattern"
  - "TenantSeeder creates default Sales Pipeline with 6 stages and sample deals for new tenants"
  - "CrmEntityServiceExtensions registers Pipeline and Deal repositories"
affects: [04-03, 04-04, 04-05, 04-06, 04-07, 04-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Deal repository with pipeline/stage filtering extending the standard ownership scope pattern"
    - "Kanban query pattern: single query loading all non-terminal deals with client-side stage grouping"
    - "Deal detail deep include: Stage, Pipeline, Company, Owner, DealContacts.Contact, DealProducts.Product"
    - "Stage history query with FromStage/ToStage/ChangedByUser includes for timeline display"

key-files:
  created:
    - src/GlobCRM.Domain/Interfaces/IPipelineRepository.cs
    - src/GlobCRM.Domain/Interfaces/IDealRepository.cs
    - src/GlobCRM.Infrastructure/Persistence/Repositories/PipelineRepository.cs
    - src/GlobCRM.Infrastructure/Persistence/Repositories/DealRepository.cs
  modified:
    - src/GlobCRM.Infrastructure/CrmEntities/CrmEntityServiceExtensions.cs
    - src/GlobCRM.Infrastructure/MultiTenancy/TenantSeeder.cs

key-decisions:
  - "DealRepository follows CompanyRepository pattern exactly for filter/sort/pagination with ParameterReplacer expression composition"
  - "Kanban query excludes terminal stages (IsWon/IsLost) by default with includeTerminal toggle"
  - "PipelineStageSeed extended with DefaultProbability, IsWon, IsLost for complete stage metadata"
  - "Deal seed data links to seeded companies and pipeline stages with ExpectedCloseDate offset by 30-day increments"

patterns-established:
  - "Pipeline repository: admin-config entity pattern (no ownership scope, ordered stages via Include)"
  - "Deal Kanban loading: single pipeline query with ownership scope, terminal stage exclusion, Value descending sort"
  - "Deal detail with links: deep include pattern for join entities (DealContacts.Contact, DealProducts.Product)"

# Metrics
duration: 4min
completed: 2026-02-17
---

# Phase 04 Plan 02: Repository Layer & Seed Data Summary

**Pipeline and Deal repositories with ownership scope, pipeline filtering, Kanban loading, stage history queries, and TenantSeeder wiring for default pipeline with 6 stages and sample deals**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-17T08:08:31Z
- **Completed:** 2026-02-17T08:12:31Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Created IPipelineRepository and PipelineRepository with full CRUD and stage management (HasDealsInStageAsync for safe deletion)
- Created IDealRepository and DealRepository following CompanyRepository pattern with pipeline/stage filtering, ownership scope, Kanban loading, and stage history
- Wired TenantSeeder to create default Sales Pipeline with 6 stages (Lead through Closed Won/Lost with DefaultProbability) and sample deals linked to seeded companies
- Registered both repositories in CrmEntityServiceExtensions DI container

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Pipeline and Deal repository interfaces and implementations** - `9376ce4` (feat)
2. **Task 2: Wire TenantSeeder to create Pipeline, PipelineStage, and Deal seed data** - `af13a26` (feat)

## Files Created/Modified
- `src/GlobCRM.Domain/Interfaces/IPipelineRepository.cs` - Pipeline repository interface with GetAllAsync, GetByIdWithStagesAsync, HasDealsInStageAsync
- `src/GlobCRM.Domain/Interfaces/IDealRepository.cs` - Deal repository interface with GetPagedAsync, GetByPipelineForKanbanAsync, GetByIdWithLinksAsync, GetStageHistoryAsync
- `src/GlobCRM.Infrastructure/Persistence/Repositories/PipelineRepository.cs` - Pipeline repository with ordered stage includes and default pipeline ordering
- `src/GlobCRM.Infrastructure/Persistence/Repositories/DealRepository.cs` - Deal repository with full filter/sort/page/scope pipeline, Kanban loading, stage history
- `src/GlobCRM.Infrastructure/CrmEntities/CrmEntityServiceExtensions.cs` - Added IPipelineRepository and IDealRepository DI registrations
- `src/GlobCRM.Infrastructure/MultiTenancy/TenantSeeder.cs` - Pipeline, PipelineStage, and Deal entity creation from manifest; PipelineStageSeed extended

## Decisions Made
- DealRepository follows CompanyRepository pattern exactly for filter/sort/pagination with ParameterReplacer expression composition (consistency with established pattern)
- Kanban query excludes terminal stages (IsWon/IsLost) by default with includeTerminal toggle (performance optimization for active deals)
- PipelineStageSeed extended with DefaultProbability, IsWon, IsLost for complete stage metadata (deviation Rule 2: missing critical properties for correct seeding)
- Deal seed data links to seeded companies and pipeline stages with ExpectedCloseDate offset by 30-day increments (future dates for realistic demo data)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added DefaultProbability, IsWon, IsLost to PipelineStageSeed**
- **Found during:** Task 2 (TenantSeeder wiring)
- **Issue:** PipelineStageSeed lacked DefaultProbability, IsWon, IsLost properties needed to create complete PipelineStage entities
- **Fix:** Added the three properties to PipelineStageSeed and populated them in the seed manifest (10%, 25%, 50%, 75%, 100% IsWon, 0% IsLost)
- **Files modified:** src/GlobCRM.Infrastructure/MultiTenancy/TenantSeeder.cs
- **Verification:** Build succeeds, all properties mapped correctly
- **Committed in:** af13a26 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Auto-fix was necessary for correct PipelineStage seeding. Plan already anticipated this: "Update them if needed (add Color, DefaultProbability, IsWon, IsLost to StageSeed if missing)."

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Pipeline and Deal repositories ready for controller injection (04-03)
- Kanban query ready for frontend Kanban board component (04-05, 04-06)
- Stage history query ready for deal detail timeline (04-08)
- TenantSeeder creates complete demo pipeline with stages and deals for new organizations
- All 6 entity types have complete data access layer

## Self-Check: PASSED

All 4 created files verified on disk. Both task commits (9376ce4, af13a26) verified in git log. Solution builds with 0 errors.

---
*Phase: 04-deals-and-pipelines*
*Completed: 2026-02-17*

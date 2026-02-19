---
phase: 20-advanced-reporting-builder
plan: 01
subsystem: database
tags: [ef-core, jsonb, rls, repository, reporting, system-linq-dynamic-core]

# Dependency graph
requires:
  - phase: 19-workflow-automation
    provides: "JSONB owned entity pattern (WorkflowDefinition), EF Core ToJson() configuration"
provides:
  - "Report entity with JSONB ReportDefinition (fields, filters, groupings, chart config)"
  - "ReportCategory entity for organizing reports"
  - "IReportRepository with CRUD + access control + category management"
  - "ReportChartType, AggregationType, FilterLogic enums"
  - "EntityType.Report for RBAC permission auto-generation"
  - "System.Linq.Dynamic.Core NuGet package for dynamic query building"
affects: [20-02, 20-03, 20-04, 20-05, 20-06]

# Tech tracking
tech-stack:
  added: [System.Linq.Dynamic.Core 1.6.2]
  patterns: [JSONB recursive filter tree, report definition owned entity]

key-files:
  created:
    - src/GlobCRM.Domain/Entities/Report.cs
    - src/GlobCRM.Domain/Entities/ReportCategory.cs
    - src/GlobCRM.Domain/Enums/ReportChartType.cs
    - src/GlobCRM.Domain/Enums/AggregationType.cs
    - src/GlobCRM.Domain/Enums/FilterLogic.cs
    - src/GlobCRM.Domain/Interfaces/IReportRepository.cs
    - src/GlobCRM.Infrastructure/Persistence/Configurations/ReportConfiguration.cs
    - src/GlobCRM.Infrastructure/Persistence/Configurations/ReportCategoryConfiguration.cs
    - src/GlobCRM.Infrastructure/Reporting/ReportRepository.cs
    - src/GlobCRM.Infrastructure/Persistence/Migrations/App/20260219174256_AddReports.cs
  modified:
    - src/GlobCRM.Domain/Enums/EntityType.cs
    - src/GlobCRM.Infrastructure/Persistence/ApplicationDbContext.cs
    - src/GlobCRM.Infrastructure/DependencyInjection.cs
    - src/GlobCRM.Infrastructure/GlobCRM.Infrastructure.csproj
    - scripts/rls-setup.sql

key-decisions:
  - "ReportDefinition uses recursive ReportFilterGroup with nested Groups for complex AND/OR filter trees"
  - "Report access control via OwnerId/IsShared/IsSeedData triple -- no separate sharing table"
  - "Three levels of filter group nesting supported in EF Core owned type mapping"

patterns-established:
  - "Recursive JSONB filter tree: ReportFilterGroup owns Conditions and child Groups with nested OwnsMany"
  - "Report access pattern: owner OR shared OR seedData query filter in repository"

requirements-completed: [RPT-01, RPT-05]

# Metrics
duration: 5min
completed: 2026-02-19
---

# Phase 20 Plan 01: Report Domain Foundation Summary

**Report/ReportCategory entities with JSONB definition (fields, recursive filter tree, groupings, chart config), EF Core migration, RLS tenant isolation, and repository with access control**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-19T17:39:10Z
- **Completed:** 2026-02-19T17:43:45Z
- **Tasks:** 2
- **Files modified:** 17

## Accomplishments
- Report entity with full JSONB ReportDefinition supporting fields, recursive AND/OR filter tree, groupings, and chart configuration
- ReportCategory entity with unique tenant-scoped name constraint for report organization
- EF Core migration creating reports and report_categories tables with composite indexes
- RLS policies enforcing tenant isolation on both tables
- ReportRepository with access-controlled listing (owner/shared/seed) and full CRUD
- System.Linq.Dynamic.Core NuGet package installed for future dynamic query building
- EntityType.Report added for RBAC permission auto-generation

## Task Commits

Each task was committed atomically:

1. **Task 1: Domain entities, enums, and repository interface** - `ee6b21d` (feat)
2. **Task 2: EF Core configurations, migration, RLS, repository, NuGet, DI** - `29cfdb1` (feat)

## Files Created/Modified
- `src/GlobCRM.Domain/Entities/Report.cs` - Report entity + ReportDefinition + nested JSONB types (ReportField, ReportFilterGroup, ReportFilterCondition, ReportGrouping, ReportChartConfig)
- `src/GlobCRM.Domain/Entities/ReportCategory.cs` - Category entity for organizing reports
- `src/GlobCRM.Domain/Enums/ReportChartType.cs` - Table, Bar, Line, Pie, Funnel chart types
- `src/GlobCRM.Domain/Enums/AggregationType.cs` - Count, Sum, Average, Min, Max aggregations
- `src/GlobCRM.Domain/Enums/FilterLogic.cs` - And/Or logic for filter groups
- `src/GlobCRM.Domain/Enums/EntityType.cs` - Added Report value for RBAC
- `src/GlobCRM.Domain/Interfaces/IReportRepository.cs` - Repository interface with CRUD + access control + category management
- `src/GlobCRM.Infrastructure/Persistence/Configurations/ReportConfiguration.cs` - EF Core config with JSONB owned types, FKs, composite indexes
- `src/GlobCRM.Infrastructure/Persistence/Configurations/ReportCategoryConfiguration.cs` - EF Core config with unique (TenantId, Name) constraint
- `src/GlobCRM.Infrastructure/Reporting/ReportRepository.cs` - Repository implementation with access-controlled queries
- `src/GlobCRM.Infrastructure/Persistence/ApplicationDbContext.cs` - Added DbSets, configurations, global query filters
- `src/GlobCRM.Infrastructure/DependencyInjection.cs` - Registered IReportRepository
- `src/GlobCRM.Infrastructure/GlobCRM.Infrastructure.csproj` - Added System.Linq.Dynamic.Core package
- `scripts/rls-setup.sql` - RLS policies for reports and report_categories tables

## Decisions Made
- ReportDefinition uses recursive ReportFilterGroup with nested Groups for complex AND/OR filter trees (matches established pattern from WorkflowDefinition)
- Report access control via OwnerId/IsShared/IsSeedData triple in repository query -- no separate sharing/permissions table needed at this stage
- Three levels of filter group nesting supported in EF Core owned type mapping (sufficient for most filter UIs)
- ReportChartConfig stored inside ReportDefinition JSONB (not as separate columns) for flexibility

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Cleaned corrupted bin/obj directory structure**
- **Found during:** Task 2 (migration creation)
- **Issue:** Recursive `bin/Debug/net10.0/bin/Debug/net10.0/...` directory nesting caused path-too-long build errors
- **Fix:** Removed corrupted bin/obj directories and restored with clean build
- **Files modified:** None (build artifacts only)
- **Verification:** Build and migration both succeeded after clean

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Pre-existing build artifact corruption resolved. No scope creep.

## Issues Encountered
None beyond the build artifact issue documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Report domain foundation complete with entities, migration, RLS, and repository
- Ready for Plan 02: Report API endpoints (controller, DTOs, validators)
- System.Linq.Dynamic.Core available for dynamic query execution engine (Plan 03+)

## Self-Check: PASSED

All 10 created files verified present. Both task commits (ee6b21d, 29cfdb1) verified in git log.

---
*Phase: 20-advanced-reporting-builder*
*Completed: 2026-02-19*

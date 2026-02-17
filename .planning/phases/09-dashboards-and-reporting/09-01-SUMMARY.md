---
phase: 09-dashboards-and-reporting
plan: 01
subsystem: database
tags: [ef-core, postgresql, rls, jsonb, dashboard, widget, target, kpi]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: "ApplicationDbContext, RLS setup, tenant isolation pattern"
  - phase: 02-core-infrastructure
    provides: "SavedView ownership pattern (OwnerId null = team-wide)"
provides:
  - "Dashboard entity with ownership pattern (null OwnerId = team-wide)"
  - "DashboardWidget entity with gridster2 position and JSONB config"
  - "Target entity with 20 MetricType values and configurable periods"
  - "WidgetType, TargetPeriod, MetricType enums"
  - "IDashboardRepository and ITargetRepository interfaces"
  - "EF Core configurations with snake_case, JSONB, string enums"
  - "Database migration creating dashboards, dashboard_widgets, targets tables"
  - "RLS policies on dashboards and targets tables"
affects: [09-02, 09-03, 09-04, 09-05, 09-06, 09-07, 09-08]

# Tech tracking
tech-stack:
  added: []
  patterns: [dashboard-ownership-pattern, child-entity-jsonb-config, kpi-target-tracking]

key-files:
  created:
    - src/GlobCRM.Domain/Entities/Dashboard.cs
    - src/GlobCRM.Domain/Entities/DashboardWidget.cs
    - src/GlobCRM.Domain/Entities/Target.cs
    - src/GlobCRM.Domain/Enums/WidgetType.cs
    - src/GlobCRM.Domain/Enums/TargetPeriod.cs
    - src/GlobCRM.Domain/Enums/MetricType.cs
    - src/GlobCRM.Domain/Interfaces/IDashboardRepository.cs
    - src/GlobCRM.Domain/Interfaces/ITargetRepository.cs
    - src/GlobCRM.Infrastructure/Persistence/Configurations/DashboardConfiguration.cs
    - src/GlobCRM.Infrastructure/Persistence/Configurations/DashboardWidgetConfiguration.cs
    - src/GlobCRM.Infrastructure/Persistence/Configurations/TargetConfiguration.cs
    - src/GlobCRM.Infrastructure/Persistence/Migrations/App/20260217181113_AddDashboardEntities.cs
  modified:
    - src/GlobCRM.Infrastructure/Persistence/ApplicationDbContext.cs
    - scripts/rls-setup.sql

key-decisions:
  - "Dashboard follows SavedView OwnerId pattern (null = team-wide, non-null = personal)"
  - "DashboardWidget is a child entity with no TenantId -- inherits via Dashboard FK"
  - "Widget Config uses Dictionary<string,object> with System.Text.Json HasConversion for JSONB"
  - "MetricType enum covers 20 metrics across Deals, Activities, Quotes, Contacts, Companies, Requests"

patterns-established:
  - "Dashboard ownership: OwnerId null = team-wide (admin), non-null = personal"
  - "JSONB config on child entity: Dictionary<string,object> with explicit JsonSerializer value converter"

# Metrics
duration: 4min
completed: 2026-02-17
---

# Phase 9 Plan 1: Domain Entities Summary

**Dashboard, DashboardWidget, and Target domain entities with 20 MetricType values, gridster2 widget layout, JSONB config, EF Core configurations, and RLS policies**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-17T18:08:18Z
- **Completed:** 2026-02-17T18:12:02Z
- **Tasks:** 2
- **Files modified:** 16

## Accomplishments
- Three domain entities (Dashboard, DashboardWidget, Target) following established codebase patterns
- Three enums (WidgetType with 7 types, TargetPeriod with 5 periods, MetricType with 20 metrics)
- Two repository interfaces (IDashboardRepository, ITargetRepository) for CRUD and metric queries
- Three EF Core configurations with snake_case columns, JSONB for widget config, string-stored enums
- Database migration creating all tables with indexes (tenant_owner, tenant_metric, dashboard)
- RLS policies on dashboards and targets for triple-layer tenant isolation

## Task Commits

Each task was committed atomically:

1. **Task 1: Domain entities, enums, and repository interfaces** - `bae994e` (feat)
2. **Task 2: EF Core configurations, DbContext update, migration, and RLS** - `016aead` (feat)

## Files Created/Modified
- `src/GlobCRM.Domain/Entities/Dashboard.cs` - Dashboard entity with OwnerId pattern (null=team, non-null=personal)
- `src/GlobCRM.Domain/Entities/DashboardWidget.cs` - Widget with gridster2 position (X,Y,Cols,Rows) and JSONB Config
- `src/GlobCRM.Domain/Entities/Target.cs` - KPI target with MetricType, TargetPeriod, TargetValue, date range
- `src/GlobCRM.Domain/Enums/WidgetType.cs` - KpiCard, BarChart, LineChart, PieChart, Leaderboard, Table, TargetProgress
- `src/GlobCRM.Domain/Enums/TargetPeriod.cs` - Daily, Weekly, Monthly, Quarterly, Yearly
- `src/GlobCRM.Domain/Enums/MetricType.cs` - 20 metrics across Deals, Activities, Quotes, Contacts, Companies, Requests
- `src/GlobCRM.Domain/Interfaces/IDashboardRepository.cs` - CRUD + GetAllAsync(ownerId) + GetDefaultAsync(ownerId)
- `src/GlobCRM.Domain/Interfaces/ITargetRepository.cs` - CRUD + GetAllAsync(ownerId) + GetByMetricAsync(metric, ownerId)
- `src/GlobCRM.Infrastructure/Persistence/Configurations/DashboardConfiguration.cs` - Table "dashboards", OwnerId FK SetNull, cascade widgets
- `src/GlobCRM.Infrastructure/Persistence/Configurations/DashboardWidgetConfiguration.cs` - Table "dashboard_widgets", JSONB config, string WidgetType
- `src/GlobCRM.Infrastructure/Persistence/Configurations/TargetConfiguration.cs` - Table "targets", string MetricType/Period, precision(18,4)
- `src/GlobCRM.Infrastructure/Persistence/ApplicationDbContext.cs` - Added 3 DbSets, 3 configurations, 2 query filters
- `scripts/rls-setup.sql` - Added RLS policies for dashboards and targets tables
- `src/GlobCRM.Infrastructure/Persistence/Migrations/App/20260217181113_AddDashboardEntities.cs` - Migration

## Decisions Made
- Dashboard follows SavedView OwnerId pattern (null = team-wide, non-null = personal)
- DashboardWidget is child entity with no TenantId -- inherits tenant isolation via Dashboard FK
- Widget Config stored as Dictionary<string,object> with System.Text.Json HasConversion for JSONB (matching ApplicationUser SocialLinks pattern)
- MetricType enum covers all 20 metrics from research across 6 entity categories

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Domain entities and database tables ready for repository implementations (Plan 02)
- All 20 MetricType values available for metric calculation services (Plan 03+)
- Dashboard widget configuration supports gridster2 layout management (Plan 05+)

## Self-Check: PASSED

All 12 created files verified on disk. Both task commits (bae994e, 016aead) confirmed in git log.

---
*Phase: 09-dashboards-and-reporting*
*Completed: 2026-02-17*

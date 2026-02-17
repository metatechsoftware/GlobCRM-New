---
phase: 09-dashboards-and-reporting
plan: 03
subsystem: api
tags: [asp-net-core, rest-api, dashboard, metrics, rbac, kpi-targets, batch-endpoint]

# Dependency graph
requires:
  - phase: 09-dashboards-and-reporting
    plan: 01
    provides: "Dashboard, DashboardWidget, Target entities, IDashboardRepository, ITargetRepository interfaces, MetricType enum"
  - phase: 09-dashboards-and-reporting
    plan: 02
    provides: "DashboardRepository, TargetRepository, DashboardAggregationService, DI registration"
  - phase: 02-core-infrastructure
    provides: "IPermissionService, PermissionScope, RBAC ownership pattern"
provides:
  - "DashboardsController with 10 REST endpoints (5 dashboard, 1 widget-data, 4 target)"
  - "Dashboard CRUD with ownership enforcement (personal=owner, team-wide=admin)"
  - "Batched widget-data POST endpoint resolving RBAC scope per metric entity type"
  - "Target CRUD with computed current value and progress percentage from aggregation service"
  - "MetricType-to-entity-type mapping for per-widget RBAC scope resolution"
affects: [09-04, 09-05, 09-06, 09-07, 09-08]

# Tech tracking
tech-stack:
  added: []
  patterns: [dashboard-ownership-enforcement, per-metric-rbac-scope-resolution, batched-metric-endpoint]

key-files:
  created:
    - src/GlobCRM.Api/Controllers/DashboardsController.cs
  modified: []

key-decisions:
  - "Dashboard ownership: personal dashboards editable by owner only, team-wide dashboards editable by admin only (read access for all team-wide)"
  - "Widget data endpoint resolves RBAC scope per metric's entity type (Deal, Activity, Quote, Contact, Company, Request) via GetEntityTypeForMetric mapping"
  - "Target list computes current value per target by calling aggregation service with target's metric/date range (sequential, not parallel)"
  - "Leaderboard metrics (SalesLeaderboard, ActivityLeaderboard) fall back to Deal:View scope since they cross entity types"

patterns-established:
  - "Per-metric RBAC scope: controller maps MetricType to entity type, resolves permission, passes scope to aggregation service"
  - "Dashboard/Target ownership helpers (CanAccessDashboard, CanEditDashboard, CanEditTarget) for DRY access control"

# Metrics
duration: 2min
completed: 2026-02-17
---

# Phase 9 Plan 3: DashboardsController Summary

**DashboardsController with 10 REST endpoints covering dashboard CRUD, batched widget metric data with per-entity RBAC scope, and KPI target CRUD with live progress computation**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-17T18:22:14Z
- **Completed:** 2026-02-17T18:24:33Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- 10 REST endpoints: 5 dashboard CRUD, 1 batched widget-data POST, 4 target CRUD
- Dashboard ownership enforcement: personal (owner-only edit), team-wide (admin-only create/edit, all can read)
- Batched widget-data endpoint resolves RBAC scope per metric's entity type via IPermissionService
- Target list computes live current value and progress percentage from DashboardAggregationService
- All DTOs defined as records inside controller file (matching EmailsController/NotificationsController pattern)

## Task Commits

Each task was committed atomically:

1. **Task 1: DashboardsController with dashboard CRUD and widget data batch** - `d21fea5` (feat)

## Files Created/Modified
- `src/GlobCRM.Api/Controllers/DashboardsController.cs` - 10 endpoints: dashboard CRUD (5), widget-data batch (1), target CRUD (4) with ownership enforcement and RBAC-scoped metrics

## Decisions Made
- Dashboard ownership: personal dashboards editable by owner only, team-wide dashboards editable by admin only (read access for all team-wide)
- Widget data endpoint resolves RBAC scope per metric's entity type (Deal, Activity, Quote, Contact, Company, Request) via GetEntityTypeForMetric mapping
- Target list computes current value per target by calling aggregation service with target's metric/date range (sequential to avoid DbContext concurrency)
- Leaderboard metrics (SalesLeaderboard, ActivityLeaderboard) fall back to Deal:View scope since they are cross-entity metrics

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All 10 API endpoints ready for Angular frontend consumption (Plans 04-08)
- Dashboard CRUD wired through to DashboardRepository with full-replacement widget updates
- Target CRUD wired through to TargetRepository with live progress computation
- Widget-data batch endpoint ready for DashboardStore to call with multiple widgets per request

## Self-Check: PASSED

All 1 created file verified on disk. Task commit (d21fea5) confirmed in git log.

---
*Phase: 09-dashboards-and-reporting*
*Completed: 2026-02-17*

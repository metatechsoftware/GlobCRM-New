---
phase: 09-dashboards-and-reporting
verified: 2026-02-17T18:39:49Z
status: passed
score: 6/6 must-haves verified
re_verification: false
gaps:
  - truth: "Dashboard supports date range filters and drill-down into underlying data"
    status: partial
    reason: "Drill-down navigation is fully implemented. Date range filtering is wired. However saveLayout in DashboardStore patches activeDashboard with the 204 No Content response body from PUT /api/dashboards/{id}, setting activeDashboard to null/undefined after every drag-and-drop layout save — causing the dashboard to vanish from the UI until the user refreshes."
    artifacts:
      - path: "globcrm-web/src/app/features/dashboard/stores/dashboard.store.ts"
        issue: "saveLayout at line 200-204 calls api.updateDashboard() and does patchState({ activeDashboard: updated }) where 'updated' is the empty body of a 204 NoContent response, nulling out activeDashboard on every save"
      - path: "globcrm-web/src/app/features/dashboard/services/dashboard-api.service.ts"
        issue: "updateDashboard() returns Observable<DashboardDto> but the backend PUT endpoint returns 204 No Content (no body), so callers that consume the response value receive null/undefined"
    missing:
      - "Fix saveLayout in dashboard.store.ts to reload the dashboard after save instead of patching from the empty response: call this.loadDashboard(id) in the next callback instead of patchState({ activeDashboard: updated })"
human_verification:
  - test: "Widget drag-and-drop layout save"
    expected: "After dragging a widget to a new position and releasing, the dashboard remains visible with the new layout and 'Layout saved' snackbar appears"
    why_human: "The saveLayout bug causes activeDashboard to become null after the PUT response (204), which would collapse the grid. This can only be confirmed visually."
  - test: "Widget drill-down navigation"
    expected: "Clicking a KPI card widget in view mode navigates to /deals; clicking an activity chart navigates to /activities"
    why_human: "Requires browser interaction to verify router.navigate() fires and the route transition completes"
  - test: "Target progress visualization"
    expected: "After creating a target (e.g., 50 ActivityCount weekly), the progress card shows the current value vs target with a colored circular ring"
    why_human: "Requires live API data (current metric value computed server-side) to confirm the progress display"
  - test: "Admin team-wide dashboard creation"
    expected: "When logged in as Admin, creating a dashboard with 'Team-wide' checked makes it visible to all team members under 'Team Dashboards' in the selector"
    why_human: "Requires multi-user session to verify visibility scoping"
---

# Phase 9: Dashboards and Reporting Verification Report

**Phase Goal:** Configurable dashboards with widgets, KPIs, targets, and drill-down
**Verified:** 2026-02-17T18:39:49Z
**Status:** GAPS FOUND (1 wiring bug)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can view configurable dashboards with drag-and-drop widgets | VERIFIED | `DashboardGridComponent` uses angular-gridster2 12-column layout; drag/resize toggled via `isEditing` signal with `effect()` calling `gridOptions.api.optionsChanged()` |
| 2 | Dashboard widgets include charts (bar, line, pie), KPI cards, leaderboards, and tables | VERIFIED | `WidgetWrapperComponent` dispatches to `KpiCardComponent`, `ChartWidgetComponent` (bar/line/pie/doughnut), `LeaderboardComponent`, `TableWidgetComponent`, `TargetProgressComponent` |
| 3 | User can set numeric targets (e.g., 50 calls/week, $100K pipeline) and track progress | VERIFIED | `TargetManagementComponent` + `TargetFormDialogComponent` with all 20 metric types, period auto-dates, and `TargetProgressComponent` with conic-gradient circular display |
| 4 | Dashboard supports date range filters and drill-down into underlying data | PARTIAL | Date range filter with 5 presets is fully wired. Drill-down navigation (`METRIC_ROUTE_MAP`) is fully implemented. **Bug:** `saveLayout` in `DashboardStore` patches `activeDashboard` with the 204 No Content response body (null), nulling the active dashboard after every drag save |
| 5 | Admin can create team-wide dashboards visible to all users | VERIFIED | Backend enforces `isTeamWide` → `OwnerId = null` with Admin role check; `DashboardSelectorComponent` groups by `ownerId === null` as "Team Dashboards" |
| 6 | User can create personal dashboards for individual tracking | VERIFIED | `CreateDashboardDialogComponent` (inline) with `isTeamWide=false` sets `OwnerId = userId`; personal dashboards appear under "My Dashboards" group |

**Score:** 5/6 truths verified (1 partial with wiring bug)

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `globcrm-web/src/app/features/dashboard/pages/dashboard/dashboard.component.ts` | Dashboard page with store provider and all sub-components | VERIFIED | 256 lines; `DashboardStore` provided at component level; imports `DashboardGridComponent`, `DashboardSelectorComponent`, `DateRangeFilterComponent`, `TargetManagementComponent`, `MatTabsModule` |
| `globcrm-web/src/app/features/dashboard/pages/dashboard/dashboard.component.html` | `mat-tab-group` with Dashboard and Targets tabs | VERIFIED | `<mat-tab-group>` with "Dashboard" (gridster grid) and "Targets" (`app-target-management`) tabs |
| `globcrm-web/src/app/features/dashboard/components/widget-wrapper/widget-wrapper.component.ts` | Widget dispatcher with drill-down navigation | VERIFIED | `METRIC_ROUTE_MAP` maps all 20 `MetricType` values to 6 entity routes; `onDrillDown()` calls `router.navigate([route])` in view mode only |
| `globcrm-web/src/app/features/dashboard/components/dashboard-grid/dashboard-grid.component.ts` | angular-gridster2 grid with drag/resize | VERIFIED | 161 lines; `GridsterModule`, 12-column `verticalFixed` layout, `effect()` toggling drag/resize via `isEditing` signal |
| `globcrm-web/src/app/features/dashboard/components/dashboard-selector/dashboard-selector.component.ts` | Dashboard switcher with personal/team grouping | VERIFIED | `personalDashboards` and `teamDashboards` computed signals; Admin-only delete button on team dashboards |
| `globcrm-web/src/app/features/dashboard/components/date-range-filter/date-range-filter.component.ts` | Date range with 5 presets and custom picker | VERIFIED | 5 preset buttons (today/week/month/quarter/year) + custom `mat-date-range-input`; UTC ISO conversion |
| `globcrm-web/src/app/features/dashboard/components/target-management/target-management.component.ts` | Target list grid with add/edit/delete | VERIFIED | 259 lines; 3-column responsive grid; `onAddTarget`, `onEditTarget`, `onDeleteTarget` wired to `DashboardStore` |
| `globcrm-web/src/app/features/dashboard/components/target-form-dialog/target-form-dialog.component.ts` | Target creation dialog with grouped metrics and period auto-dates | VERIFIED | 315 lines; 20 metrics in 6 `mat-optgroup` groups; `autoComputeDates()` for all 5 periods |
| `globcrm-web/src/app/features/dashboard/components/widgets/kpi-card/kpi-card.component.ts` | KPI card with value formatting and optional progress | VERIFIED | `formattedValue()` computed signal with number/currency/percent formatting; optional CSS progress bar toward target |
| `globcrm-web/src/app/features/dashboard/components/widgets/chart-widget/chart-widget.component.ts` | Chart.js bar/line/pie/doughnut widget | VERIFIED | `BaseChartDirective`, `ResizeObserver` for responsive resize, 8-color design system palette |
| `globcrm-web/src/app/features/dashboard/stores/dashboard.store.ts` | Signal store with full dashboard state management | VERIFIED (with bug) | All CRUD methods implemented; `saveLayout` has return-type mismatch bug (see gaps) |
| `globcrm-web/src/app/features/dashboard/services/dashboard-api.service.ts` | HTTP service for all 10 API endpoints | VERIFIED | Covers 5 dashboard endpoints + 1 widget-data + 4 target endpoints |
| `src/GlobCRM.Api/Controllers/DashboardsController.cs` | 10 REST endpoints with ownership enforcement | VERIFIED | 813 lines; 5 dashboard CRUD + 1 batched widget-data + 4 target CRUD; `CanAccessDashboard`, `CanEditDashboard`, `CanEditTarget` helpers |
| `src/GlobCRM.Domain/Entities/Dashboard.cs` | Dashboard entity with OwnerId ownership pattern | VERIFIED | `OwnerId: Guid?` (null = team-wide); navigation to `Owner` and `Widgets` |
| `src/GlobCRM.Domain/Enums/MetricType.cs` | 20 metric types across 6 entity categories | VERIFIED | All 20 metrics present: 7 deal, 6 activity, 2 quote, 1 contact, 1 company, 2 request, 2 leaderboard |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `dashboard.component.ts` | `DashboardStore` | Component-level `providers: [DashboardStore]` + `inject(DashboardStore)` | WIRED | Store provided and injected; all methods called on `store.*` |
| `DashboardStore` | `DashboardApiService` | `inject(DashboardApiService)` inside `withMethods` | WIRED | All API calls wired: `getDashboards`, `getDashboard`, `createDashboard`, `updateDashboard`, `deleteDashboard`, `getWidgetData`, `getTargets`, `createTarget`, `updateTarget`, `deleteTarget` |
| `DashboardApiService` | `DashboardsController` `/api/dashboards` | `ApiService.get/post/put/delete` | WIRED | All 10 endpoint paths match controller routes |
| `DashboardGridComponent` | `WidgetWrapperComponent` | `import` + template `<app-widget-wrapper>` | WIRED | Widget data, target, and isEditing inputs bound; edit/remove outputs wired |
| `WidgetWrapperComponent` | Router (drill-down) | `router.navigate([route])` via `METRIC_ROUTE_MAP` | WIRED | All 20 metrics mapped; `onDrillDown()` checks `!isEditing()` before navigating |
| `TargetManagementComponent` | `DashboardStore` | `inject(DashboardStore)` | WIRED | `store.createTarget()`, `store.updateTarget()`, `store.deleteTarget()` all called |
| `saveLayout` | Backend PUT `/api/dashboards/{id}` | `api.updateDashboard()` + `patchState({activeDashboard: updated})` | BROKEN | Backend returns 204 No Content; `updated` is null/undefined; `patchState` sets `activeDashboard` to null, collapsing the grid |
| `DashboardsController` | `DashboardAggregationService` | Constructor injection + `ComputeMetricAsync()` | WIRED | All 20 switch cases implemented; called in both widget-data batch and target progress computation |
| `app.config.ts` | Chart.js | `provideCharts(withDefaultRegisterables())` | WIRED | Confirmed at line 19 of app.config.ts |
| `app.routes.ts` | `DASHBOARD_ROUTES` | Lazy-loaded at `path: 'dashboard'` | WIRED | Default redirect to 'dashboard'; routes confirmed at lines 19-24 and 124 |

---

## Requirements Coverage

| Requirement | Status | Notes |
|-------------|--------|-------|
| DASH-01: Configurable widgets | SATISFIED | angular-gridster2 with add/edit/remove via WidgetConfigDialogComponent |
| DASH-02: Data aggregation for 20 metrics | SATISFIED | DashboardAggregationService with all 20 MetricType switch cases + EF Core projections |
| DASH-03: Target tracking with numeric goals | SATISFIED | TargetManagementComponent, TargetFormDialogComponent, TargetProgressComponent, /api/targets CRUD |
| DASH-04: Drill-down into underlying data | SATISFIED | METRIC_ROUTE_MAP covering all 20 metrics → 6 entity routes; view-mode-only navigation |
| DASH-05: Date range filtering | SATISFIED | DateRangeFilterComponent with 5 presets + custom picker; wired through store.setDateRange() → loadWidgetData() |
| DASH-06: Dashboard management (personal + team) | SATISFIED | OwnerId null = team-wide (admin), non-null = personal; DashboardSelectorComponent with separate groups |

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `globcrm-web/src/app/features/dashboard/stores/dashboard.store.ts` | 200-204 | `patchState({ activeDashboard: updated })` where `updated` is 204 No Content body (null) | BLOCKER | After any drag-and-drop layout save, `activeDashboard` becomes null, the grid disappears, and the user sees the empty state until they reload |
| `globcrm-web/src/app/features/dashboard/services/dashboard-api.service.ts` | 41 | `updateDashboard()` typed as `Observable<DashboardDto>` but backend returns 204 with no body | WARNING | Type mismatch; the store's `updateDashboard` method correctly ignores the return value (uses `() =>` not `(updated) =>`), but `saveLayout` doesn't |

---

## Human Verification Required

### 1. Layout Save After Drag-and-Drop

**Test:** In edit mode, drag a widget to a new position on the grid and click "Done."
**Expected:** The dashboard remains visible with the new layout; "Layout saved" snackbar appears.
**Why human:** The `saveLayout` wiring bug will cause `activeDashboard` to be set to null after the PUT response, collapsing the grid. This needs visual confirmation.

### 2. Widget Drill-Down Click Navigation

**Test:** In view mode (not edit mode), click anywhere inside a KPI card widget.
**Expected:** The browser navigates to `/deals` (or the appropriate entity list) without page reload.
**Why human:** Requires browser interaction to confirm the click handler fires and Angular Router transitions.

### 3. Target Progress Ring Display

**Test:** Create a target "50 activity count weekly," then view the Targets tab.
**Expected:** A circular progress ring shows the current count vs 50, with color indicating status (green if on track, yellow/red if behind).
**Why human:** Progress computation requires live API data; visual correctness of the conic-gradient ring cannot be verified statically.

### 4. Admin Team-Wide Dashboard Visibility

**Test:** As Admin, create a dashboard with "Team-wide dashboard" checked. Then log in as a non-admin user.
**Expected:** The team dashboard appears in "Team Dashboards" group in the selector; the non-admin user can view but not delete it.
**Why human:** Requires two browser sessions with different roles; RBAC visibility scoping cannot be verified from code alone.

---

## Gaps Summary

One real bug was found that blocks part of Truth #4 (the drag-and-drop layout save aspect of "configurable dashboards"):

**saveLayout return-type mismatch:** In `DashboardStore`, `saveLayout()` calls `api.updateDashboard()` and then does `patchState(store, { activeDashboard: updated })` on the response. The backend `PUT /api/dashboards/{id}` returns HTTP 204 No Content with no body. Angular's HttpClient delivers `null` for a 204 response. This null overwrites `activeDashboard`, causing the dashboard grid to collapse to the empty state after every drag-and-drop save.

**Fix:** In `dashboard.store.ts`, change `saveLayout`'s subscribe callback from:
```typescript
next: (updated) => {
  patchState(store, { activeDashboard: updated });
}
```
to:
```typescript
next: () => {
  this.loadDashboard(dashboard.id);
}
```

This matches the pattern used in `updateDashboard()` (line 150-155), which correctly calls `this.loadDashboard(id)` rather than consuming the 204 response body.

All other wiring is substantive and complete. The 5 other success criteria are fully implemented and wired end-to-end: domain entities, EF Core configurations, migration, repository implementations, aggregation service with all 20 metrics, REST controller with RBAC, Angular models, API service, signal store, and all UI components (grid, widgets, selector, date filter, targets).

---

_Verified: 2026-02-17T18:39:49Z_
_Verifier: Claude (gsd-verifier)_

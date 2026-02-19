# Technology Stack: GlobCRM v1.2 Connected Experience

**Project:** GlobCRM v1.2 -- Connected Experience (Entity Preview, Summary Tabs, My Day Dashboard)
**Researched:** 2026-02-20
**Scope:** Stack ADDITIONS/CHANGES for v1.2 features only. Core stack (Angular 19, .NET 10, PostgreSQL 17) and v1.1 additions (Hangfire, Foblex, NCalc, etc.) are validated and unchanged.

---

## Executive Summary

v1.2 adds three interconnected UX capabilities: entity preview sidebars (slide-out panels showing entity details from feed/search), summary tabs on all major detail pages, and a personal "My Day" dashboard replacing the current home page. The critical finding is: **no new library installations are required**. Every v1.2 feature is buildable with the existing stack.

The existing stack already includes everything needed:
1. **Angular Material `MatDrawer`** (already in `@angular/material`) for the preview sidebar -- position it on the right with `mode="over"`
2. **`angular-gridster2`** (already installed, v19) for the "My Day" personal dashboard -- reuse the exact same `DashboardGridComponent` infrastructure
3. **Chart.js + ng2-charts** (already installed) for mini sparkline charts on summary tabs -- Chart.js natively supports minimal configurations with hidden axes
4. **`@angular/cdk` Overlay + BreakpointObserver** (already installed, already used) for responsive sidebar behavior
5. **FullCalendar** (already installed) for the "My Day" agenda/today view widget

This is a pure **architecture and component design** milestone, not a technology acquisition milestone.

---

## What We Already Have (DO NOT Add)

Every v1.2 feature maps to existing installed packages:

| Existing Component | v1.2 Usage | Confidence |
|---|---|---|
| **`@angular/material` MatSidenavModule** | `MatDrawer` with `position="end" mode="over"` for entity preview sidebar. Already in `package.json` as `@angular/material: ^19.2.19`. Module includes `MatDrawer`, `MatDrawerContainer`, `MatDrawerContent` -- designed for exactly this use case. | HIGH |
| **`@angular/cdk` BreakpointObserver** | Already used in `app.component.ts` and `navbar.component.ts`. Reuse for responsive sidebar behavior (auto-close on mobile, adjust width). | HIGH |
| **`@angular/cdk` DragDropModule** | Already used in kanban boards and sequence builder. NOT needed for v1.2 (gridster handles dashboard drag). | HIGH |
| **`angular-gridster2` v19** | Already powering org dashboard with full widget system (DashboardGridComponent, WidgetWrapperComponent, 5 widget types). "My Day" personal dashboard reuses this entire infrastructure -- just new widget types and a user-scoped dashboard entity. | HIGH |
| **Chart.js 4.5.1 + ng2-charts 8.0.0** | Already rendering bar, line, pie, doughnut charts in dashboard widgets. Summary tab mini-charts use the same library with `responsive: true`, hidden axes (`display: false` on scales), no legend, no tooltips -- pure sparkline config. No separate sparkline library needed. | HIGH |
| **FullCalendar 6.1.20** | Already used for calendar views. "My Day" agenda widget uses `@fullcalendar/list` plugin (may need to add this one plugin) for today's schedule view, or renders a custom component using the existing daygrid/timegrid plugins. | MEDIUM |
| **`@ngrx/signals`** | Signal stores for preview sidebar state, summary data, My Day dashboard. Same patterns as existing stores. | HIGH |
| **SignalR** | Real-time feed updates already push to sidebar (no change). Summary tab counts can refresh on `FeedUpdate` events. | HIGH |
| **MatTabsModule** | Already used in `RelatedEntityTabsComponent`. Summary tab is simply a new tab added to existing tab arrays (`CONTACT_TABS`, `COMPANY_TABS`, `DEAL_TABS`). | HIGH |

---

## Stack Additions: ZERO New Packages

### Confirmed: No New npm Packages

After thorough analysis of the v1.2 feature requirements against the installed stack:

| v1.2 Feature | Implementation Approach | New Library? |
|---|---|---|
| Entity preview sidebar | `MatDrawer` from existing `@angular/material` | NO |
| Sidebar slide animation | Built into `MatDrawer` (uses Angular animations) | NO |
| Sidebar backdrop/overlay | Built into `MatDrawer` (`hasBackdrop` property) | NO |
| Summary tab on detail pages | New `<ng-template>` in existing `RelatedEntityTabsComponent` | NO |
| Mini sparkline charts | Chart.js with minimal config (hidden axes/legend/tooltips) | NO |
| Summary KPI cards | Reuse existing `KpiCardComponent` pattern | NO |
| "My Day" dashboard layout | Reuse existing `angular-gridster2` `DashboardGridComponent` | NO |
| "My Day" widgets (tasks, calendar, deals) | New widget components following existing `WidgetWrapperComponent` pattern | NO |
| "My Day" drag/resize | Already in `angular-gridster2` config | NO |
| Today's agenda view | FullCalendar existing plugins OR custom HTML list | NO |
| Personal dashboard persistence | Backend API with existing Dashboard entity pattern | NO |

### One Possible Addition: @fullcalendar/list (Optional)

| Technology | Version | Purpose | When to Add |
|---|---|---|---|
| `@fullcalendar/list` | ^6.1.20 | List/agenda view for "My Day" today's schedule widget | Only if the team wants the native FullCalendar list view; a custom HTML list component is equally viable |

**Why optional:** FullCalendar's list plugin renders a clean agenda-style list of events for a day. However, the "My Day" widget just needs "show my activities due today" -- a simple `*ngFor` over an array of activities sorted by time is likely simpler and more customizable than pulling in another FullCalendar plugin. The existing `ActivityService.getList()` with a date filter already provides this data.

**Recommendation:** Skip `@fullcalendar/list`. Build a custom `TodayAgendaWidgetComponent` that calls the Activity API with `dueDate=today` filter. Simpler, more CRM-specific, and avoids FullCalendar's opinionated styling in a dashboard widget context.

---

## Implementation Patterns for New Features

### 1. Entity Preview Sidebar: MatDrawer

**Component:** `MatDrawer` from `@angular/material/sidenav`

The key distinction: use `MatDrawer` (scoped to a section), NOT `MatSidenav` (app-wide). The left navigation already uses a custom sidebar (not MatSidenav). Adding a `MatDrawer` on the right side of the feed/search page is architecturally clean.

```typescript
// In feed-list.component.ts or a wrapper component
import { MatDrawer, MatDrawerContainer, MatDrawerContent } from '@angular/material/sidenav';

// Template pattern:
// <mat-drawer-container>
//   <mat-drawer position="end" mode="over" [opened]="previewOpen()">
//     <app-entity-preview [entityType]="previewEntityType()" [entityId]="previewEntityId()" />
//   </mat-drawer>
//   <mat-drawer-content>
//     <!-- existing feed/search content -->
//   </mat-drawer-content>
// </mat-drawer-container>
```

**Configuration decisions:**
- `position="end"` -- right side (standard for preview panels)
- `mode="over"` -- overlay on top of content with backdrop, does NOT push main content
- `hasBackdrop="true"` -- click backdrop to close (default for "over" mode)
- Width: fixed at `420px` (standard CRM preview width, fits entity header + key fields + mini timeline)
- Animation: built into MatDrawer, uses Angular's animation system (already imported by Angular Material)

**Why MatDrawer over CDK Overlay:**
- MatDrawer provides slide animation, backdrop, keyboard (Esc) handling, and focus trapping out of the box
- CDK Overlay would require building all of that manually
- MatDrawer is designed for exactly this use case -- side content panels
- The project already depends on `@angular/material/sidenav` (it is in the Angular Material package even if not yet imported)

**Confidence:** HIGH -- MatDrawer is the standard Angular Material solution for right-side panels. The existing `@angular/material ^19.2.19` package includes it.

### 2. Summary Tabs: Existing Infrastructure

No new components needed at the framework level. The pattern is:

1. Add a `Summary` entry to each entity's tab array (e.g., `CONTACT_TABS`)
2. Create a `ContactSummaryComponent` (and similar for Company, Deal) that:
   - Fetches summary data from a new backend endpoint (`GET /api/contacts/{id}/summary`)
   - Renders KPI cards (reuse `KpiCardComponent` pattern)
   - Renders mini sparkline charts (Chart.js with minimal config)
   - Renders recent activity list (plain HTML, data from existing timeline endpoint)

**Mini Sparkline Chart Pattern (Chart.js):**

```typescript
// Sparkline config -- Chart.js with everything stripped down
const sparklineOptions: ChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: { enabled: false },
    title: { display: false },
  },
  scales: {
    x: { display: false },
    y: { display: false },
  },
  elements: {
    point: { radius: 0 },
    line: { borderWidth: 2, tension: 0.4, fill: true },
  },
};
// Canvas container: height: 40px, width: 100%
// Result: clean sparkline with just the line and fill area
```

**Confidence:** HIGH -- Chart.js sparklines are a well-documented pattern. The existing `ChartWidgetComponent` already demonstrates Chart.js integration with `ng2-charts`. The sparkline is just a simpler configuration.

### 3. "My Day" Dashboard: Reuse Gridster Infrastructure

The existing org dashboard has a complete widget system:
- `DashboardGridComponent` -- gridster grid with drag/resize
- `WidgetWrapperComponent` -- card wrapper with edit/remove actions
- `DashboardStore` -- signal store with CRUD, real-time refresh
- `DashboardApiService` -- API service for persistence
- 5 widget types: KpiCard, ChartWidget, Leaderboard, TableWidget, TargetProgress

**"My Day" reuses all of this** with these additions:

| New Component | Purpose | Based On |
|---|---|---|
| `MyDayDashboardComponent` | Page component for /my-day route | `DashboardComponent` (same pattern) |
| `MyDayStore` | Signal store for personal dashboard | `DashboardStore` (same pattern, user-scoped) |
| `TodayAgendaWidget` | Shows today's activities | New widget, uses `ActivityService` |
| `MyDealsWidget` | Shows user's active deals with mini pipeline | New widget, uses `DealService` |
| `RecentFeedWidget` | Shows recent feed items | New widget, uses `FeedService` |
| `QuickActionsWidget` | Shortcut buttons for common actions | New widget, simple button grid |
| `UpcomingTasksWidget` | Shows upcoming tasks/activities | New widget, uses `ActivityService` |

**No new layout library, no new charting library, no new state management pattern.** Just new widget components plugged into the existing gridster infrastructure.

---

## Backend: New API Endpoints (No New Libraries)

The backend needs new endpoints but NO new NuGet packages:

| Endpoint | Purpose | Implementation |
|---|---|---|
| `GET /api/contacts/{id}/summary` | Summary data for contact (KPIs, recent activity, sparkline data) | New controller action, queries existing repositories |
| `GET /api/companies/{id}/summary` | Summary data for company | Same pattern |
| `GET /api/deals/{id}/summary` | Summary data for deal | Same pattern |
| `GET /api/{entityType}/{id}/preview` | Lightweight preview data for sidebar | Returns subset of detail DTO |
| `GET /api/dashboards/personal` | Get current user's "My Day" dashboard | Extends existing `DashboardsController` with user scope |
| `GET /api/my-day/agenda` | Today's activities for current user | Wraps `ActivityRepository` with date + owner filter |
| `GET /api/my-day/deals` | Current user's active deals | Wraps `DealRepository` with owner filter |

All of these are standard EF Core queries against existing entities. No new NuGet packages.

---

## Alternatives Considered

| Feature | Recommended | Alternative | Why Not |
|---|---|---|---|
| Preview sidebar | `MatDrawer` | CDK Overlay | CDK Overlay requires manual animation, backdrop, focus trap, Esc handling. MatDrawer provides all of this. |
| Preview sidebar | `MatDrawer` | MatDialog (side-positioned) | MatDialog is semantically a dialog, not a panel. Requires CSS hacks to position on the right edge. MatDrawer is the correct semantic choice. |
| Mini sparklines | Chart.js (existing) | `sparklines.js` (new library) | Adding a separate library for sparklines when Chart.js already does it is unnecessary bloat. One less dependency to maintain. |
| Mini sparklines | Chart.js (existing) | Inline SVG sparklines | Custom SVG is more work for the same visual result. Chart.js sparklines are 10 lines of config. |
| My Day layout | `angular-gridster2` (existing) | CSS Grid manual layout | The whole point is user-configurable widget layout. CSS Grid requires custom drag/resize implementation. Gridster already does this. |
| My Day layout | `angular-gridster2` (existing) | New dashboard library (e.g., gridstack) | We already have gridster working perfectly with a full widget system. Switching would mean rewriting all existing dashboard components. |
| Today's agenda | Custom component | `@fullcalendar/list` plugin | FullCalendar list plugin brings opinionated styling and FullCalendar's heavy event model for what is essentially a filtered activity list. A simple `*ngFor` is lighter and more CRM-specific. |

---

## Integration Points with Existing Stack

### Feed Entity Links -> Preview Sidebar

The feed already has `entityType` and `entityId` on `FeedItemDto`. The current behavior navigates to the entity page. v1.2 changes this to:
1. Click entity link in feed -> open preview sidebar (not navigate away)
2. Preview sidebar shows lightweight entity data
3. "Open full" button in sidebar navigates to full detail page

**Existing code touchpoint:** `feed-list.component.ts` line 331-336 (`navigateToEntity` method) changes from `router.navigate` to `previewSidebar.open(entityType, entityId)`.

### Summary Tabs -> Existing Detail Pages

Each detail page (contacts, companies, deals) already uses `RelatedEntityTabsComponent` with tab arrays. Adding a "Summary" tab means:
1. Add `{ label: 'Summary', icon: 'dashboard', enabled: true }` as the FIRST tab in each tab array
2. Insert a new `<ng-template>` at index 0 in each detail component template
3. The summary component fetches data from the new `/summary` endpoint

**Tab index shift:** All existing `onTabChanged` index references shift by +1. This is the main integration risk.

### My Day Dashboard -> Existing Dashboard Infrastructure

The `DashboardGridComponent`, `WidgetWrapperComponent`, and `DashboardStore` pattern are designed to be reusable. "My Day" creates a parallel dashboard instance scoped to the current user with different default widgets.

**Backend integration:** The existing `Dashboard` entity already has `OwnerId` (personal vs team-wide). "My Day" is simply a personal dashboard with `IsDefault: true` auto-created on first login.

---

## Version Matrix (Existing -- No Changes)

| Package | Current Version | Purpose in v1.2 |
|---|---|---|
| `@angular/core` | ^19.2.0 | Framework |
| `@angular/material` | ^19.2.19 | MatDrawer for preview sidebar, MatTabs for summary tabs |
| `@angular/cdk` | ^19.2.19 | BreakpointObserver for responsive sidebar, a11y for focus trap |
| `angular-gridster2` | ^19.0.0 | "My Day" dashboard widget layout |
| `chart.js` | ^4.5.1 | Mini sparkline charts on summary tabs |
| `ng2-charts` | ^8.0.0 | Angular wrapper for Chart.js sparklines |
| `@fullcalendar/core` | ^6.1.20 | Calendar integration (if needed for agenda widget) |
| `@fullcalendar/daygrid` | ^6.1.20 | Already installed, used in calendar views |
| `@ngrx/signals` | ^19.2.1 | Signal stores for preview state, summary data, My Day |
| `@microsoft/signalr` | ^10.0.0 | Real-time updates for feed/preview/summary refresh |
| `rxjs` | ~7.8.0 | Reactive patterns |

---

## Installation

```bash
# No new packages to install for v1.2

# If you decide to add FullCalendar list plugin (OPTIONAL):
cd globcrm-web && npm install @fullcalendar/list@^6.1.20
```

---

## Sources

- Angular Material Sidenav API: https://material.angular.dev/components/sidenav/api
- Angular Material Sidenav Overview: https://material.angular.dev/components/sidenav
- Angular CDK Overlay docs: https://material.angular.dev/cdk/overlay/overview
- Chart.js sparkline pattern: https://www.ethangunderson.com/sparklines-in-chartjs/
- angular-gridster2 GitHub: https://github.com/tiberiuzuld/angular-gridster2
- angular-gridster2 npm: https://www.npmjs.com/package/angular-gridster2
- FullCalendar Angular docs: https://fullcalendar.io/docs/angular
- Existing codebase analysis: `package.json`, `dashboard-grid.component.ts`, `chart-widget.component.ts`, `related-entity-tabs.component.ts`, `contact-detail.component.ts`, `feed.models.ts`, `feed-list.component.ts`, `app.component.ts`, `navbar.component.html`

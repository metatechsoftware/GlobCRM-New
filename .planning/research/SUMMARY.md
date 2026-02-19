# Project Research Summary

**Project:** GlobCRM v1.2 — Connected Experience
**Domain:** CRM entity connectivity, preview panels, summary dashboards, personal workspace
**Researched:** 2026-02-20
**Confidence:** HIGH

## Executive Summary

GlobCRM v1.2 is a frontend-dominant UX milestone that transforms the product from a collection of isolated record screens into an interconnected information network. Three features accomplish this: an entity preview sidebar (peek at any entity from the feed or search without leaving context), summary tabs on all major detail pages (aggregated KPIs and recent activity as the first tab on each record), and a personal "My Day" dashboard that replaces the current home page with a user-scoped daily workspace. The defining characteristic of this milestone is that it requires **zero new library installations** — every feature maps directly to Angular Material (`MatDrawer`), `angular-gridster2`, Chart.js, and NgRx Signals already installed in the stack. The primary engineering challenge is architectural design, not technology acquisition.

The recommended implementation approach follows the pattern established by HubSpot, Salesforce, and Pipedrive — all of which ship these exact three capabilities as the core of their "modern CRM" experience. The preview sidebar must be a global overlay component hosted at the `AppComponent` level, not inside any feature module, managed by a root-provided `PreviewSidebarStore` that any component in the app can call with `open(entityType, entityId)`. Summary tabs require a single batched backend aggregation endpoint per entity type rather than multiple individual API calls. "My Day" reuses the full existing gridster widget infrastructure with new per-user scoping semantics and new widget types — no new layout library, no new charting library.

The top risks are security (preview sidebar must enforce RBAC scope checks — not just "can view" but "can view this specific record"), performance (summary tabs must use a single aggregated query endpoint, not N+1 calls per metric), and data integrity (feed links to deleted/merged entities must fail gracefully with denormalized names). All four critical pitfalls have clear, well-defined prevention strategies that must be designed in from the start, not retrofitted. Tab index shifting when inserting the Summary tab at position 0 across 6+ entity detail pages is the most widespread mechanical change and must be addressed by refactoring to label-based tab matching before any new tabs are added.

## Key Findings

### Recommended Stack

v1.2 needs no new npm packages. The entire feature set is buildable with the existing installed stack. See [STACK.md](.planning/research/STACK.md) for the full analysis.

**Core technologies (existing, repurposed for v1.2):**
- `@angular/material` MatDrawer: entity preview sidebar — purpose-built Angular component for right-side overlay panels; provides slide animation, backdrop, Esc handling, and focus trapping out of the box; no CDK Overlay custom implementation needed
- `angular-gridster2` v19: "My Day" personal dashboard layout — already powering the org dashboard with full drag/resize/persist widget infrastructure; "My Day" reuses `DashboardGridComponent` entirely with new widget types
- `Chart.js 4.5.1` + `ng2-charts 8.0.0`: mini sparkline charts on summary tabs — same library with minimal config (hidden axes, no legend, no tooltips, fill area only); no separate sparkline library needed
- `@ngrx/signals`: new root-level `PreviewSidebarStore`, `MyDayStore`, and per-component summary stores — same signal store patterns as all existing stores
- `MatTabsModule`: summary tabs slot into existing `RelatedEntityTabsComponent` tab arrays (`COMPANY_TABS`, `CONTACT_TABS`, etc.) — no new tab infrastructure needed
- `@microsoft/signalr`: existing real-time feed updates work unchanged; summary tab counts can debounce-refresh on `FeedUpdate` events

The one optional addition: `@fullcalendar/list` plugin for a native agenda view. Research recommends against it — a custom `TodayAgendaWidgetComponent` calling `ActivityService` with `dueDate=today` filter is simpler, more CRM-specific, and avoids FullCalendar's opinionated styling in a widget context.

### Expected Features

See [FEATURES.md](.planning/research/FEATURES.md) for full feature tables with CRM benchmark comparisons.

**Must have (table stakes — users expect these from a modern CRM):**
- Clickable entity names in feed that open a slide-in preview panel (not navigate away)
- Preview panel: key fields, status, owner, "Open full record" link, close on Esc/backdrop click, loading skeleton
- Scroll-position preservation when closing preview (feed stays in place)
- Summary tab as the first/default tab on Companies, Contacts, Deals, Leads, Quotes, Requests
- Summary tab contents: key properties card, association counts with tab-jump links, recent activities (3-5 items), stage/status indicator, quick action bar (Add Note, Log Activity, Send Email)
- "My Day" as new home page: today's tasks/activities, overdue items, my pipeline widget, greeting with time-of-day context
- Org dashboard relocated to its own navbar item (not deleted — it serves a different audience: team-level KPIs vs. personal daily view)
- Responsive behavior: preview sidebar full-width on mobile (<768px), side panel on desktop

**Should have (differentiators):**
- Quick actions in preview sidebar (Add Note, Log Call, Send Email) — reuses the same `QuickActionBarComponent` as summary tabs
- Association chips in preview (linked company on a contact, contacts on a deal)
- Mini deal/pipeline summary on Company and Contact summary tabs (Chart.js bar chart, aggregated deal stats endpoint)
- "My Day" configurable widget layout via gridster — genuine differentiator; HubSpot Sales Workspace is not user-configurable in layout
- User preference persistence for widget layout (user-scoped dashboard entity)
- Entity preview from global search results (secondary action alongside navigate)

**Defer to v1.3+:**
- Inline entity @mention system in feed content (requires structured mention parsing backend)
- AI-generated record summaries (requires AI infrastructure and token budget)
- Admin-customizable Summary tab layout per entity type
- Smart nudges / guided actions (rule engine is standalone work)
- Sparkline trend charts on summary tabs (needs time-series aggregation endpoints)
- Cross-entity relationship map visualization

**Entity coverage in v1.2:**

| Entity | Preview Sidebar | Summary Tab |
|--------|----------------|-------------|
| Company | Yes | Yes — rich (contacts, deals, activities, emails, quotes, requests) |
| Contact | Yes | Yes — rich (company link, deals, activities, emails) |
| Deal | Yes | Yes — rich (pipeline progress, contacts, products, activities, quotes) |
| Lead | Yes | Yes — moderate (stage progress, temperature, source, activities) |
| Quote | Yes | Yes — moderate (status badge, line item summary, linked deal/company/contact) |
| Request | Yes | Yes — moderate (status + priority badges, linked contact/company) |
| Product | Yes (basic) | No — insufficient connected data |
| User/Team Member | Yes (feed only) | No |

### Architecture Approach

v1.2 is a **frontend UX milestone with targeted backend aggregation endpoints**. The existing architecture handles 90% of requirements. The critical architectural decision is placing the entity preview sidebar as a global overlay at `AppComponent` level, managed by a root-provided store, triggerable from anywhere in the app. See [ARCHITECTURE.md](.planning/research/ARCHITECTURE.md) for full component specs, data flow diagrams, code patterns, and the A/B/C/D build order.

**Major new components:**

1. `EntityPreviewSidebarComponent` (shared) — global overlay hosted in `AppComponent` template; managed by root `PreviewSidebarStore`; `@switch(entityType)` for type-specific field templates; CSS fixed position, ~400px wide, slides from right with MatDrawer animation
2. `EntityPreviewService` (root) — single generic service calling `GET /api/entities/{type}/{id}/preview`; no per-entity services in sidebar (prevents coupling and bundle bloat)
3. `EntitySummaryTabComponent` (shared) — slots into `RelatedEntityTabsComponent` as index 0 on all entity detail pages; calls single `GET /api/{entityType}/{id}/summary` aggregation endpoint
4. `EntityFeedTabComponent` (shared) — entity-scoped feed reusing a new `FeedCardComponent` extracted from `FeedListComponent`; added as the last tab on all detail pages
5. `MyDayComponent` + `MyDayStore` (feature) — personal dashboard reusing existing gridster widget infrastructure; new widget types: `TodayAgendaWidget`, `MyDealsWidget`, `RecentFeedWidget`, `QuickActionsWidget`
6. Backend: `EntityPreviewController`, `EntitySummaryController`, `MyDayController` — three new controllers; no new NuGet packages

**New backend endpoints:**

| Endpoint | Purpose | Key Design Requirement |
|----------|---------|----------------------|
| `GET /api/entities/{type}/{id}/preview` | Generic slim DTO for preview sidebar | RBAC scope-checked (Own/Team/All); generic field-list DTO shape |
| `GET /api/{entityType}/{id}/summary` | Aggregated counts + recent activity | Single DB round-trip via `Task.WhenAll()`; scope-filtered counts |
| `GET /api/feed?entityType=X&entityId=Y` | Entity-scoped feed (extension) | Optional params added to existing endpoint; same paged response shape |
| `GET /api/my-day` | Personal daily snapshot | User-scoped only; activities, deals, stats, recent feed in one response |

**Build order (A → B → C → D):** Backend endpoints and services first (parallelizable by feature), component shells second, integration into existing pages third (highest risk — tab index shifts), polish and animations last.

### Critical Pitfalls

See [PITFALLS.md](.planning/research/PITFALLS.md) for all 13 pitfalls with full prevention strategies and detection methods.

**Critical (must be designed in from the start — not retroactively fixable):**

1. **Preview sidebar bypasses RBAC scope checks** (P1) — Feed shows entity links visible to all tenant users. A user with `Contact:View:Own` scope should not see another user's contact in the preview. Prevention: the preview endpoint must call `_permissionService.GetEffectivePermissionAsync()` and validate Own/Team/All scope before returning data. Return 403 on scope violation. Frontend pre-checks `permissionStore.hasPermission()` before opening the sidebar to avoid a wasted API call.

2. **N+1 queries in summary tab aggregation** (P2) — Calling separate list endpoints for 8 different counts means 8 database round-trips per summary load. Under 50 concurrent users, that is 400+ queries per page-load cycle. Prevention: single `GET /api/{entityType}/{id}/summary` endpoint using EF Core `Task.WhenAll()` with `AsNoTracking()` `COUNT(*)` and `SUM()` queries. Never load collections to count in memory. Summary counts must also respect the user's View scope per entity type.

3. **Feed links to deleted/merged entities cause broken UX** (P3) — FeedItems use logical references (`EntityType` + `EntityId`) with no FK constraint by design. Deleting a Deal leaves a dead link in the feed. Prevention: (a) add `EntityName` column to `FeedItem` at creation time (denormalization migration) so feed cards still show a meaningful name after deletion; (b) graceful 404 handling in preview sidebar ("This Deal has been deleted" message, not an error); (c) merge-redirect resolution generalized from the existing `company-detail.component.ts` pattern.

4. **Route migration breaks existing org dashboard bookmarks** (P4) — Moving `/dashboard` to make way for "My Day" breaks existing bookmarks and the catch-all redirect in `app.routes.ts`. Prevention: define the complete new route map before writing any code — `/` and `/dashboard` both redirect to `/my-day`; org dashboard moves to `/analytics` with backward-compat redirect from old path. The route restructuring must be the very first task in the personal dashboard phase.

**Moderate (significant bugs but recoverable):**

5. **Summary tab stale data after mutations on sibling tabs** (P5) — Existing `loaded` boolean guards prevent re-fetch. Creating a Deal on the Deals tab does not update the Summary tab's deal count. Prevention: dirty-flag signal pattern — each tab's mutation handler sets `summaryDirty = signal(true)`; Summary re-fetches on tab-switch when dirty. The batched endpoint is fast enough for this pattern.

6. **Preview sidebar z-index and scroll conflicts** (P6) — Conflicts with existing Material dialogs, menus, and datepickers. Prevention: CDK Overlay with explicit z-index stacking layer constants; `BlockScrollStrategy` to prevent body scroll when sidebar is open; close sidebar on `NavigationStart` router events to prevent stale previews across routes.

7. **Tab index shift when inserting Summary at position 0** (P8) — All existing `onTabChanged(index)` handlers use hardcoded numeric indices (`if (index === 3)`). Inserting Summary at index 0 silently breaks all lazy loading across every detail page. Prevention: **refactor to label-based tab matching before adding any new tabs** — replace `if (index === 3)` with `if (tabLabel === 'Contacts')` in all 6+ detail components. This is the first task of the Summary Tabs phase.

8. **"My Day" widget loading waterfall** (P7) — 6-8 concurrent HTTP requests on every app load (the new home page). Prevention: extend the existing batched `POST /api/dashboards/{id}/widget-data` endpoint to support new "My Day" widget types; use two-tier loading (fast KPIs first, slow entity lists second with skeleton loaders).

## Implications for Roadmap

Based on the combined research, the feature dependency graph and pitfall resolution order dictate a 4-phase structure within the v1.2 milestone. Phase ordering follows architectural dependencies (global components before per-page integrations) and pitfall mitigation requirements (refactoring before inserting new tabs; route planning before component building).

### Phase 1: Foundation — Shared Infrastructure + Entity Preview Sidebar

**Rationale:** All three v1.2 features depend on shared infrastructure: the `EntityTypeRegistry` utility, the tab index refactor, the generic `EntityPreviewService`, and the preview sidebar overlay itself. Building these first means Phases 2 and 3 are integration work against a stable foundation, not architecture decisions under time pressure. The preview sidebar is also the most novel UX paradigm — shipping it first gives the team time to iterate before users see it on summary tabs and search.

**Delivers:**
- Shared `EntityTypeRegistry` utility (maps entity type strings to routes, icons, labels) — eliminates 3+ divergent mapping implementations across feed, notifications, and activities
- Tab handler refactor across all 6 entity detail components: index-based to label-based `onTabChanged` — unblocks safe tab insertion in Phase 2 without silent regressions
- `EntityName` denormalization: migration adding `entity_name` column to `feed_items` — prevents dead-link UX from Phase 2 onward
- `EntityPreviewController` backend endpoint (`GET /api/entities/{type}/{id}/preview`) with RBAC scope checking built in
- `EntityPreviewService` (Angular, root) + `PreviewSidebarStore` (root signal store)
- `EntityPreviewSidebarComponent` hosted in `AppComponent` + feed entity link integration (replace `navigateToEntity()` with `previewSidebarStore.open()`)
- Graceful 404/deleted-entity handling in preview sidebar

**Addresses features from FEATURES.md:** All preview sidebar table stakes (clickable entity names, slide-in panel, key properties, close behavior, loading skeleton, deleted entity graceful handling, scroll-position preservation)

**Avoids pitfalls:** P1 (RBAC bypass — scope-checked endpoint), P3 (deleted entities — denormalization + graceful 404), P9 (duplicate service instances — generic service), P10 (entity type mapping inconsistency — registry utility)

**Research flag:** Standard patterns — skip research-phase. MatDrawer implementation is official Angular Material. RBAC pattern matches existing `_permissionService` usage in other controllers.

### Phase 2: Summary Tabs on All Detail Pages

**Rationale:** Summary tabs add high value to the most-visited pages in the app with low new-paradigm risk — they build on the tab infrastructure stabilized in Phase 1 (label-based handlers, Summary safely insertable at index 0). The aggregation endpoint pattern established here (single batched query, RBAC-scope-filtered counts) becomes the template for the My Day endpoint in Phase 3. The `QuickActionBarComponent` built here is reused in the Phase 4 preview sidebar polish.

**Delivers:**
- `EntitySummaryController` with per-entity `GET /api/{entityType}/{id}/summary` endpoints (Companies, Contacts, Deals, Leads, Quotes, Requests) using `Task.WhenAll()` batching — no N+1 queries
- `EntitySummaryService` (Angular root) + `EntitySummaryTabComponent` (shared): KPI cards, association count chips with tab-jump links, recent activity mini-timeline, stage/status indicator
- `QuickActionBarComponent` (shared) — Add Note, Log Activity, Send Email; reused across summary tabs and (in Phase 4) preview sidebar
- `FeedCardComponent` extracted from `FeedListComponent` (reduces duplication, enables entity feed tab)
- `EntityFeedTabComponent` (shared) — entity-scoped feed using `FeedCardComponent`
- `FeedController` extended with optional `?entityType=X&entityId=Y` filter params (additive change, backward compatible)
- Summary tab added at index 0 on all 6 entity detail pages; Feed tab added as last tab
- Dirty-flag invalidation: summary re-fetches when sibling tabs perform mutations

**Addresses features from FEATURES.md:** All summary tab table stakes; entity-scoped feed tab; association count chips (also feeds preview sidebar in Phase 4)

**Avoids pitfalls:** P2 (N+1 queries — batched endpoint design), P5 (stale summary data — dirty-flag invalidation), P8 (tab index shift — resolved in Phase 1 refactor)

**Research flag:** Standard patterns — skip research-phase. EF Core aggregate queries are well-documented. Chart.js sparkline config is established. Tab integration is mechanical after Phase 1 refactor.

### Phase 3: Personal "My Day" Dashboard + Org Dashboard Relocation

**Rationale:** "My Day" is the highest-complexity feature — new page, new widget types, route restructuring, navbar changes, user preference persistence, and coordination with the existing org dashboard. It ships after Phases 1-2 because it reuses the aggregation endpoint pattern (Phase 2) and the `QuickActionBarComponent` (Phase 2). The route restructuring must be the very first task within this phase, executed atomically, to avoid breaking existing users mid-phase.

**Delivers:**
- Route restructuring (first task, atomic): `/` → `/my-day`, `/dashboard` → `/my-day` (redirect), org dashboard moves to `/analytics` — with backward-compat redirects for existing bookmarks
- Navbar update: "My Day" entry (home icon, default landing) + renamed "Analytics" entry (grid_view icon)
- Auto-creation of default personal dashboard on first login (lazy creation: `GET /api/dashboards?scope=personal` creates default if none exists)
- `MyDayController` (`GET /api/my-day`) — user-scoped activities, deals, stats, recent feed in one batched response
- `MyDayComponent` + `MyDayStore` (per-page signal store, follows existing `DashboardStore` pattern)
- New widget types: `TodayAgendaWidget` (custom component, not FullCalendar), `MyDealsWidget`, `RecentFeedWidget`, `QuickActionsWidget`
- Widget layout persistence with user scope (`OwnerId = currentUserId`, separate `isDefault` semantics from org dashboard)
- `DashboardScope` enum added to schema (Personal / Organization) with migration

**Addresses features from FEATURES.md:** All "My Day" table stakes; org dashboard relocation; user-configurable layout (genuine differentiator); greeting/date context reuse from existing `DashboardComponent`

**Avoids pitfalls:** P4 (route migration — backward-compat redirects, route plan first), P7 (widget loading waterfall — extend batched endpoint), P11 (gridster layout config — same 12-column config, widget-level sizing differences only)

**Research flag:** Needs schema design session during planning. The `DashboardScope` enum addition and the "create on first access" strategy for default personal dashboards need explicit decisions before any code is written. Also confirm the migration strategy for existing users (all existing users get a default "My Day" created).

### Phase 4: Preview Sidebar Polish + Quick Actions Integration

**Rationale:** Cross-feature integration and polish ship last because they depend on all three features being functional and user-tested. Quick actions in the preview sidebar reuse the `QuickActionBarComponent` built in Phase 2 — the integration (opening dialogs from within the sidebar context, ensuring z-index is correct) needs all the pieces in place first. Responsive behavior, animations, and global search preview are refinement, not core functionality.

**Delivers:**
- `QuickActionBarComponent` wired into preview sidebar (reuse from Phase 2)
- Preview sidebar responsive behavior: full-screen sheet on mobile (<768px), side panel on desktop
- Global search preview integration: secondary "preview" action on search hits alongside existing "navigate" action
- Animation polish: slide-in/out timing calibrated to existing CSS motion tokens (`--duration-normal`, `--ease-default`)
- Preview sidebar closes on `NavigationStart` router events (prevents stale entity data across routes)
- User preview for feed author names (lightweight `GET /api/users/{id}/preview` endpoint)
- Database indexes verified/added: `ix_feed_items_entity`, `ix_activities_user_due`, `ix_deal_contacts_contact`
- Association chips in preview sidebar (linked company on a contact, contacts on a deal)

**Addresses features from FEATURES.md:** Preview sidebar differentiators (quick actions, user preview, associations, global search integration); responsive/mobile behavior; animation polish

**Avoids pitfalls:** P6 (z-index conflicts — explicit stacking layers, `BlockScrollStrategy`), P12 (accidental sidebar open on mobile scroll — fallback to `router.navigate` on mobile viewports), P13 (SignalR counter flicker — event-scoped refresh with `debounceTime(3000)`)

**Research flag:** Standard patterns — skip research-phase. CDK overlay z-index stacking is well-documented. Mobile breakpoint handling reuses existing `BreakpointObserver` pattern from `app.component.ts` and `navbar.component.ts`.

### Phase Ordering Rationale

- **Foundation infrastructure before features:** `EntityTypeRegistry` and the tab index refactor are cross-cutting changes that will cause merge conflicts and silent bugs if done mid-development alongside feature work. They block safe tab insertion and safe entity link changes everywhere.
- **Summary tabs before "My Day":** The `GET /api/{entityType}/{id}/summary` aggregation endpoint pattern and `QuickActionBarComponent` built in Phase 2 are directly reused in Phase 3. Building them first avoids duplication and ensures the pattern is proven before scaling it.
- **Route restructuring as the first commit within Phase 3:** Route changes have the widest blast radius (bookmarks, catch-all redirects, navbar). Doing this before building widget components means the new routing is validated before new UI is added on top of it.
- **Polish last:** Responsive behavior, animations, and global search integration have zero architectural dependencies — they ship last to avoid blocking core feature delivery while remaining valuable additions.

### Research Flags

Phases needing deeper research or design decisions during planning:
- **Phase 3 (Personal Dashboard):** `DashboardScope` enum migration design, "create on first access" strategy for existing users, and widget persistence scope semantics. Need a schema design session before planning begins.

Phases with well-established patterns (skip research-phase):
- **Phase 1 (Foundation):** MatDrawer is official Angular Material; RBAC pattern matches existing codebase implementation; tab refactor is mechanical.
- **Phase 2 (Summary Tabs):** EF Core aggregate queries are standard; Chart.js sparklines are documented; tab integration is mechanical after Phase 1 refactor.
- **Phase 4 (Polish):** CDK overlay, `BreakpointObserver`, and router events are all standard Angular patterns with existing usage in the codebase.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All technologies confirmed installed in `package.json`. No new packages needed — verified by direct codebase analysis. Gridster, Chart.js, MatDrawer, NgRx Signals all proven working in existing production features. |
| Features | MEDIUM-HIGH | CRM benchmark patterns validated against HubSpot, Salesforce, Pipedrive, Dynamics 365 documentation. Existing codebase confirmed all required data models exist. Some source confidence is MEDIUM (third-party HubSpot blog posts, not official APIs). Feature scope is well-defined with clear must-have/should-have/defer distinctions. |
| Architecture | HIGH | Based on exhaustive direct codebase analysis of existing patterns (`feed-list.component.ts`, `company-detail.component.ts`, `dashboard.store.ts`, `related-entity-tabs.component.ts`, `app.component.ts`, etc.). Pattern recommendations are extensions of established existing patterns, not new paradigms. |
| Pitfalls | HIGH | All critical pitfalls identified through direct code inspection with specific file and line references. RBAC scope gap, N+1 query risk, FeedItem no-FK design, hardcoded tab indices, and route catch-all all confirmed by reading actual source files. Confidence is HIGH because the pitfalls are code-evidence-based, not speculative. |

**Overall confidence:** HIGH

### Gaps to Address

- **`DashboardScope` schema design:** The existing `Dashboard` entity has `OwnerId` (personal vs. null for team) but no `DashboardScope` enum and no separate `isDefault` per scope. Decide whether to add a `DashboardScope` enum column (with migration) or handle in application logic. Resolve during Phase 3 planning before any schema work begins.
- **`entity_name` migration on `feed_items`:** Adding a new column to a potentially large table. Verify the migration strategy — nullable column first, then backfill via background job, then enforce not-null — against existing seed data patterns. Address in Phase 1 planning.
- **Summary tab coverage for Leads, Quotes, Requests:** These were built in v1.1. Confirm their tab constant patterns (`LEAD_TABS`, `QUOTE_TABS`, `REQUEST_TABS`) match the `COMPANY_TABS`/`CONTACT_TABS` pattern before assuming the Phase 1 tab refactor applies uniformly.
- **"My Day" default widget set:** Research provides the full widget type catalog. The specific default layout (which widgets, what positions, what sizes) is a UX design decision. Requires a design decision before Phase 3 planning.
- **`@fullcalendar/list` final decision:** If the Phase 3 widget design review prefers native FullCalendar list rendering over a custom component, this is the only potential new dependency. Make the call explicitly during Phase 3 planning (recommendation: skip, build custom `TodayAgendaWidget`).

## Sources

### Primary (HIGH confidence)
- Angular Material Sidenav/Drawer API — https://material.angular.dev/components/sidenav/api
- Angular CDK Overlay documentation — https://material.angular.dev/cdk/overlay/overview
- FullCalendar Angular documentation — https://fullcalendar.io/docs/angular
- EF Core Efficient Querying — https://learn.microsoft.com/en-us/ef/core/performance/efficient-querying
- Existing codebase: `package.json`, `feed-list.component.ts`, `FeedController.cs`, `company-detail.component.ts`, `related-entity-tabs.component.ts`, `dashboard.component.ts`, `dashboard.store.ts`, `app.component.ts`, `app.routes.ts`, `FeedItem.cs`, `permission.store.ts`, `signalr.service.ts`, `sidebar-state.service.ts`, `global-search.component.ts`, `entity-timeline.component.ts`

### Secondary (MEDIUM confidence)
- HubSpot: Preview a record — https://knowledge.hubspot.com/records/preview-a-record
- HubSpot: View and customize record overviews — https://knowledge.hubspot.com/crm-setup/view-and-customize-record-overviews
- HubSpot: Sales Workspace activities — https://knowledge.hubspot.com/prospecting/review-sales-activity-in-the-sales-workspace
- HubSpot: Customize preview sidebar in workspace — https://knowledge.hubspot.com/customize-the-record-preview-sidebar-in-the-customer-success-workspace
- HubSpot Spring 2025 Spotlight: Workspaces — https://www.hubspot.com/company-news/spring-2025-spotlight-workspaces
- Salesforce: Custom Lightning Home Page — Trailhead module
- Salesforce: Compact Layouts — Trailhead module
- Salesforce: Today's Tasks in Lightning — https://help.salesforce.com/s/articleView?id=000382898
- Pipedrive: Detail view sidebar — https://support.pipedrive.com/en/article/detail-view-sidebar
- Dynamics 365: Quick view forms — https://learn.microsoft.com/en-us/dynamics365/customerengagement
- Chart.js sparkline pattern — https://www.ethangunderson.com/sparklines-in-chartjs/
- angular-gridster2 — https://github.com/tiberiuzuld/angular-gridster2
- Angular CDK Overlay tutorial — https://briantree.se/angular-cdk-overlay-tutorial-learn-the-basics/
- N+1 Problem in EF Core — https://www.jocheojeda.com/2025/06/26/understanding-the-n1-database-problem-using-entity-framework-core/

### Tertiary (LOW confidence)
- Everything About CRM Record Overview Tab in HubSpot — third-party blog post (https://www.mergeyourdata.com/blog/everything-about-the-crm-record-overview-tab-in-hubspot)
- Angular 21 CDK Overlay Issues — third-party Medium article (behavior may differ in Angular 19)

---
*Research completed: 2026-02-20*
*Ready for roadmap: yes*

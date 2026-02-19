# Domain Pitfalls

**Domain:** v1.2 Connected Experience -- Entity preview sidebars, summary tabs, personal "My Day" dashboard, feed deep linking
**Researched:** 2026-02-20
**Scope:** Adding entity-linked feed with preview sidebars, summary/overview tabs on all major detail pages, personal configurable "My Day" dashboard replacing home page, and org dashboard relocation -- all integrated with existing triple-layer multi-tenancy and granular RBAC permission system.

---

## Critical Pitfalls

Mistakes that cause security breaches, data leaks, severe performance degradation, or architectural rewrites.

---

### Pitfall 1: Preview Sidebar Bypasses RBAC Permission Checks

**What goes wrong:** The entity preview sidebar loads a summary of any entity type (Company, Contact, Deal, Lead, Quote, Request) when a user clicks a feed entity link or an entity reference elsewhere. The sidebar calls a generic "preview" endpoint or reuses existing detail endpoints without checking whether the current user has View permission for that entity type with appropriate scope (Own/Team/All). A user with `Contact:View:Own` scope sees a feed item about a Contact they do not own, clicks the link, and the sidebar displays the full Contact preview -- leaking data they should not access.

**Why it happens:** The feed system stores `EntityType` + `EntityId` on FeedItem entities. Feed items are visible to all users in the tenant (no per-item RBAC). The existing `navigateToEntity()` in `feed-list.component.ts` does a simple `router.navigate(['/', entityPath, entityId])`, and the target route has `permissionGuard('Contact', 'View')` which only checks if the user has ANY View scope (not None). But scope-level filtering (Own vs Team vs All) happens inside the controller's query, not at the route level. A preview sidebar that loads entity data via a direct GET-by-ID call would bypass scope filtering because GET-by-ID endpoints typically return the entity if it exists in the tenant, without checking if the requester "owns" it.

**Consequences:**
- Data leakage within tenant: users see entities outside their permission scope
- Field-level permissions bypassed: sidebar shows fields that should be Hidden for the user's role
- Violates the RBAC contract established in v1.0

**Prevention:**
1. **Backend scope check on every preview endpoint:** Create a dedicated `GET /api/{entity}/{id}/preview` endpoint (or reuse existing GET-by-ID) that explicitly calls `_permissionService.GetEffectivePermissionAsync(userId, entityType, "View")` and then validates scope: if scope is "Own", verify `CreatedById == userId` or `AssignedToId == userId`; if scope is "Team", verify the owner is in the user's team. Return 403 if scope check fails, not 404 (do not hide the existence of the entity -- the feed already revealed it -- but do deny the data).
2. **Frontend pre-check before opening sidebar:** Before calling the preview API, check `permissionStore.hasPermission(entityType, 'View')`. If false, show a "You don't have access to this [Entity]" message inline instead of opening the sidebar. This avoids a wasted API call and a jarring 403 error.
3. **Field-level filtering in preview DTO:** The preview endpoint must consult field permissions and omit or redact fields where `accessLevel === 'hidden'`. Use the same `FieldPermission` system that detail pages use. Do not create a separate field-visibility path for previews.
4. **Integration test:** For each entity type, test that a user with `View:Own` scope cannot preview an entity owned by another user.

**Detection:**
- Audit log showing 403 responses on preview endpoints (indicates users are attempting to preview entities outside their scope -- expected behavior, but monitor for patterns)
- Automated test suite covering all entity type + scope combinations

**Phase to address:** Entity Preview Sidebar phase -- must be designed into the preview endpoint from the start.
**Confidence:** HIGH -- direct examination of existing code shows GET-by-ID endpoints do not enforce scope-level checks, and feed items are visible to all tenant users.

---

### Pitfall 2: N+1 Queries in Summary Tab Aggregation

**What goes wrong:** The Summary tab on each detail page (Company, Contact, Deal, etc.) aggregates data from multiple related entities: counts of linked Deals, Activities, Quotes, Requests; recent activity timeline; revenue totals; last interaction date. A naive implementation makes one query per aggregation: `SELECT COUNT(*) FROM deals WHERE company_id = @id`, then `SELECT COUNT(*) FROM activities WHERE linked_entity_id = @id`, then `SELECT SUM(value) FROM deals WHERE company_id = @id AND stage = 'Won'`, and so on. For a Company Summary with 8 metrics, that is 8+ round-trips to the database.

**Why it happens:** Developers naturally build summary sections by calling existing service methods: `dealService.getCountByCompany()`, `activityService.getCountByEntity()`, etc. Each method does its own query. The existing detail page pattern (visible in `company-detail.component.ts`) already lazy-loads tabs independently, so each tab triggers its own API call. A Summary tab that calls 5-8 separate endpoints multiplies this pattern.

**Consequences:**
- 8-12 database round-trips per Summary tab load (vs. 1-2 with a batched approach)
- Latency spike: sequential round-trips at ~5ms each = 40-60ms just for the queries, plus HTTP overhead if multiple API calls from the frontend
- Under load, connection pool contention as each summary load holds multiple connections
- The problem is multiplicative: if 50 users load Company details simultaneously, that is 400-600 concurrent queries just for summary tabs

**Prevention:**
1. **Single batched summary endpoint:** Create `GET /api/{entity}/{id}/summary` that runs all aggregation queries in a single database round-trip using a multi-result query or parallel `Task.WhenAll()`. Example: fire all COUNT/SUM queries concurrently with `Task.WhenAll(dealCountTask, activityCountTask, revenueTask, ...)`, each using its own `AsNoTracking()` query. EF Core will multiplex these on the same connection if using the same DbContext instance.
2. **Projection queries, not full entity loads:** Use `.Select()` projections to compute aggregates directly in SQL: `_db.Deals.Where(d => d.CompanyId == id).CountAsync()`, `_db.Deals.Where(d => d.CompanyId == id && d.Stage == "Won").SumAsync(d => d.Value)`. Never load full entity collections and count in memory.
3. **Frontend: single API call per summary:** The Angular component should call one `GET /api/companies/{id}/summary` endpoint, not 8 separate endpoints. Display a single loading spinner for the whole Summary tab, not individual loading states per metric.
4. **Cache consideration:** Summary data changes infrequently relative to reads. Consider short TTL caching (30-60 seconds) at the API level using `IMemoryCache` with cache keys including tenant ID + entity ID. Invalidate on write operations via DomainEventInterceptor.
5. **RBAC scope filtering in aggregates:** The summary counts must respect the user's View scope for each related entity type. A user with `Deal:View:Own` should see "3 Deals" (their own), not "15 Deals" (all company deals). This is the most commonly missed aspect -- aggregate queries bypass scope if not explicitly filtered.

**Detection:**
- Monitor query count per request using EF Core logging (`EnableSensitiveDataLogging` in dev)
- If a single GET request generates >5 queries, flag for batching review
- Application Insights / Serilog structured logging showing request duration >100ms for summary endpoints

**Phase to address:** Summary Tabs phase -- the endpoint design must be batched from the start. Retrofitting batching onto individual endpoints is significantly harder.
**Confidence:** HIGH -- existing `company-detail.component.ts` pattern of separate lazy-loaded API calls per tab confirms this is the natural path developers will take.

---

### Pitfall 3: Feed Entity Links to Deleted Entities Cause Cascading Errors

**What goes wrong:** A FeedItem has `EntityType = "Deal"` and `EntityId = "abc-123"`. The deal is later deleted. When a user clicks the entity link in the feed, three things can go wrong: (a) the preview sidebar calls `GET /api/deals/abc-123` and gets a 404, showing an ugly error; (b) the `navigateToEntity()` routes to `/deals/abc-123` which loads a blank/error detail page; (c) system events referencing the deleted entity accumulate as orphaned records, cluttering the feed. Worse: if the entity was *merged* (the existing `isMerged` + `mergedIntoId` redirect pattern in `company-detail.component.ts`), the feed link should redirect to the merged record but does not.

**Why it happens:** The FeedItem entity uses a logical reference (`EntityType` + `EntityId`) with no FK constraint to target entities (same pattern as Notes and Attachments -- documented in the domain entities). This is by design to avoid cascade-delete complexity, but it means FeedItems naturally accumulate dangling references as entities are deleted or merged.

**Consequences:**
- Broken user experience: clicking feed links shows errors or blank pages
- User confusion: "I can see this deal was created in the feed, but clicking it goes nowhere"
- Over time, a significant percentage of feed entity links become dead links
- Merged entity links never redirect (the merge redirect logic is in `company-detail.component.ts` only, not in a preview sidebar)

**Prevention:**
1. **Graceful 404 handling in preview sidebar:** When the preview API returns 404, display a styled "This [Entity] has been deleted" message with a dismiss button, not a raw error. This is the most important fix -- it handles the common case cleanly.
2. **Merged entity resolution:** When the preview API returns a 301/redirect response (or a `{ isMerged: true, mergedIntoId: "..." }` payload), the sidebar should automatically load the merged target entity instead. Generalize the existing merge-redirect pattern from `company-detail.component.ts` to a shared utility.
3. **Soft-delete awareness in feed rendering:** When rendering feed items, optionally mark items whose linked entity no longer exists. This can be done lazily (on first access) or via a background job that periodically scans for orphaned references and sets a `isEntityDeleted` flag on the FeedItem.
4. **Do NOT cascade-delete feed items when entities are deleted.** Feed items have historical value ("Deal X was created on Jan 5"). Deleting the feed item loses the audit trail. Instead, render the feed item with the entity link disabled and a "[deleted]" badge.
5. **Entity name denormalization:** Store `entityName` (e.g., "Acme Corp Deal #42") on the FeedItem at creation time. When the entity is deleted, the feed item still shows a meaningful name instead of just "View Deal" with a dead link.

**Detection:**
- Monitor 404 rates on preview/detail endpoints when accessed from feed context (add a `?source=feed` query param for tracking)
- Periodic background scan: count FeedItems where EntityId references a non-existent entity
- User feedback: "link doesn't work" reports

**Phase to address:** Feed Deep Linking phase -- must be handled when implementing the preview sidebar click handler. The entity name denormalization should be added as a migration in the same phase.
**Confidence:** HIGH -- direct inspection of FeedItem entity shows no FK constraint and no `entityName` field. Current `navigateToEntity()` has zero error handling.

---

### Pitfall 4: Personal Dashboard Migration Breaks Existing Org Dashboard Users

**What goes wrong:** The v1.2 plan relocates the current org dashboard from the home page (`/dashboard` -> redirected from `/`) to its own menu item, and replaces the home page with a personal "My Day" dashboard. This route change breaks: (a) bookmarks and shared links to `/dashboard`; (b) the `{ path: '', redirectTo: 'dashboard' }` and `{ path: '**', redirectTo: 'dashboard' }` routes in `app.routes.ts`; (c) any external integrations that link to the dashboard URL. Additionally, if the personal dashboard uses the same `DashboardStore` and `angular-gridster2` grid infrastructure as the org dashboard, state confusion can occur where editing widgets on the personal dashboard accidentally saves to the org dashboard or vice versa.

**Why it happens:** Route restructuring in a live application always has ripple effects. The current `app.routes.ts` shows `/dashboard` as the default route and the catch-all redirect. The `DashboardStore` is component-provided (not root), but the `DashboardApiService` and the backend endpoints are shared. If both personal and org dashboards use `POST /api/dashboards/{id}/widget-data`, the dashboard ID is the only discriminator -- but the frontend must know which dashboard to load.

**Consequences:**
- All existing users' bookmarks and shared links break (or redirect to the wrong page)
- Real-time SignalR refresh (in `DashboardStore.startRealTimeRefresh()`) could refresh the wrong dashboard if both are open
- The "default dashboard" concept (`isDefault: true`) becomes ambiguous: default personal dashboard vs. default org dashboard
- Org dashboard widgets created pre-migration must not appear on personal dashboards and vice versa

**Prevention:**
1. **Route structure plan:** Define the new routes before writing any code:
   - `/` -> redirect to `/my-day` (new personal dashboard)
   - `/my-day` -> Personal "My Day" dashboard component
   - `/analytics` or `/org-dashboard` -> Org dashboard (relocated, NOT deleted)
   - `/dashboard` -> redirect to `/my-day` for backward compatibility
2. **Separate ownership semantics in the backend:** The existing `DashboardDto` already has `OwnerId` (personal) vs. null `OwnerId` (team-wide). Use this cleanly: personal "My Day" dashboards always have `OwnerId = currentUserId`. Org dashboards have `OwnerId = null`. The API endpoint `GET /api/dashboards` already filters by userId. Add a query param like `?scope=personal` or `?scope=org` to make intent explicit.
3. **Separate "default" flags:** Add a `DashboardScope` enum (`Personal`, `Organization`) so `isDefault` is scoped: "default personal dashboard" vs. "default org dashboard." Without this, setting a personal dashboard as default could unset the org dashboard's default.
4. **Widget type expansion:** Personal "My Day" dashboard will have new widget types (upcoming activities, recent entities, personal feed, etc.) that do not make sense on org dashboards. The widget type enum needs expansion, and the widget renderer must handle unknown types gracefully (show "Widget type not supported" instead of crashing).
5. **Migration path:** Existing users should see a populated "My Day" dashboard on first load, not a blank page. Either auto-create a default personal dashboard with sensible defaults during the migration, or create on first access via `GET /api/dashboards?scope=personal` returning a 200 with a newly created default if none exists.

**Detection:**
- 404 monitoring on old `/dashboard` route after migration
- User reports of "blank dashboard" after update
- Analytics showing if personal vs. org dashboards are being confused

**Phase to address:** Personal Dashboard phase -- route restructuring must be planned first, before building any new components.
**Confidence:** HIGH -- direct inspection of `app.routes.ts` shows the current route structure and catch-all redirect.

---

## Moderate Pitfalls

Mistakes that cause significant bugs, poor performance, or user confusion, but are recoverable without rewrite.

---

### Pitfall 5: Summary Tab Stale Data After Entity Mutations on Other Tabs

**What goes wrong:** User opens Company detail page. Summary tab shows "5 Deals, $120K pipeline value." User switches to Deals tab, creates a new Deal, then switches back to Summary tab. Summary still shows "5 Deals, $120K" because the summary data was fetched on first load and never refreshed. The existing lazy-load pattern (visible in `company-detail.component.ts`) uses `if (this.activitiesLoaded() || this.activitiesLoading()) return;` guards that prevent re-fetching once data is loaded.

**Why it happens:** The existing pattern of `loaded` boolean signals prevents redundant loads, which is correct for tabs that show a static list. But the Summary tab aggregates counts and totals that change when users mutate data on other tabs. The `loaded` guard means switching back to Summary never re-fetches.

**Consequences:**
- Summary metrics are stale until full page reload
- Users lose trust in summary accuracy ("I just created a deal, why doesn't the count update?")
- If the Summary tab is the first (index 0) tab, users see stale data on every return to the "home" tab

**Prevention:**
1. **Invalidation signal pattern:** When any tab performs a mutation (create, update, delete), emit an event or set a signal that marks the summary as "dirty." On tab switch back to Summary, check the dirty flag and re-fetch if needed. Example: a shared `summaryDirty = signal(false)` that each tab's mutation handler sets to `true`.
2. **Lightweight re-fetch:** The summary endpoint should be fast (<50ms) thanks to the batched query pattern from Pitfall 2. Re-fetching on every tab switch to Summary is acceptable if the endpoint is performant. Remove the `loaded` guard for the Summary tab specifically.
3. **Optimistic count updates:** When a Deal is created on the Deals tab, optimistically increment `summary.dealCount` without a server round-trip. This provides instant feedback while a background re-fetch gets the authoritative numbers.
4. **SignalR integration:** The existing `DashboardStore.startRealTimeRefresh()` pattern (listening to SignalR events and debouncing refreshes) can be applied to summary tabs. When any CRM mutation occurs for the current entity, debounce-refresh the summary.

**Detection:**
- Manual QA: create entity on related tab, switch to Summary, verify count updated
- E2E test: create a Deal linked to a Company, verify Summary tab count increments

**Phase to address:** Summary Tabs phase -- build the invalidation mechanism into the summary tab component from the start.
**Confidence:** HIGH -- direct inspection of existing lazy-load guards in `company-detail.component.ts`.

---

### Pitfall 6: Preview Sidebar Z-Index and Scroll Context Conflicts

**What goes wrong:** The entity preview sidebar opens as an overlay panel (likely using Angular CDK Overlay or a custom side-sheet). On pages with existing overlays (Material dialogs, mat-menus, mat-datepickers, autocomplete dropdowns), the sidebar's z-index conflicts cause: (a) the sidebar appears behind an open dialog; (b) opening a dialog from within the sidebar renders the dialog behind the sidebar; (c) scrolling the sidebar content scrolls the underlying page instead. The existing notification panel (from v1.0) may already occupy a similar overlay slot.

**Why it happens:** Angular CDK manages overlay z-index via a stacking order tied to creation order. The sidebar is a persistent panel (not ephemeral like a dialog), so it breaks the assumption that overlays are short-lived. The existing layout uses `margin-left: 240px` for the nav sidebar (visible in `app.component.ts`), but an entity preview sidebar on the right side would need different positioning strategy.

**Consequences:**
- Sidebar hidden behind dialogs or vice versa
- Body scroll leaks when sidebar is open
- On mobile, the sidebar may completely obscure the page with no way to dismiss
- Notification panel and preview sidebar may fight for the same screen real estate

**Prevention:**
1. **Use CDK Overlay with explicit z-index stacking:** Do not use a fixed-position CSS sidebar. Use Angular CDK `Overlay` with `positionStrategy: GlobalPositionStrategy` anchored to the right edge. Set the overlay's `panelClass` to control z-index in a known layer (e.g., `z-index: 1000` for sidebar, `z-index: 1100` for dialogs opened from sidebar).
2. **Block scroll on body when sidebar is open:** Use CDK `BlockScrollStrategy` on the overlay, or scope the sidebar's scroll container to prevent event propagation to the body.
3. **Singleton service for sidebar state:** Create a `PreviewSidebarService` (root-provided) with a signal for the currently previewed entity. This ensures only one preview is open at a time, and any page component can open/close it. Mimic the existing `SidebarStateService` pattern.
4. **Close sidebar on route navigation:** Listen to Router events and close the preview sidebar on `NavigationStart`. This prevents the sidebar from showing stale entity data after navigating to a different page.
5. **Responsive behavior:** On mobile (< 768px, matching the existing `isMobile` breakpoint in `app.component.ts`), the preview sidebar should be a full-screen sheet (bottom sheet or full overlay), not a side panel. On tablet (768-1024px), it should push content or overlay at 50% width.
6. **Dismiss on click outside:** Implement backdrop click handling so clicking outside the sidebar dismisses it.

**Detection:**
- Visual QA: open sidebar, then open a dialog from the sidebar, verify dialog is on top
- Test on mobile viewport: sidebar should be fullscreen
- Test scroll: sidebar content scrolls independently from page

**Phase to address:** Entity Preview Sidebar phase -- the overlay architecture must be decided before building the sidebar component.
**Confidence:** MEDIUM -- based on general Angular CDK overlay behavior and the specific layout in `app.component.ts`. Angular 21 CDK overlay changes (Popover API) may introduce additional z-index quirks.

---

### Pitfall 7: "My Day" Widget Data Loading Creates Performance Waterfall

**What goes wrong:** The personal "My Day" dashboard loads on every app launch (it is the new home page). It contains multiple widget types: upcoming activities, recent deals, personal feed, target progress, overdue tasks. Each widget makes its own API call. If there are 6-8 widgets, the page fires 6-8 parallel HTTP requests on initial load. This creates a performance waterfall: the browser's HTTP/2 connection limit may serialize some requests, and the backend processes them concurrently, creating a load spike on every user login.

**Why it happens:** The existing `DashboardStore.loadWidgetData()` already uses a batched approach (single `POST /api/dashboards/{id}/widget-data` call for all metric widgets). But "My Day" introduces new widget types (upcoming activities, recent entities, personal feed) that are not metric-based and cannot use the existing `DashboardAggregationService.ComputeMetricAsync()` pattern. Each new widget type needs its own data source, and the natural implementation is separate API calls per widget.

**Consequences:**
- 6-8 concurrent API calls on every app load
- Backend processes parallel requests, potentially hitting connection pool limits during login surge (9 AM spike)
- Time-to-interactive delayed: widgets load one by one, causing layout shift as each widget populates
- Worse if user has slow connection: serialized requests take 3-5 seconds for the page to fully load

**Prevention:**
1. **Extend the batched widget data pattern:** The existing `POST /api/dashboards/{id}/widget-data` endpoint should be extended to support new widget types alongside metrics. Add a `widgetType` discriminator to `WidgetMetricRequest` so the backend can route to the appropriate data source (metric computation vs. activity query vs. feed query) while still returning all results in a single response.
2. **Two-tier loading:** Split widgets into "fast" (counts, KPIs -- cached, <50ms) and "slow" (recent entities with includes, feed items). Load fast widgets in the initial batch, then load slow widgets in a second batch. Show skeleton loaders for slow widgets.
3. **Server-side cache for "My Day" data:** Personal dashboard data is highly cacheable. Activities due today, recent deals, and target progress change infrequently. Use `IMemoryCache` with a 60-second TTL keyed by `userId + widgetType`. Invalidate on write operations.
4. **Stagger widget rendering:** Use `@defer` blocks in the Angular template to defer rendering of below-the-fold widgets until the viewport scrolls to them, or until the above-the-fold widgets finish loading.
5. **Prefetch on auth:** After successful login, before navigating to `/my-day`, prefetch the dashboard configuration so the widget layout is immediately available and data loading can start.

**Detection:**
- Network waterfall in browser DevTools: count the number of simultaneous API calls on home page load
- Backend request logging: monitor concurrent request count per user at login time
- Time-to-interactive metric: measure time from navigation to all widgets rendered

**Phase to address:** Personal Dashboard phase -- the batched loading pattern must be designed before building widget components.
**Confidence:** HIGH -- direct inspection of existing batched `loadWidgetData()` shows the pattern, but new widget types will not fit the existing metric-only schema.

---

### Pitfall 8: Tab Index Shift When Adding Summary Tab at Index 0

**What goes wrong:** All existing detail pages use `RelatedEntityTabsComponent` with tab constants like `COMPANY_TABS`, `DEAL_TABS`, etc. The `onTabChanged(index: number)` handler uses hardcoded index numbers to trigger lazy loading: `if (index === 1) { this.loadContacts(); }`. Adding a "Summary" tab at index 0 shifts all existing tab indexes by one. The "Details" tab moves from index 0 to index 1, "Contacts" from index 1 to index 2, and so on. If the `onTabChanged` handler is not updated, clicking "Contacts" (now index 2) triggers `loadContacts()` at old index 1, which no longer maps to Contacts.

**Why it happens:** Tab index coupling. The existing pattern in `company-detail.component.ts` uses numeric literals (`index === 1`, `index === 3`, etc.) rather than named constants or label-based matching. This is brittle to any tab reordering or insertion.

**Consequences:**
- Wrong tab content loads when switching tabs (e.g., clicking "Contacts" loads "Details" instead)
- Lazy loading triggers fire for the wrong tabs, loading unnecessary data
- Some tabs never load their data because the index mapping is broken
- Every detail page across 6+ entity types must be updated, making this a wide-impact change

**Prevention:**
1. **Refactor to label-based tab matching BEFORE adding Summary tab:** Change `onTabChanged(index: number)` to resolve the tab label from the tabs array: `const tabLabel = this.tabs[index]?.label; if (tabLabel === 'Contacts') { this.loadContacts(); }`. This is resilient to index shifts.
2. **Use tab constants as the source of truth:** Define tab labels as string constants (e.g., `TAB_SUMMARY = 'Summary'`, `TAB_DETAILS = 'Details'`) and use them in both the tab configuration and the handler. Never use numeric indexes for business logic.
3. **Update all 6+ detail components consistently:** Company, Contact, Deal, Lead, Quote, Request detail pages all use the same pattern. Create a shared utility or base class method like `getTabLabel(index: number): string` to avoid duplicating the fix.
4. **Add the Summary tab to all `*_TABS` constants at once:** Do not add Summary to `COMPANY_TABS` first and other entities later. Adding incrementally means some detail pages have shifted indexes and some do not, creating inconsistent behavior during development.
5. **Automated test:** For each detail page, verify that clicking each tab loads the correct content. This catches index mismatches immediately.

**Detection:**
- QA: click through every tab on every detail page after adding Summary
- Verify that lazy loading triggers fire for the correct tab (check network requests in DevTools)
- If a tab shows "no data" when it should have data, the index mapping is likely broken

**Phase to address:** Summary Tabs phase -- the refactor from index-based to label-based tab matching should be done as the first task, before adding the Summary tab to any entity.
**Confidence:** HIGH -- direct inspection of `company-detail.component.ts` shows hardcoded `index === 1`, `index === 3`, `index === 4`, `index === 5`, `index === 6`, `index === 7` in `onTabChanged()`.

---

### Pitfall 9: Entity Preview Sidebar Creates Duplicate API/Service Instances

**What goes wrong:** The preview sidebar needs to load data for any entity type (Company, Contact, Deal, Lead, Quote, Request). Each entity type has its own service (`CompanyService`, `ContactService`, etc.) and some have component-provided stores (`CompanyStore`, etc.). If the sidebar component imports and injects all 6+ entity services, it creates tight coupling and increases the sidebar's bundle size. If the sidebar uses component-provided stores, it creates duplicate store instances that conflict with stores on the underlying detail page.

**Why it happens:** The existing architecture uses per-feature services and component-provided stores. The `CompanyDetailComponent` provides its own `CompanyStore`. If the preview sidebar also provides a `CompanyStore` for its preview, and the user is already on the Company detail page, there are now two `CompanyStore` instances with potentially conflicting state.

**Consequences:**
- Bundle size bloat: sidebar imports all 6+ entity feature services
- State confusion: duplicate stores cause stale or conflicting data
- Memory leaks: sidebar creates store instances that are not properly destroyed
- Tight coupling: every new entity type requires changes to the sidebar component

**Prevention:**
1. **Dedicated lightweight preview service:** Create a single `EntityPreviewService` that has one method: `getPreview(entityType: string, entityId: string): Observable<EntityPreviewDto>`. This service calls a single backend endpoint `GET /api/entity-preview/{entityType}/{entityId}` that returns a standardized preview DTO (common fields: name, type, status, owner, key metrics, creation date). Do NOT reuse the existing per-entity detail services.
2. **Generic preview DTO:** Define a single `EntityPreviewDto` interface with: `id, entityType, name, subtitle, status, statusColor, ownerName, createdAt, keyMetrics: { label: string, value: string }[], quickActions: string[]`. The backend maps each entity type to this common shape.
3. **No component-provided stores in sidebar:** The preview sidebar should be stateless -- it loads data on open, displays it, and discards on close. Use a simple signal in the service (`previewData = signal<EntityPreviewDto | null>(null)`) rather than a full signal store.
4. **Lazy-load entity-specific actions:** If the sidebar needs entity-specific actions (e.g., "Change Deal Stage"), load these as dynamic action definitions from the backend rather than importing entity-specific components.
5. **Single backend endpoint:** `GET /api/entity-preview/{entityType}/{entityId}` with a switch on entityType that loads the appropriate entity, runs RBAC checks, and maps to the generic preview DTO. This keeps the backend change contained to one controller.

**Detection:**
- Bundle analysis: if the sidebar chunk exceeds 50KB, it is importing too many entity-specific modules
- Memory profiler: check for leaked store instances when sidebar is opened/closed repeatedly
- If changing entity service code breaks the sidebar, coupling is too tight

**Phase to address:** Entity Preview Sidebar phase -- the generic preview service pattern must be established before building the sidebar UI.
**Confidence:** HIGH -- direct inspection shows component-provided stores and per-entity services as the current pattern.

---

## Minor Pitfalls

Mistakes that cause annoyance, polish issues, or minor bugs, but are easily fixable.

---

### Pitfall 10: Entity Type String Mapping Inconsistencies

**What goes wrong:** The entity type routing in the feed uses `item.entityType.toLowerCase() + 's'` to construct route paths (e.g., `"Deal"` -> `"/deals"`). The notification center uses a hardcoded `typeMap` object. The activity detail uses a switch statement. These three separate entity-type-to-route mapping implementations will diverge when new entity types are added (Lead, Quote, Request for the preview sidebar). One location gets updated, the others do not.

**Why it happens:** No centralized entity type registry. Each feature implemented its own mapping independently during v1.0 development.

**Prevention:**
1. **Create a shared `EntityTypeRegistry` utility** with a single mapping: `{ entityType: string } -> { routePath: string, icon: string, label: string, previewSupported: boolean }`. Use this in the feed, notification center, activity detail, and preview sidebar.
2. **Include all entity types from the start:** Company, Contact, Deal, Lead, Quote, Request, Activity, Email, Note, FeedItem. Future-proof by making the registry the single source of truth.
3. **Fail gracefully for unknown types:** If an entity type is not in the registry, show a generic fallback (e.g., disabled link with "Unknown entity") instead of crashing or navigating to a 404 page.

**Phase to address:** Feed Deep Linking phase -- create the registry as a shared utility before building entity links.
**Confidence:** HIGH -- three separate mapping implementations visible in the codebase.

---

### Pitfall 11: angular-gridster2 Layout Serialization Drift Between Org and Personal Dashboards

**What goes wrong:** The existing org dashboard uses `angular-gridster2` with a 12-column layout and `fixedRowHeight: 200`. The personal "My Day" dashboard may need different grid settings (e.g., different row height for activity list widgets, or a different number of columns for a more compact layout). If both dashboards share the same `DashboardGridComponent` with the same gridster config, the personal dashboard looks wrong (too much whitespace or too cramped). If they have different configs, saved widget positions from one layout do not render correctly in the other.

**Why it happens:** `angular-gridster2` positions are absolute grid coordinates (x, y, cols, rows). These coordinates are only meaningful within a specific grid configuration. A widget at position (x:6, y:0, cols:6, rows:2) in a 12-column grid occupies the right half. In an 8-column grid, the same coordinates would overflow.

**Prevention:**
1. **Use the same gridster configuration for both dashboards.** The existing 12-column / 200px row height config is flexible enough for both org and personal dashboards. Do not create a second grid config.
2. **Differentiate at the widget level, not the grid level.** Personal widgets (activity list, recent items) should use different `rows` values (e.g., `rows: 3` for a tall activity list) rather than changing the grid's `fixedRowHeight`.
3. **Widget type determines default size:** Define default `cols`/`rows` per widget type in a constant map. When a user adds a "My Upcoming Activities" widget, it defaults to `cols: 6, rows: 3`. When they add a KPI card, it defaults to `cols: 3, rows: 1`.

**Phase to address:** Personal Dashboard phase -- ensure grid config compatibility before adding new widget types.
**Confidence:** MEDIUM -- depends on the specific layout requirements for "My Day" widgets.

---

### Pitfall 12: Preview Sidebar Opens on Every Feed Scroll Interaction

**What goes wrong:** The feed list uses infinite scroll (Load More button) and renders entity links as clickable elements. If the sidebar opens on click, and the user is quickly scrolling and accidentally taps an entity link, the sidebar opens unexpectedly. On mobile, this is especially problematic because the sidebar is full-screen, interrupting the scroll flow.

**Why it happens:** Click events on touch devices can fire on scroll if the touch handler is not properly configured with debouncing or drag detection.

**Prevention:**
1. **Require deliberate click:** Use a small delay (100ms) or check that the click position did not change (no drag/scroll occurred) before opening the sidebar.
2. **Hover preview on desktop:** On desktop, show a tooltip or mini-card on hover over the entity link. Only open the full sidebar on click. This gives users a preview without a commitment.
3. **Mobile: navigate instead of sidebar:** On mobile viewports, clicking a feed entity link should navigate to the entity detail page rather than opening a sidebar overlay. The sidebar pattern works on desktop (where there is room for both content and sidebar) but not on mobile.

**Phase to address:** Entity Preview Sidebar phase -- include mobile-specific behavior in the component design.
**Confidence:** MEDIUM -- general UX concern, not specific to any bug found in the codebase.

---

### Pitfall 13: SignalR Real-Time Updates Cause Summary Tab Counter Flicker

**What goes wrong:** The "My Day" dashboard and summary tabs subscribe to SignalR events for real-time updates (following the existing `DashboardStore.startRealTimeRefresh()` pattern). Every CRM mutation in the tenant triggers a SignalR event. On a busy tenant, this causes rapid counter updates: "5 Deals" -> "6 Deals" -> "5 Deals" (if the 6th deal was quickly deleted) flickering on screen. The existing debounce of 2 seconds (`debounceTime(2000)` in `DashboardStore`) helps but is crude.

**Why it happens:** The existing pattern refreshes ALL widget data on ANY SignalR event. For summary tabs, this means a Contact creation event triggers a re-fetch of the Company summary, even though the contact may not be linked to the currently viewed company.

**Prevention:**
1. **Event-scoped refresh:** SignalR events should include the entity type and ID. Summary tabs should only refresh when the event is relevant (e.g., a Deal event for a Company summary only refreshes if the deal's `CompanyId` matches the current company). This requires enriching SignalR payloads.
2. **Debounce + batch:** Use `debounceTime(3000)` for summary refreshes (longer than the current 2000ms for dashboards). Collect multiple events during the debounce window and make a single refresh call.
3. **Optimistic updates where possible:** For simple operations (deal created, activity completed), apply the count change optimistically instead of re-fetching from the server.

**Phase to address:** Summary Tabs and Personal Dashboard phases -- consider this during SignalR integration for both features.
**Confidence:** MEDIUM -- based on the existing SignalR refresh pattern and its known limitations.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Severity | Mitigation |
|-------------|---------------|----------|------------|
| Feed Deep Linking | Deleted/merged entity links (P3) | Critical | Graceful 404 handling + entity name denormalization |
| Feed Deep Linking | Entity type string mapping inconsistency (P10) | Minor | Create shared EntityTypeRegistry utility |
| Entity Preview Sidebar | RBAC bypass in preview (P1) | Critical | Scope-checked preview endpoint |
| Entity Preview Sidebar | Z-index and scroll conflicts (P6) | Moderate | CDK Overlay with explicit stacking |
| Entity Preview Sidebar | Duplicate service/store instances (P9) | Moderate | Generic EntityPreviewService |
| Entity Preview Sidebar | Accidental open on scroll (P12) | Minor | Debounced click, mobile nav fallback |
| Summary Tabs | N+1 aggregation queries (P2) | Critical | Single batched summary endpoint |
| Summary Tabs | Stale data after mutations (P5) | Moderate | Dirty-flag invalidation + lightweight re-fetch |
| Summary Tabs | Tab index shift (P8) | Moderate | Refactor to label-based tab matching first |
| Summary Tabs | Counter flicker from SignalR (P13) | Minor | Event-scoped refresh + debounce |
| Personal Dashboard | Route migration breaking existing links (P4) | Critical | Route redirects + backward compat |
| Personal Dashboard | Widget data loading waterfall (P7) | Moderate | Extend batched widget data pattern |
| Personal Dashboard | Gridster layout serialization (P11) | Minor | Same grid config, widget-level sizing |

---

## Recommended Pitfall Resolution Order

1. **Before any coding:** Create shared `EntityTypeRegistry` (P10), refactor tab handlers from index to label-based (P8)
2. **Feed Deep Linking phase:** Address P3 (deleted entity handling) and P10 (entity type registry)
3. **Entity Preview Sidebar phase:** Address P1 (RBAC), P6 (overlay architecture), P9 (generic preview service), P12 (mobile behavior)
4. **Summary Tabs phase:** Address P2 (batched endpoint), P5 (invalidation), P8 (index shift), P13 (SignalR scoping)
5. **Personal Dashboard phase:** Address P4 (route migration), P7 (loading waterfall), P11 (grid config)

---

## Sources

- Direct codebase inspection: `feed-list.component.ts`, `FeedController.cs`, `DashboardsController.cs`, `company-detail.component.ts`, `related-entity-tabs.component.ts`, `permission.store.ts`, `app.routes.ts`, `app.component.ts`, `FeedItem.cs`, `dashboard.store.ts`
- [EF Core Efficient Querying](https://learn.microsoft.com/en-us/ef/core/performance/efficient-querying) -- Microsoft Learn
- [Angular CDK Overlay Basics](https://briantree.se/angular-cdk-overlay-tutorial-learn-the-basics/) -- Brian Treese
- [Angular OnPush Change Detection Pitfalls](https://blog.angular-university.io/onpush-change-detection-how-it-works/) -- Angular University
- [N+1 Problem in EF Core](https://www.jocheojeda.com/2025/06/26/understanding-the-n1-database-problem-using-entity-framework-core/) -- Joche Ojeda
- [EF Core Split Queries](https://bytecrate.dev/find-fix-ef-core-n-1-queries/) -- ByteCrate
- [Parallel API Calls in Angular](https://tacettinsertkaya.medium.com/parallel-api-calls-in-angular-applications-4afa9f03c94d) -- Medium
- [Angular 21 CDK Overlay Issues](https://medium.com/@Angular_With_Awais/how-to-fix-angular-21-cdk-overlay-issues-without-css-hacks-fcfa8ff349cf) -- Medium

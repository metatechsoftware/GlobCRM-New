# Architecture Patterns: v1.2 Connected Experience

**Domain:** Entity-linked feed, entity preview sidebars, summary tabs on detail pages, personal "My Day" dashboard
**Researched:** 2026-02-20
**Confidence:** HIGH (based on exhaustive codebase analysis of existing patterns)

## Executive Summary

The v1.2 "Connected Experience" milestone weaves together three features that transform GlobCRM from a record-keeping system into a navigable information network. Unlike v1.1's event-driven automation, v1.2 is primarily a **frontend UX milestone** with targeted backend data aggregation endpoints. The existing architecture handles 90% of the requirements -- the key challenge is designing new **shared components** and **lightweight backend summaries** that integrate cleanly with the established patterns without duplicating existing functionality.

The three features share a common architectural thread: **contextual data surfacing**. Entity preview sidebars show entity snapshots without navigation. Summary tabs aggregate relationship counts and recent activity. "My Day" personalizes the existing dashboard with user-scoped daily views. All three consume existing entity data through new aggregation endpoints, and all three are rendered by new shared Angular components that slot into the established component hierarchy.

**Critical architectural decision:** The entity preview sidebar must be a **global overlay component** hosted at the `AppComponent` level (alongside the navbar), managed by a root-level `PreviewSidebarStore`, and triggered from anywhere in the app. It cannot live inside individual feature modules because feed items, search results, and related entity links all need to open previews from different contexts.

## Recommended Architecture

### System-Level View: v1.2 Components

```
EXISTING (unchanged)                    NEW (v1.2)
============================           ============================

AppComponent                            + EntityPreviewSidebarComponent
  - NavbarComponent                       (global overlay, lives here)
  - <router-outlet>                     + PreviewSidebarService (root)
                                        + PreviewSidebarStore (root)
Feature Detail Pages                        |
  - RelatedEntityTabsComponent          + EntitySummaryTabComponent (new tab)
  - EntityTimelineComponent               (added as Summary tab to tab consts)
  - tab content templates                   |
                                        + EntitySummaryService (new)
Feed Feature                            + Entity-linked feed filtering
  - FeedListComponent                     (add entityType/entityId params)
  - FeedStore                           + EntityFeedTabComponent (new)
  - FeedService                             |
                                        + "My Day" dashboard tab
Dashboard Feature                         (new tab in DashboardComponent)
  - DashboardComponent                  + MyDayStore (new per-page store)
  - DashboardStore                      + MyDayApiService (new)
  - angular-gridster2                   + MyDayComponent (new)
                                            |
.NET 10 Backend                         + EntityPreviewController (new)
  - Entity Controllers                  + EntitySummaryController (new)
  - FeedController                      + FeedController: add entity filter
  - DashboardsController                + MyDayController (new)
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **EntityPreviewSidebarComponent** | Renders a slide-over panel showing entity snapshot data. Hosts entity-type-specific preview templates. | PreviewSidebarStore (state), EntityPreviewService (data fetch) |
| **PreviewSidebarStore** | Root signal store managing sidebar open/close state, current entity type + ID, loaded preview data. | EntityPreviewService for API calls |
| **EntityPreviewService** | Calls `GET /api/entities/{type}/{id}/preview` to fetch lightweight entity preview data. | ApiService (HTTP layer) |
| **EntitySummaryTabComponent** | Shared component that renders aggregated counts + recent items for an entity's relationships. Designed to slot into RelatedEntityTabsComponent as a new tab. | EntitySummaryService for data |
| **EntitySummaryService** | Calls `GET /api/{entityType}/{id}/summary` for aggregated relationship data. | ApiService |
| **EntityFeedTabComponent** | Renders entity-scoped feed items inside a detail page tab. Reuses feed card markup from FeedListComponent. | FeedService (extended with entity filter params) |
| **MyDayComponent** | Personal daily dashboard showing today's activities, recent deals, pending items. Lives as a new tab in DashboardComponent. | MyDayStore, MyDayApiService |
| **MyDayStore** | Per-page signal store for My Day data (today's activities, overdue items, recent feed). | MyDayApiService |
| **MyDayApiService** | Calls `GET /api/my-day` for aggregated personal daily snapshot. | ApiService |

### Data Flow

#### 1. Entity Preview Sidebar

```
User clicks entity link/name anywhere in app
  |
  v
Component calls PreviewSidebarStore.open(entityType, entityId)
  |
  v
PreviewSidebarStore patches state: { isOpen: true, entityType, entityId, isLoading: true }
  |
  v
EntityPreviewService.getPreview(entityType, entityId)
  --> GET /api/entities/{type}/{id}/preview
  |
  v
Backend: EntityPreviewController
  - Resolves entity type to repository
  - Loads entity with minimal includes (no deep graph)
  - Returns EntityPreviewDto (type-specific fields)
  |
  v
PreviewSidebarStore patches: { data: EntityPreviewDto, isLoading: false }
  |
  v
EntityPreviewSidebarComponent renders overlay panel
  - CSS: fixed position, right: 0, z-index above content but below dialogs
  - Width: 400px, slide-in animation
  - Content: type-specific template using @switch(entityType)
  - Actions: "View Full Record" button navigates to detail page
  - Close: click outside, Escape key, X button
```

#### 2. Summary Tab on Detail Pages

```
Detail page loads entity (existing flow, unchanged)
  |
  v
RelatedEntityTabsComponent renders tabs from ENTITY_TABS constant
  (NEW: "Summary" tab added at index 0, before "Details")
  |
  v
User clicks "Summary" tab (or it's the default landing tab)
  |
  v
EntitySummaryTabComponent receives entityType + entityId as inputs
  |
  v
EntitySummaryService.getSummary(entityType, entityId)
  --> GET /api/{entityType}/{id}/summary
  |
  v
Backend: Aggregation query per entity type
  For a Contact:
    - Deal count + total pipeline value (from DealContacts)
    - Activity count (open + overdue)
    - Quote count + total value
    - Request count (open)
    - Email count
    - Note count
    - Last activity timestamp
    - Recent feed items (limit 5, filtered by EntityType='Contact' + EntityId)
  |
  v
Returns EntitySummaryDto with counts, totals, and recent items
  |
  v
EntitySummaryTabComponent renders:
  - KPI cards row (deal value, open activities, etc.)
  - Recent activity mini-timeline (last 5 feed items)
  - Quick-action buttons (log activity, send email, add note)
```

#### 3. Entity-Linked Feed Tab

```
Detail page: user clicks "Feed" tab
  |
  v
EntityFeedTabComponent receives entityType + entityId
  |
  v
FeedService.getEntityFeed(entityType, entityId, page, pageSize)
  --> GET /api/feed?entityType={type}&entityId={id}&page=1&pageSize=20
  |
  v
Backend: FeedController.GetList extended
  - Adds optional [FromQuery] string? entityType, Guid? entityId
  - Filters FeedItems where EntityType == type AND EntityId == id
  - Returns same FeedPagedResponse shape
  |
  v
EntityFeedTabComponent renders feed items
  - Reuses feed item card styling from FeedListComponent
  - Includes inline comment toggle (same pattern)
  - Includes post form for entity-scoped social posts
  - SignalR FeedUpdate events filtered client-side by entity match
```

#### 4. "My Day" Personal Dashboard

```
Dashboard page loads (existing flow)
  |
  v
DashboardComponent renders mat-tab-group
  (NEW: "My Day" tab added before "Dashboard" tab)
  |
  v
MyDayComponent initializes, calls MyDayStore.loadMyDay()
  |
  v
MyDayApiService.getMyDay()
  --> GET /api/my-day
  |
  v
Backend: MyDayController
  - Queries current user's data only (no team-wide):
    - Today's activities (due today or overdue, assigned to user)
    - Recent deals (user-owned, updated in last 7 days)
    - Pending items (activities overdue, requests awaiting response)
    - Today's feed items (limit 10, authored by user or @mentioning user)
    - Quick stats (activities completed today, deals progressed today)
  |
  v
Returns MyDayDto with sections
  |
  v
MyDayComponent renders:
  - Greeting header (reuses existing DashboardComponent greeting pattern)
  - "Today's Tasks" checklist (activities, with status toggle)
  - "Recent Deals" mini cards
  - "Your Feed" compact feed list
  - Quick-action buttons (new activity, new deal, compose email)
```

## Integration Points: New vs Modified

### NEW Components (to create from scratch)

| Component | Location | Type |
|-----------|----------|------|
| `EntityPreviewSidebarComponent` | `shared/components/entity-preview-sidebar/` | Shared component, imported in AppComponent |
| `PreviewSidebarStore` | `shared/components/entity-preview-sidebar/preview-sidebar.store.ts` | Root signal store (providedIn: 'root') |
| `EntityPreviewService` | `shared/components/entity-preview-sidebar/entity-preview.service.ts` | Root service |
| `EntitySummaryTabComponent` | `shared/components/entity-summary-tab/` | Shared component, used in detail pages |
| `EntitySummaryService` | `shared/components/entity-summary-tab/entity-summary.service.ts` | Root service |
| `EntityFeedTabComponent` | `shared/components/entity-feed-tab/` | Shared component, used in detail pages |
| `MyDayComponent` | `features/dashboard/pages/my-day/` | Feature component |
| `MyDayStore` | `features/dashboard/stores/my-day.store.ts` | Per-page signal store |
| `MyDayApiService` | `features/dashboard/services/my-day-api.service.ts` | Root service |
| `EntityPreviewController` | `Controllers/EntityPreviewController.cs` | API controller |
| `EntitySummaryController` | `Controllers/EntitySummaryController.cs` | API controller |
| `MyDayController` | `Controllers/MyDayController.cs` | API controller |

### MODIFIED Components (add to existing)

| Component | What Changes | Why |
|-----------|-------------|-----|
| `AppComponent` | Add `EntityPreviewSidebarComponent` to template, after `<router-outlet>` | Preview sidebar is a global overlay |
| `FeedController.GetList` | Add optional `entityType` + `entityId` query params for filtering | Entity-scoped feed |
| `FeedService` | Add `getEntityFeed(entityType, entityId, page, pageSize)` method | Frontend entity-scoped feed calls |
| `FeedRepository.GetFeedAsync` | Add optional entity filter params, or add new `GetEntityFeedAsync` method | Backend entity-scoped feed query |
| `IFeedRepository` | Add `GetEntityFeedAsync(entityType, entityId, page, pageSize)` interface method | Interface contract |
| `COMPANY_TABS` | Add `{ label: 'Summary', icon: 'summarize', enabled: true }` at index 0, add `{ label: 'Feed', icon: 'dynamic_feed', enabled: true }` | New tabs on detail pages |
| `CONTACT_TABS` | Same: add Summary + Feed tabs | New tabs on detail pages |
| `DEAL_TABS` | Same: add Summary + Feed tabs | New tabs on detail pages |
| `CompanyDetailComponent` | Add Summary tab content + Feed tab content using shared components | Wire new tabs |
| `ContactDetailComponent` | Same | Wire new tabs |
| `DealDetailComponent` | Same | Wire new tabs |
| `LeadDetailComponent` | Same | Wire new tabs |
| `DashboardComponent` | Add "My Day" tab to mat-tab-group, lazy-load MyDayComponent | Personal dashboard |
| `FeedListComponent` | Entity links trigger `PreviewSidebarStore.open()` instead of `router.navigate` | Preview on hover/click |
| `GlobalSearchComponent` | Search hits trigger `PreviewSidebarStore.open()` as secondary action | Preview from search |
| `SignalRService` | No changes needed -- existing FeedUpdate/FeedCommentAdded events suffice | Real-time already works |

## Patterns to Follow

### Pattern 1: Global Overlay Component (Preview Sidebar)

**What:** A component that lives at the AppComponent level, managed by a root signal store, rendered as a fixed-position overlay.

**When:** When a UI element needs to be accessible from any route without navigating away.

**Why this over MatSidenav:** The existing app uses a CSS-only sidebar for navigation (no MatSidenav). Adding MatSidenav for the preview panel would conflict. A custom overlay is simpler, more controllable, and consistent with the existing nav pattern.

**Example:**

```typescript
// preview-sidebar.store.ts
export const PreviewSidebarStore = signalStore(
  { providedIn: 'root' },
  withState({
    isOpen: false,
    entityType: null as string | null,
    entityId: null as string | null,
    data: null as EntityPreviewDto | null,
    isLoading: false,
  }),
  withMethods((store) => {
    const previewService = inject(EntityPreviewService);
    return {
      open(entityType: string, entityId: string): void {
        patchState(store, {
          isOpen: true,
          entityType,
          entityId,
          isLoading: true,
          data: null,
        });
        previewService.getPreview(entityType, entityId).subscribe({
          next: (data) => patchState(store, { data, isLoading: false }),
          error: () => patchState(store, { isLoading: false }),
        });
      },
      close(): void {
        patchState(store, { isOpen: false, entityType: null, entityId: null, data: null });
      },
    };
  }),
);
```

```typescript
// entity-preview-sidebar.component.ts
@Component({
  selector: 'app-entity-preview-sidebar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Renders as fixed overlay, 400px wide, slides from right
  host: {
    '[class.open]': 'store.isOpen()',
  },
  template: `
    @if (store.isOpen()) {
      <div class="preview-backdrop" (click)="store.close()"></div>
      <aside class="preview-panel">
        <!-- header with close button -->
        <!-- loading state -->
        <!-- entity-type-specific content via @switch -->
        <!-- "View Full Record" footer link -->
      </aside>
    }
  `,
})
export class EntityPreviewSidebarComponent {
  readonly store = inject(PreviewSidebarStore);
}
```

```typescript
// In AppComponent template, add after <router-outlet>:
// <app-entity-preview-sidebar />
```

### Pattern 2: Aggregation Endpoint (Summary + My Day)

**What:** A single backend endpoint that runs multiple targeted queries and returns a composite DTO, avoiding N+1 API calls from the frontend.

**When:** When a UI component needs to display counts/totals from multiple entity types simultaneously.

**Why not reuse existing list endpoints:** Existing list endpoints (`GET /api/contacts?page=1&pageSize=1`) return full DTOs with pagination overhead. Summary data needs only counts and totals, which are much cheaper as `COUNT(*)` and `SUM()` aggregate queries.

**Example:**

```csharp
// EntitySummaryController.cs
[HttpGet("api/contacts/{id:guid}/summary")]
[Authorize(Policy = "Permission:Contact:View")]
public async Task<IActionResult> GetContactSummary(Guid id)
{
    var userId = GetCurrentUserId();
    var tenantId = GetTenantId();

    // All queries run against tenant-scoped DbContext (global filter active)
    var dealCount = await _db.DealContacts
        .Where(dc => dc.ContactId == id)
        .CountAsync();

    var dealTotalValue = await _db.DealContacts
        .Where(dc => dc.ContactId == id)
        .Join(_db.Deals, dc => dc.DealId, d => d.Id, (dc, d) => d)
        .SumAsync(d => d.Value ?? 0);

    var openActivityCount = await _db.Activities
        .Where(a => a.LinkedEntityType == "Contact" && a.LinkedEntityId == id)
        .Where(a => a.Status != "Completed" && a.Status != "Cancelled")
        .CountAsync();

    var noteCount = await _db.Notes
        .Where(n => n.EntityType == "Contact" && n.EntityId == id)
        .CountAsync();

    var recentFeed = await _db.FeedItems
        .Where(f => f.EntityType == "Contact" && f.EntityId == id)
        .OrderByDescending(f => f.CreatedAt)
        .Take(5)
        .Include(f => f.Author)
        .Select(f => FeedItemDto.FromEntity(f))
        .ToListAsync();

    return Ok(new ContactSummaryDto
    {
        DealCount = dealCount,
        DealTotalValue = dealTotalValue,
        OpenActivityCount = openActivityCount,
        NoteCount = noteCount,
        RecentFeedItems = recentFeed,
        // ... more counts
    });
}
```

### Pattern 3: Tab Constant Extension

**What:** Adding new tabs to existing `ENTITY_TABS` arrays with shared tab content components.

**When:** Adding Summary and Feed tabs to all entity detail pages.

**Important:** Tab order matters because existing `onTabChanged(index)` handlers use hardcoded index numbers. New tabs should be inserted carefully, and all existing index references must be updated.

**Example:**

```typescript
// Before (existing):
export const CONTACT_TABS: EntityTab[] = [
  { label: 'Details', icon: 'info', enabled: true },        // 0
  { label: 'Company', icon: 'business', enabled: true },     // 1
  { label: 'Deals', icon: 'handshake', enabled: true },      // 2
  // ...
];

// After (v1.2):
export const CONTACT_TABS: EntityTab[] = [
  { label: 'Summary', icon: 'summarize', enabled: true },    // 0 (NEW)
  { label: 'Details', icon: 'info', enabled: true },          // 1 (was 0)
  { label: 'Company', icon: 'business', enabled: true },      // 2 (was 1)
  { label: 'Deals', icon: 'handshake', enabled: true },       // 3 (was 2)
  // ...
  { label: 'Feed', icon: 'dynamic_feed', enabled: true },     // N (NEW, last)
];
```

**CRITICAL:** All `onTabChanged(index)` handlers in detail components use hardcoded numbers:
```typescript
// ContactDetailComponent.onTabChanged -- ALL indices shift by +1
if (index === 3) { this.loadLinkedActivities(); }  // was 3, becomes 4
```

This is a mechanical but error-prone change. Each detail component's index mapping must be updated.

### Pattern 4: Entity-Type-Specific Content Switching

**What:** A single shared component that renders different content based on entity type, using Angular's `@switch` control flow.

**When:** The preview sidebar and summary tab need to show different fields for contacts vs deals vs companies.

**Example:**

```typescript
// Inside EntityPreviewSidebarComponent template:
@switch (store.entityType()) {
  @case ('Contact') {
    <div class="preview-contact">
      <div class="preview-avatar">{{ data.initials }}</div>
      <h3>{{ data.fullName }}</h3>
      <span class="preview-subtitle">{{ data.jobTitle }} at {{ data.companyName }}</span>
      <div class="preview-fields">
        <!-- email, phone, company link -->
      </div>
    </div>
  }
  @case ('Deal') {
    <div class="preview-deal">
      <h3>{{ data.title }}</h3>
      <div class="preview-stage-badge">{{ data.stageName }}</div>
      <span class="preview-value">{{ data.value | currency }}</span>
      <!-- probability, expected close, company -->
    </div>
  }
  @case ('Company') {
    <!-- company-specific preview -->
  }
}
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Preview Sidebar Inside Feature Modules

**What:** Placing the preview sidebar component inside `features/feed/` or `features/contacts/` and trying to import it cross-module.

**Why bad:** The preview needs to be triggered from feed, search, detail page links, and potentially future contexts. Placing it in a feature module creates circular dependency chains and breaks lazy-loading boundaries.

**Instead:** Put it in `shared/components/entity-preview-sidebar/` with a root-provided store and service. Import the component in `AppComponent` only. Other components interact solely through `PreviewSidebarStore.open()`.

### Anti-Pattern 2: Reusing Full Detail DTOs for Preview

**What:** Calling the existing `GET /api/contacts/{id}` endpoint to populate the preview sidebar.

**Why bad:** Detail DTOs include deep navigation properties (linked contacts, products, timeline, custom fields) that the preview sidebar does not need. This wastes bandwidth and database joins for a 400px sidebar that shows 5-8 fields.

**Instead:** Create a dedicated `GET /api/entities/{type}/{id}/preview` endpoint that returns a slim DTO with only the fields shown in the preview panel. Example: for a contact, return `fullName`, `jobTitle`, `companyName`, `email`, `phone`, `avatarUrl`, `ownerName`, `createdAt`. No linked entities, no custom fields, no timeline.

### Anti-Pattern 3: Duplicating Feed Logic

**What:** Creating a separate feed component and store for entity-scoped feed tabs, duplicating the paging, comment, and real-time logic from `FeedListComponent`.

**Why bad:** The feed card rendering, comment toggle, comment submission, relative time formatting, and SignalR subscription logic are non-trivial. Duplicating them creates maintenance burden and divergence.

**Instead:** Extract a `FeedCardComponent` from `FeedListComponent` that renders a single feed item with comments. Both `FeedListComponent` and `EntityFeedTabComponent` compose this card component. The entity feed tab uses a lightweight local signal store that delegates to `FeedService` with entity filter params.

### Anti-Pattern 4: Making Summary Tab Hit Multiple Existing Endpoints

**What:** Having the summary tab's frontend component call `GET /api/activities?contactId=X&page=1&pageSize=1` (for count), `GET /api/deals?contactId=X&page=1&pageSize=1` (for count), etc., stitching together N API calls client-side.

**Why bad:** N+1 HTTP requests per summary tab load. Each existing list endpoint runs full query pipelines (RBAC scope check, filter parsing, pagination, DTO mapping) when all we need is `COUNT(*)`.

**Instead:** Single `GET /api/contacts/{id}/summary` endpoint that runs optimized aggregate queries in one database round-trip and returns all counts/totals in one response.

### Anti-Pattern 5: Hardcoded Index Shifts Without Constants

**What:** Updating `onTabChanged(index)` handlers by manually incrementing all numbers by 1 (or 2) to account for new tabs.

**Why bad:** Index-based tab switching is fragile. If tabs are reordered or conditionally shown, all indices break silently.

**Mitigation (not full fix):** Use named constants for tab indices in each detail component:

```typescript
const TAB = { SUMMARY: 0, DETAILS: 1, COMPANY: 2, DEALS: 3, ACTIVITIES: 4, /* ... */ FEED: 10 };

onTabChanged(index: number): void {
  if (index === TAB.ACTIVITIES) { this.loadLinkedActivities(); }
  if (index === TAB.QUOTES) { this.loadLinkedQuotes(); }
}
```

This does not change the RelatedEntityTabsComponent API (which is index-based), but makes the consuming code self-documenting and less error-prone.

## New Backend Endpoints Specification

### GET /api/entities/{entityType}/{entityId}/preview

**Purpose:** Lightweight entity snapshot for preview sidebar.

**Response:** `EntityPreviewDto` (polymorphic by type)

```json
{
  "entityType": "Contact",
  "entityId": "guid",
  "title": "Jane Smith",
  "subtitle": "VP Sales at Acme Corp",
  "avatarUrl": null,
  "fields": [
    { "label": "Email", "value": "jane@acme.com", "icon": "email" },
    { "label": "Phone", "value": "+1 555-1234", "icon": "phone" },
    { "label": "Company", "value": "Acme Corp", "icon": "business", "linkType": "Company", "linkId": "guid" },
    { "label": "Owner", "value": "John Doe", "icon": "person" }
  ],
  "createdAt": "2026-01-15T10:00:00Z",
  "updatedAt": "2026-02-20T14:30:00Z"
}
```

**Design rationale:** A generic field-list DTO rather than type-specific DTOs allows the frontend to render any entity type with the same component structure. The `linkType`/`linkId` on individual fields enables chained preview navigation (click company name in contact preview to preview the company).

### GET /api/{entityType}/{id}/summary

**Purpose:** Aggregated relationship counts and recent activity for summary tab.

**Response shape varies by entity type.** Example for Contact:

```json
{
  "entityType": "Contact",
  "stats": [
    { "label": "Open Deals", "value": 3, "icon": "handshake" },
    { "label": "Pipeline Value", "value": 125000, "format": "currency", "icon": "attach_money" },
    { "label": "Open Activities", "value": 5, "icon": "task_alt" },
    { "label": "Overdue", "value": 1, "icon": "warning", "color": "danger" },
    { "label": "Quotes", "value": 2, "icon": "request_quote" },
    { "label": "Emails", "value": 15, "icon": "email" },
    { "label": "Notes", "value": 4, "icon": "note" }
  ],
  "recentActivity": [
    { "id": "guid", "type": "SystemEvent", "content": "Deal 'Enterprise License' moved to Negotiation", "createdAt": "..." },
    { "id": "guid", "type": "SystemEvent", "content": "Email sent: Follow-up proposal", "createdAt": "..." }
  ],
  "lastActivityAt": "2026-02-20T14:30:00Z"
}
```

**Implementation:** Per-entity-type method in a new `EntitySummaryService` in Infrastructure layer. Each method runs optimized aggregate queries using the existing `ApplicationDbContext`. RBAC scope checking should be applied (user can only see summary data they have permission to view).

### GET /api/feed (extended)

**Existing:** `GET /api/feed?page=1&pageSize=20`

**Extended with:** `?entityType=Contact&entityId={guid}`

When `entityType` and `entityId` are provided, filter `FeedItems` to only those with matching `EntityType` and `EntityId`. This reuses the existing paged response shape and all existing DTO mapping.

### GET /api/my-day

**Purpose:** Personal daily dashboard data for current user.

**Response:**

```json
{
  "greeting": "Good morning",
  "todayActivities": [
    { "id": "guid", "subject": "Follow up with Jane", "type": "Call", "status": "Planned", "dueDate": "2026-02-20", "linkedEntityType": "Contact", "linkedEntityId": "guid", "linkedEntityName": "Jane Smith" }
  ],
  "overdueActivities": [
    { "id": "guid", "subject": "Send proposal", "dueDate": "2026-02-18", "linkedEntityName": "Acme Deal" }
  ],
  "recentDeals": [
    { "id": "guid", "title": "Enterprise License", "value": 50000, "stageName": "Negotiation", "stageColor": "#f59e0b", "updatedAt": "2026-02-20T..." }
  ],
  "stats": {
    "activitiesCompletedToday": 3,
    "activitiesDueToday": 5,
    "dealsUpdatedToday": 2,
    "unreadNotifications": 4
  },
  "recentFeed": [
    { "id": "guid", "type": "SocialPost", "content": "...", "authorName": "...", "createdAt": "..." }
  ]
}
```

**Queries:** All scoped to current user (by `OwnerId` or `AssignedToId`). Activities filtered by `DueDate` for today + overdue. Deals filtered by `OwnerId` + `UpdatedAt >= 7 days ago`. Feed filtered by `AuthorId == currentUser OR content contains @mention of user`.

## Scalability Considerations

| Concern | At 100 users | At 10K users | At 1M users |
|---------|--------------|--------------|-------------|
| Preview sidebar API | Direct DB query, <50ms | Same, tenant isolation limits data set | Add response caching (5-10s TTL) |
| Summary tab aggregation | Single DB round-trip, OK | Add composite index on (EntityType, EntityId) for FeedItems | Consider materialized view or cache layer for counts |
| Entity-scoped feed queries | Simple WHERE clause, fast | Index on (TenantId, EntityType, EntityId, CreatedAt) already exists via global filter | Partition FeedItems by TenantId if table exceeds 10M rows |
| My Day endpoint | 4-5 queries per request | Same -- all queries scoped to single user | Cache per-user with 60s TTL, invalidate on write |
| Preview sidebar concurrent opens | N/A (one at a time) | Same | Same (single sidebar instance) |

## Database Index Recommendations

The existing indexes should suffice for most v1.2 queries. Verify the following exist or add:

```sql
-- For entity-scoped feed queries (may already exist via global filter)
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_feed_items_entity
  ON feed_items (tenant_id, entity_type, entity_id, created_at DESC)
  WHERE entity_type IS NOT NULL;

-- For My Day: activities due today for a user
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_activities_user_due
  ON activities (tenant_id, assigned_to_id, due_date, status)
  WHERE status NOT IN ('Completed', 'Cancelled');

-- For summary: deal-contact junction count queries
-- (likely already indexed as FK)
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_deal_contacts_contact
  ON deal_contacts (contact_id, deal_id);
```

## Suggested Build Order

Build order is driven by dependency chains:

```
Phase A: Foundation Components (no dependencies between each other)
  A1: EntityPreviewService + backend endpoint
  A2: Preview sidebar store + component shell
  A3: EntitySummaryService + backend endpoint
  A4: FeedController entity filter extension

Phase B: Integration (depends on A)
  B1: Wire preview sidebar into AppComponent (depends on A1, A2)
  B2: EntitySummaryTabComponent (depends on A3)
  B3: EntityFeedTabComponent + FeedCardComponent extraction (depends on A4)
  B4: MyDayController + MyDayApiService (independent backend work)

Phase C: Wiring into Existing Pages (depends on B)
  C1: Add Summary + Feed tabs to all detail pages (depends on B2, B3)
  C2: Update tab index constants and onTabChanged handlers
  C3: Wire preview triggers into feed, search, entity links
  C4: MyDayComponent + MyDayStore (depends on B4)
  C5: Add My Day tab to DashboardComponent (depends on C4)

Phase D: Polish (depends on C)
  D1: Animations (slide-in/out for preview sidebar)
  D2: Keyboard navigation (Escape closes preview, arrow keys in search open preview)
  D3: Responsive behavior (preview as full-screen on mobile)
  D4: Loading skeletons for summary tab and My Day
```

**Rationale for this order:**
1. Backend endpoints and services first (A) because they have no frontend dependencies and can be tested independently.
2. Component shells second (B) because they need working services to function.
3. Integration into existing pages third (C) because this is where the tab index shift risk lives -- doing it after components are working means you can test each integration immediately.
4. Polish last (D) because animations and edge cases should not block core functionality.

**Parallelism opportunities:**
- A1+A2 can parallel with A3+A4 (preview sidebar vs summary/feed backend work)
- B1+B4 can parallel with B2+B3
- C1+C2 should be sequential (tab constants then handlers)
- C3 can parallel with C4+C5

## Sources

- Codebase analysis: `FeedController.cs`, `FeedRepository.cs`, `FeedItem.cs` (feed architecture)
- Codebase analysis: `related-entity-tabs.component.ts`, tab constants pattern
- Codebase analysis: `contact-detail.component.ts/html/scss` (detail page layout pattern)
- Codebase analysis: `dashboard.component.ts/html`, `dashboard.store.ts` (dashboard architecture)
- Codebase analysis: `app.component.ts` (global layout, sidebar integration point)
- Codebase analysis: `sidebar-state.service.ts` (existing sidebar state management pattern)
- Codebase analysis: `global-search.component.ts` (overlay panel pattern reference)
- Codebase analysis: `signalr.service.ts` (real-time event patterns)
- Codebase analysis: `feed.store.ts`, `feed-list.component.ts` (feed store pattern)
- Codebase analysis: `entity-timeline.component.ts` (shared component pattern for timeline)
- Angular 19 signal store patterns: existing codebase conventions (HIGH confidence)

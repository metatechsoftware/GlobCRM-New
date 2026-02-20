# Phase 24: My Day Personal Dashboard - Research

**Researched:** 2026-02-20
**Domain:** Angular 19 dashboard page, .NET 10 aggregation API, routing restructure
**Confidence:** HIGH

## Summary

Phase 24 replaces the current org dashboard at `/dashboard` with a personal "My Day" page at `/my-day`, relocating the existing dashboard to `/analytics`. The frontend is entirely new Angular components (greeting banner, 7 widget cards, quick action slide-in panels) backed by a new `MyDayController` aggregation endpoint that returns all widget data in a single batched API call. The slide-in panel pattern for quick actions is new infrastructure that reuses the existing form components' `dialogMode` pattern.

The codebase already has all the building blocks: the existing `DashboardComponent` demonstrates greeting banners, skeleton loading, hero sections, and grid layouts with SCSS. The `EntityFormDialogComponent` proves form components work in dialog mode with `[dialogMode]="true"` + `(entityCreated)` outputs. The `PreviewSidebarStore` + `EntityPreviewSidebarComponent` pattern demonstrates a root-provided signal store managing a right-side `mat-sidenav` panel. The `EntityTypeRegistry` provides routing/icon/label metadata for entity links. Phase 23's summary endpoints demonstrate the sequential-query aggregation pattern for combining multiple data sources into a single DTO.

**Primary recommendation:** Build one new `MyDayController` with a single `GET /api/my-day` endpoint that returns all widget data in one batched response. Use CSS Grid (not gridster) for the fixed layout. Implement slide-in panels via a new `SlideInPanelComponent` using Angular CDK Overlay or a dedicated `mat-sidenav` alongside the existing preview drawer.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Dashboard grid layout with mixed-size cards (some full-width, some half-width) -- responsive grid similar to Linear/Jira dashboard
- Greeting banner with quick actions is full-width at top
- Tasks widget is full-width hero below greeting
- Row 2: three half-width cards -- Upcoming events, Pipeline summary, Email summary
- Row 3: three half-width cards -- Feed preview, Notification digest, Recent records
- Quick actions row lives INSIDE the greeting banner (not a separate card)
- Time-based casual greeting: "Good morning, {FirstName}" / "Good afternoon, {FirstName}"
- Short friendly date format: "Thu, Feb 20"
- Key summary stats in greeting banner: tasks today count, overdue count, upcoming meetings count
- Subtle gradient background using orange brand color for the greeting banner -- distinct hero section feel
- Overdue items: red left border or background tint with red "Overdue" badge showing days overdue (e.g. "3d overdue")
- Tasks are completable inline with checkbox -- marks activity as done directly from My Day with optimistic UI update
- Entity name clicks inside widgets open preview sidebar (consistent with feed behavior), Ctrl/Cmd+click navigates to detail page
- Empty widget states: friendly illustration + contextual message (e.g. "No tasks today -- nice work!" or "No deals yet -- create one")
- Quick actions open as slide-in side panels from the right (not MatDialog popups) -- feels more integrated, user stays in dashboard context
- After action completes: real-time widget refresh AND brief highlight/pulse animation on the new item so user sees where the change landed
- Multi-step support: single-step form first, then optional follow-up step (e.g. "Link to company?" or "Schedule follow-up?") -- user can skip or continue

### Claude's Discretion
- Overdue items grouping strategy (separate section vs mixed-sorted-first)
- Task/item count limits per widget
- Pipeline summary visualization approach
- Slide-in panel width
- Upcoming events day grouping (day headers vs timeline)
- Loading skeleton design per widget
- Two-tier loading strategy details

### Deferred Ideas (OUT OF SCOPE)
- "Create Offer" quick action -- Full quote/offer creation wizard as a quick action. Too complex for Phase 24.
- Configurable widget layout (drag-and-drop) -- Already deferred to v1.3+ (gridster-based)
- Quick action side panel pattern for summary tabs -- Future phase consideration
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MYDAY-01 | User sees "My Day" as the default landing page after login | Route restructuring: change `app.routes.ts` default redirect from `dashboard` to `my-day`, update login component `returnUrl`, add redirects for backward compatibility |
| MYDAY-02 | My Day displays a personalized greeting with date/time context | Existing `DashboardComponent` has `greeting()`, `timeIcon()`, `firstName()` computed signals -- reuse same pattern. Hero section SCSS exists as reference. |
| MYDAY-03 | My Day shows today's tasks/activities widget (assigned to user, due today, not done) | Backend: query `Activities` where `AssignedToId == userId && Status != Done && DueDate == today`. Frontend: checkbox for inline completion via `PATCH /api/activities/{id}/status`. |
| MYDAY-04 | My Day highlights overdue tasks with urgency indicators | Backend: include `isOverdue` boolean and `daysOverdue` int in task DTOs. Frontend: red left-border + "Overdue" badge with days count. |
| MYDAY-05 | My Day shows upcoming events/calendar widget (today + next 2 days) | Backend: query `Activities` where `Type == Meeting && DueDate between today and today+2 && Status != Done`. Frontend: grouped by day. |
| MYDAY-06 | My Day shows personal pipeline summary widget (user's deals by stage) | Backend: query `Deals` where `OwnerId == userId`, group by `PipelineStage`, sum values. Frontend: compact visualization. |
| MYDAY-07 | My Day includes quick actions row (New Contact, New Deal, Log Activity, New Note, Send Email) | Quick actions inside greeting banner. Slide-in panel reuses existing form components in `dialogMode`. |
| MYDAY-08 | My Day shows recent records widget (last 5-8 recently viewed entities) | New `RecentlyViewedEntity` domain entity + table needed. Track views in detail page loads. Backend returns last 8 for current user. |
| MYDAY-09 | Org dashboard relocated to its own menu item via sidebar navigation | Move existing dashboard route to `/analytics`, update navbar `navGroups` array. Add redirects for `/dashboard` backward compatibility. |
| MYDAY-10 | My Day includes email summary widget (unread count, recent emails) | Backend: query `EmailMessages` for current user's connected account. Reuse `EmailAccountStatusDto` pattern. |
| MYDAY-11 | My Day includes feed preview widget (last 5 feed items, compact format) | Backend: query `FeedItems` ordered by `CreatedAt` desc, take 5. Reuse `FeedItemDto` model. |
| MYDAY-12 | My Day includes notification digest widget (today's notifications grouped by type) | Backend: query `Notifications` where `CreatedAt >= today`, group by `Type`. Reuse `NotificationDto` model. |
</phase_requirements>

## Standard Stack

### Core (already in project -- zero new packages)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Angular | 19 | Frontend framework | Already in project |
| @ngrx/signals | latest | Signal store for MyDay state | Already in project, all stores use this |
| Angular Material | 19.2 | UI components (cards, buttons, icons, sidenav) | Already in project |
| Angular CDK | 19.2 | Overlay, a11y, layout utilities | Already in project |
| .NET 10 | 10 | Backend API | Already in project |
| EF Core | 10 | Database queries | Already in project |

### Supporting (already in project)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @microsoft/signalr | latest | Real-time widget refresh after quick actions | Already connected, `SignalRService` in place |
| Tailwind CSS | config | Utility classes for layout | Already configured |
| angular-gridster2 | 19 | NOT for My Day (fixed layout uses CSS Grid) | Only for existing org dashboard |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CSS Grid (chosen) | angular-gridster2 | Fixed layout does not need drag-and-drop; CSS Grid is lighter, no lib overhead |
| CDK Overlay for slide-in | Second mat-sidenav | mat-sidenav requires container nesting; CDK Overlay is more flexible for dynamic panels |
| Single batched endpoint | Multiple parallel endpoints | Single endpoint = 1 HTTP request, simpler error handling, atomic loading state |

**Installation:** None required. Zero new packages.

## Architecture Patterns

### Recommended Project Structure
```
globcrm-web/src/app/features/my-day/
  my-day.routes.ts              # Route: '' -> MyDayComponent
  my-day.component.ts           # Page component with grid layout
  my-day.component.html         # Grid template
  my-day.component.scss         # Grid layout + widget card styles
  my-day.store.ts               # Signal store (component-provided)
  my-day.service.ts             # API service for GET /api/my-day
  my-day.models.ts              # DTOs matching backend response
  widgets/
    greeting-banner/            # Full-width hero with stats + quick actions
    tasks-widget/               # Full-width task list with checkboxes
    upcoming-events-widget/     # Half-width event agenda
    pipeline-widget/            # Half-width deal pipeline summary
    email-summary-widget/       # Half-width email stats
    feed-preview-widget/        # Half-width feed items
    notification-digest-widget/ # Half-width notification groups
    recent-records-widget/      # Half-width recently viewed
  slide-in-panel/
    slide-in-panel.component.ts # Shared panel container (header, close, scroll body)
    slide-in-panel.service.ts   # Service to open/close panels programmatically

src/GlobCRM.Api/Controllers/MyDayController.cs  # Single aggregation endpoint
src/GlobCRM.Domain/Entities/RecentlyViewedEntity.cs  # New entity for MYDAY-08
```

### Pattern 1: Batched Aggregation Endpoint (from Phase 23 summary endpoints)
**What:** A single backend endpoint that runs sequential EF Core queries and assembles a composite DTO.
**When to use:** When a page needs data from 6+ tables and N+1 API calls would cause waterfall loading.
**Example:**
```csharp
// Source: Existing pattern in CompaniesController.GetSummary(), DealsController.GetSummary()
[HttpGet]
[Authorize]
public async Task<IActionResult> GetMyDay()
{
    var userId = GetCurrentUserId();
    var now = DateTimeOffset.UtcNow;
    var todayStart = now.Date; // midnight UTC
    var todayEnd = todayStart.AddDays(1);
    var upcomingEnd = todayStart.AddDays(3); // today + next 2 days

    // Sequential queries -- DbContext does not support concurrent async operations
    var todayTasks = await _db.Activities
        .Where(a => (a.AssignedToId == userId || a.OwnerId == userId)
                  && a.Status != ActivityStatus.Done
                  && a.DueDate != null && a.DueDate < todayEnd)
        .OrderBy(a => a.DueDate)
        .Take(20)
        .Select(a => new { a.Id, a.Subject, a.Type, a.Status, a.Priority, a.DueDate })
        .ToListAsync();
    // ... more queries for each widget ...
    return Ok(new MyDayDto { /* assembled */ });
}
```

### Pattern 2: Component-Provided Signal Store (from DashboardStore)
**What:** Signal store listed in component's `providers` array, NOT `providedIn: 'root'`.
**When to use:** Page-level state that should be destroyed when navigating away.
**Example:**
```typescript
// Source: Existing pattern in DashboardStore, ActivityStore, etc.
export const MyDayStore = signalStore(
  withState(initialState),
  withComputed((store) => ({ /* derived signals */ })),
  withMethods((store) => {
    const api = inject(MyDayService);
    const signalR = inject(SignalRService);
    return {
      loadMyDay(): void { /* single API call populates all widget data */ },
      completeTask(id: string): void { /* optimistic update + PATCH */ },
      refreshWidgets(): void { /* reload after quick action */ },
    };
  }),
);
```

### Pattern 3: Slide-In Panel via Service + CDK Overlay
**What:** A shared service that programmatically opens a right-side panel containing form components.
**When to use:** Quick actions that need forms without full-page navigation or blocking dialogs.
**Recommendation:** Use Angular CDK `Overlay` with `ConnectedPosition` anchored to the right edge. This avoids nesting a second `mat-sidenav` inside `AppComponent` (which already has the preview sidebar `mat-sidenav`). The panel component renders the appropriate form based on an `entityType` input, same pattern as `EntityFormDialogComponent`.
**Example:**
```typescript
// SlideInPanelService: opens overlay panel from right edge
@Injectable({ providedIn: 'root' })
export class SlideInPanelService {
  private readonly overlay = inject(Overlay);
  private overlayRef: OverlayRef | null = null;

  open(config: SlideInConfig): SlideInPanelRef {
    this.overlayRef = this.overlay.create({
      positionStrategy: this.overlay.position()
        .global().right('0').top('0').bottom('0'),
      width: '520px',
      hasBackdrop: true,
      backdropClass: 'slide-in-backdrop',
      panelClass: 'slide-in-panel',
    });
    // Attach SlideInPanelComponent via ComponentPortal
    // Return ref with afterClosed observable
  }
}
```

### Pattern 4: Reusing Form Components in Slide-In Mode
**What:** Existing form components (ContactForm, DealForm, ActivityForm, NoteForm) already support `[dialogMode]="true"` + `(entityCreated)` outputs.
**When to use:** Quick actions that create entities from My Day.
**Key insight:** The `EntityFormDialogComponent` already proves this pattern works. The slide-in panel wraps the same form components, replacing `MatDialog` with a CDK Overlay panel. Form components need ZERO changes.
**Example:**
```typescript
// Inside SlideInPanelComponent template:
@switch (config.entityType) {
  @case ('Contact') {
    <app-contact-form [dialogMode]="true" (entityCreated)="onCreated($event)" />
  }
  @case ('Deal') {
    <app-deal-form [dialogMode]="true" (entityCreated)="onCreated($event)" />
  }
  // ... same pattern as EntityFormDialogComponent
}
```

### Pattern 5: Entity Name Click -> Preview Sidebar
**What:** Entity names in widget items open the preview sidebar on click, navigate to detail page on Ctrl/Cmd+click.
**When to use:** All entity name links inside My Day widgets.
**Key insight:** The `PreviewEntityLinkComponent` already implements this exact behavior for feed items. Reuse it directly or follow the same pattern: inject `PreviewSidebarStore`, call `open()` on click, `router.navigate()` on Ctrl+click.
**Source:** `globcrm-web/src/app/shared/components/entity-preview/preview-entity-link.component.ts`

### Pattern 6: Optimistic UI Update for Task Completion
**What:** When user clicks checkbox, immediately mark task as done in local state, send PATCH in background, revert on error.
**When to use:** Inline task completion on My Day.
**Example:**
```typescript
completeTask(taskId: string): void {
  // Optimistic: remove from today's tasks immediately
  const tasks = store.tasks();
  const task = tasks.find(t => t.id === taskId);
  patchState(store, { tasks: tasks.filter(t => t.id !== taskId) });

  activityService.updateStatus(taskId, 'Done').subscribe({
    error: () => {
      // Revert on failure
      patchState(store, { tasks: [...store.tasks(), task] });
      snackBar.open('Failed to complete task', 'Close', { duration: 3000 });
    }
  });
}
```

### Anti-Patterns to Avoid
- **Multiple parallel API calls from the page component:** Don't make 8 separate API calls for 8 widgets. Use a single batched endpoint.
- **Root-provided store for page data:** MyDayStore should be component-provided so state resets on navigation.
- **Using gridster for fixed layout:** CSS Grid is sufficient and avoids the gridster library overhead for a non-configurable layout.
- **Nesting a second mat-sidenav for slide-in panels:** The app already has a preview sidebar mat-sidenav. Use CDK Overlay instead to avoid mat-sidenav nesting constraints.
- **Creating new form components for quick actions:** Reuse existing form components with `[dialogMode]="true"`. Don't duplicate form logic.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Right-side panel | Custom CSS panel with manual animation | Angular CDK Overlay with `position().global().right()` | Handles backdrop, focus trap, scroll locking, escape key, animation |
| Task status transition | Direct DB update bypassing workflow | `ActivityService.updateStatus()` -> existing `PATCH /api/activities/{id}/status` | Workflow validation, allowed transitions, notification dispatch already handled |
| Entity routing | Manual route map | `EntityTypeRegistry.getEntityRoute()` | Already centralized, used by preview sidebar and feed |
| Entity icons/labels | Hardcoded strings per widget | `EntityTypeRegistry` ENTITY_TYPE_REGISTRY constant | Single source of truth for entity display metadata |
| Greeting time logic | New implementation | Copy from existing `DashboardComponent.greeting()` / `timeIcon()` computed signals | Already proven, includes all time-of-day variants |

**Key insight:** Almost everything needed already exists in the codebase -- the work is primarily assembly and wiring, not invention.

## Common Pitfalls

### Pitfall 1: EF Core Concurrent Async Operations
**What goes wrong:** Calling multiple `await _db.X.ToListAsync()` concurrently with `Task.WhenAll()`.
**Why it happens:** EF Core DbContext is not thread-safe; concurrent operations throw `InvalidOperationException`.
**How to avoid:** Use sequential `await` for all queries in the MyDay aggregation endpoint, exactly as the existing summary endpoints do.
**Warning signs:** "A second operation was started on this context instance before a previous operation completed."

### Pitfall 2: Enum ToString() in EF Core Projections
**What goes wrong:** Using `.ToString()` on value-converted enums in LINQ `.Select()` projections fails to translate to SQL.
**Why it happens:** EF Core has `HasConversion<string>()` for storage but cannot translate `.ToString()` in server-side projections.
**How to avoid:** Select raw enum values first, then map to string DTOs in memory. Existing pattern in all summary endpoints.
**Warning signs:** `InvalidOperationException: The LINQ expression could not be translated.`

### Pitfall 3: Route Redirect Loops
**What goes wrong:** Redirecting `/` to `/my-day` while also redirecting `/dashboard` causes loops or breaks backward compatibility.
**How to avoid:** Careful ordering in `app.routes.ts`. The `/dashboard` path should become a redirect to `/analytics` (not removed), keeping backward compatibility for bookmarks. `/` and `/**` redirect to `/my-day`.
**Warning signs:** Browser shows infinite redirect, console shows "Navigation ID X was not found."

### Pitfall 4: Login Component Default Return URL
**What goes wrong:** Login component has `private returnUrl = '/dashboard'` hardcoded. After route restructuring, this would redirect to the analytics page instead of My Day.
**Why it happens:** The login component stores the default redirect path, and `/dashboard` now means the org analytics dashboard.
**How to avoid:** Update `login.component.ts` line 46 from `'/dashboard'` to `'/my-day'`. Also update `two-factor.component.ts` line 202.

### Pitfall 5: Preview Sidebar Close on Navigation
**What goes wrong:** `AppComponent` has an effect that closes the preview sidebar on route changes. If the My Day page uses the preview sidebar, navigating within My Day (e.g., after a quick action) could prematurely close previews.
**Why it happens:** `closePreviewOnNav` effect tracks `currentUrl()` changes.
**How to avoid:** This is actually correct behavior -- preview should close on route changes. Quick actions should NOT trigger route changes. The slide-in panel operates via CDK Overlay (not route navigation), so this won't conflict.

### Pitfall 6: RecentlyViewedEntity Without Migration
**What goes wrong:** Adding a new entity for recently viewed records requires an EF Core migration.
**Why it happens:** The `RecentlyViewedEntity` table doesn't exist yet -- no `DbSet` or configuration.
**How to avoid:** Create entity, add DbSet to `ApplicationDbContext`, add migration. Include tenant scoping (TenantId + global query filter).

### Pitfall 7: Overdue Date Calculation Timezone Issues
**What goes wrong:** Comparing `DueDate` against "today" in UTC can produce incorrect overdue status for users in different timezones.
**Why it happens:** Activities store `DueDate` as `DateTimeOffset` in UTC. "Today" varies by user timezone.
**How to avoid:** For v1, compare against UTC today (consistent with existing activity list behavior). Timezone-aware comparison would require user timezone from org settings -- a future enhancement.

## Code Examples

### Backend: MyDay Aggregation DTO Shape
```csharp
// Source: Derived from existing summary endpoint patterns (CompaniesController, DealsController)
public record MyDayDto
{
    // Greeting stats
    public int TasksTodayCount { get; init; }
    public int OverdueCount { get; init; }
    public int UpcomingMeetingsCount { get; init; }

    // Tasks widget (full-width hero)
    public List<MyDayTaskDto> Tasks { get; init; } = [];

    // Upcoming events widget
    public List<MyDayEventDto> UpcomingEvents { get; init; } = [];

    // Pipeline summary widget
    public List<MyDayPipelineStageDto> PipelineStages { get; init; } = [];
    public decimal PipelineTotalValue { get; init; }
    public int PipelineDealCount { get; init; }

    // Email summary widget
    public int UnreadEmailCount { get; init; }
    public List<MyDayEmailDto> RecentEmails { get; init; } = [];

    // Feed preview widget
    public List<MyDayFeedItemDto> RecentFeedItems { get; init; } = [];

    // Notification digest widget
    public List<MyDayNotificationGroupDto> NotificationGroups { get; init; } = [];
    public int TodayNotificationCount { get; init; }

    // Recent records widget
    public List<MyDayRecentRecordDto> RecentRecords { get; init; } = [];
}

public record MyDayTaskDto
{
    public Guid Id { get; init; }
    public string Subject { get; init; } = "";
    public string Type { get; init; } = "";
    public string Status { get; init; } = "";
    public string Priority { get; init; } = "";
    public DateTimeOffset? DueDate { get; init; }
    public bool IsOverdue { get; init; }
    public int DaysOverdue { get; init; }
    public string? LinkedEntityType { get; init; }
    public Guid? LinkedEntityId { get; init; }
    public string? LinkedEntityName { get; init; }
}

public record MyDayEventDto
{
    public Guid Id { get; init; }
    public string Subject { get; init; } = "";
    public string Type { get; init; } = "";
    public DateTimeOffset? DueDate { get; init; }
    public string? AssignedToName { get; init; }
}

public record MyDayPipelineStageDto
{
    public string StageName { get; init; } = "";
    public string Color { get; init; } = "";
    public int DealCount { get; init; }
    public decimal TotalValue { get; init; }
}

public record MyDayEmailDto
{
    public Guid Id { get; init; }
    public string Subject { get; init; } = "";
    public string FromName { get; init; } = "";
    public DateTimeOffset SentAt { get; init; }
    public bool IsInbound { get; init; }
    public bool IsRead { get; init; }
}

public record MyDayFeedItemDto
{
    public Guid Id { get; init; }
    public string Type { get; init; } = "";
    public string Content { get; init; } = "";
    public string? EntityType { get; init; }
    public Guid? EntityId { get; init; }
    public string? EntityName { get; init; }
    public string AuthorName { get; init; } = "";
    public DateTimeOffset CreatedAt { get; init; }
}

public record MyDayNotificationGroupDto
{
    public string Type { get; init; } = "";
    public int Count { get; init; }
    public List<MyDayNotificationDto> Items { get; init; } = [];
}

public record MyDayNotificationDto
{
    public Guid Id { get; init; }
    public string Title { get; init; } = "";
    public string Message { get; init; } = "";
    public string? EntityType { get; init; }
    public Guid? EntityId { get; init; }
    public bool IsRead { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
}

public record MyDayRecentRecordDto
{
    public string EntityType { get; init; } = "";
    public Guid EntityId { get; init; }
    public string EntityName { get; init; } = "";
    public DateTimeOffset ViewedAt { get; init; }
}
```

### Frontend: CSS Grid Layout for My Day
```scss
// Source: Derived from existing dashboard layout patterns
.my-day {
  max-width: 1120px;
  margin: 0 auto;
  padding: 0 var(--space-6) var(--space-6);
}

.my-day__grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-4);
}

// Full-width items span all 3 columns
.my-day__widget--full {
  grid-column: 1 / -1;
}

// Responsive: stack to 2 columns on tablet, 1 on mobile
@media (max-width: 1024px) {
  .my-day__grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .my-day__widget--full {
    grid-column: 1 / -1;
  }
}

@media (max-width: 768px) {
  .my-day__grid {
    grid-template-columns: 1fr;
  }
}
```

### Frontend: Route Restructuring
```typescript
// Source: Derived from existing app.routes.ts patterns
export const routes: Routes = [
  // ... auth, onboarding, settings, etc. unchanged ...
  {
    path: 'my-day',
    canActivate: [authGuard],
    loadChildren: () =>
      import('./features/my-day/my-day.routes').then(m => m.MY_DAY_ROUTES),
  },
  {
    path: 'analytics',
    canActivate: [authGuard],
    loadChildren: () =>
      import('./features/dashboard/dashboard.routes').then(m => m.DASHBOARD_ROUTES),
  },
  // Backward compatibility redirects
  { path: 'dashboard', redirectTo: 'analytics', pathMatch: 'full' },
  // Default landing page
  { path: '', redirectTo: 'my-day', pathMatch: 'full' },
  { path: '**', redirectTo: 'my-day' },
];
```

### Frontend: MyDay Store Pattern
```typescript
// Source: Derived from existing DashboardStore pattern
interface MyDayState {
  data: MyDayDto | null;
  isLoading: boolean;
  error: string | null;
  completingTaskIds: Set<string>; // Track in-flight task completions
  highlightedItemId: string | null; // For pulse animation after quick action
}

export const MyDayStore = signalStore(
  withState(initialState),
  withComputed((store) => ({
    todayTasks: computed(() => store.data()?.tasks.filter(t => !t.isOverdue) ?? []),
    overdueTasks: computed(() => store.data()?.tasks.filter(t => t.isOverdue) ?? []),
    greetingStats: computed(() => ({
      tasksToday: store.data()?.tasksTodayCount ?? 0,
      overdue: store.data()?.overdueCount ?? 0,
      meetings: store.data()?.upcomingMeetingsCount ?? 0,
    })),
  })),
  withMethods((store) => {
    const api = inject(MyDayService);
    const activityService = inject(ActivityService);
    return {
      loadMyDay(): void { /* GET /api/my-day */ },
      completeTask(id: string): void { /* optimistic update + PATCH */ },
      setHighlight(id: string): void { /* for pulse animation */ },
    };
  }),
);
```

### Backend: RecentlyViewedEntity
```csharp
// Source: New entity following existing entity patterns (Notification, FeedItem)
public class RecentlyViewedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid UserId { get; set; }
    public string EntityType { get; set; } = string.Empty; // "Contact", "Deal", etc.
    public Guid EntityId { get; set; }
    public string EntityName { get; set; } = string.Empty; // Denormalized for display
    public DateTimeOffset ViewedAt { get; set; } = DateTimeOffset.UtcNow;

    // Navigation
    public ApplicationUser? User { get; set; }
}
```

## Discretion Recommendations

### Overdue Items Grouping: Separate Section (Recommended)
**Recommendation:** Show overdue tasks in a visually distinct section ABOVE today's tasks, with a red accent border. This creates urgency hierarchy: overdue items demand attention first, then today's tasks below.
**Rationale:** Mixing overdue and today tasks with sort-order alone loses the visual urgency signal. A separate section with red styling makes overdue items impossible to miss.

### Task/Item Count Limits Per Widget
| Widget | Recommended Limit | Rationale |
|--------|------------------|-----------|
| Tasks (full-width) | 10 overdue + 10 today | Full-width hero has room; 20 total covers most users |
| Upcoming Events | 8 | Today + 2 days at ~3/day |
| Pipeline Summary | All stages (typically 5-7) | Need complete pipeline view |
| Email Summary | 5 recent emails | Compact half-width card |
| Feed Preview | 5 items | Matches requirement spec |
| Notification Digest | 3 per group, 5 groups max | Grouped format is already compact |
| Recent Records | 8 | Matches requirement spec (5-8) |

### Pipeline Summary Visualization: Horizontal Stacked Bar (Recommended)
**Recommendation:** Use a horizontal stacked bar chart showing deal count per stage, with stage colors. Below the bar, show total value and deal count as text. This fits best in a compact half-width card.
**Rationale:** A donut chart works for 2-3 segments but gets cluttered with 5-7 pipeline stages. A horizontal stacked bar is more readable at compact sizes and shows progression left-to-right (matching pipeline flow). The existing codebase uses CSS `conic-gradient` donut charts in summary tabs, but the half-width constraint makes a stacked bar better.
**Alternative considered:** Numbers-only layout (stage name + count + value table). This works but lacks visual impact.

### Slide-In Panel Width: 520px (Recommended)
**Recommendation:** 520px panel width. Wider than the 480px preview sidebar to accommodate form fields, but narrow enough to keep dashboard context visible.
**Rationale:** Form components in `dialogMode` use a max-width of 900px, but in the constrained panel they'll adapt. 520px gives enough room for 2-column form fields while keeping ~600px of dashboard visible on a 1120px max-width layout.

### Upcoming Events Day Grouping: Day Headers (Recommended)
**Recommendation:** Use day section headers ("Today", "Tomorrow", "Thu, Feb 22") with events listed below each header.
**Rationale:** Day headers create natural grouping that's easy to scan. A timeline visual (vertical line with dots) adds complexity without much benefit for 2-3 days of data.

### Loading Skeleton Design: Per-Widget Shimmer Cards (Recommended)
**Recommendation:** Show the full grid layout immediately with shimmer placeholder cards in each widget position. The greeting banner loads first (no API call needed -- just user name from AuthStore), then widget skeletons animate until API data arrives.
**Rationale:** Showing the layout structure immediately reduces perceived load time. The existing dashboard uses shimmer skeletons -- reuse the same `@keyframes shimmer` pattern.

### Two-Tier Loading Strategy
**Recommendation:**
- **Tier 1 (instant, no API):** Greeting banner (name from AuthStore, time from `Date`), quick actions bar, grid skeleton layout
- **Tier 2 (single API call):** All widget data from `GET /api/my-day` populates all cards at once
**Rationale:** A single API call simplifies error handling and ensures consistent data snapshots. The backend assembles all data sequentially (EF Core constraint), so it's effectively atomic. Individual widget loading states would add complexity without benefit since all data arrives together.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| MatDialog for quick actions | CDK Overlay slide-in panels | This phase | More integrated UX, dashboard context preserved |
| Org dashboard as landing page | Personal My Day as landing | This phase | User-centric daily workflow focus |
| No recent records tracking | RecentlyViewedEntity table | This phase | Enables personalized "Recent Records" widget |
| `/dashboard` = org metrics | `/analytics` = org metrics, `/my-day` = personal | This phase | Clear separation of personal vs org views |

## Open Questions

1. **RecentlyViewedEntity: Where to track views?**
   - What we know: Need to record entity views when user visits detail pages. Backend controllers for each entity type would need a tracking call.
   - What's unclear: Should tracking happen in the frontend (API call on detail page load) or backend (middleware/interceptor on GET /{id} endpoints)?
   - Recommendation: Add a lightweight `POST /api/my-day/track-view` endpoint called from each detail page's `ngOnInit`. This keeps tracking decoupled from entity controllers and allows the frontend to batch or debounce if needed. The call should be fire-and-forget (no loading state, no error handling -- silent fail).

2. **Slide-in panel and preview sidebar coexistence**
   - What we know: The preview sidebar uses `mat-sidenav` position="end" in `AppComponent`. The slide-in panel needs to also appear on the right.
   - What's unclear: Can both be open simultaneously? What happens if user opens a preview while a slide-in panel is open?
   - Recommendation: Close the slide-in panel when preview sidebar opens, and vice versa. They serve different purposes and shouldn't overlap. The `SlideInPanelService` should subscribe to `PreviewSidebarStore.isOpen()` and auto-close.

3. **Email summary for users without connected email accounts**
   - What we know: Email integration requires Gmail OAuth connection. Not all users will have this set up.
   - What's unclear: Should the email widget show "Connect your email" CTA, or just show an empty state?
   - Recommendation: Show a friendly empty state with "Connect your email to see messages here" + link to email account settings. Check `EmailAccountStatusDto.connected` to determine which state to show.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `globcrm-web/src/app/app.routes.ts` -- current routing structure
- Codebase analysis: `globcrm-web/src/app/features/dashboard/` -- existing org dashboard patterns
- Codebase analysis: `globcrm-web/src/app/shared/stores/preview-sidebar.store.ts` -- signal store + mat-sidenav pattern
- Codebase analysis: `globcrm-web/src/app/shared/components/entity-form-dialog/` -- form reuse in dialog mode
- Codebase analysis: `src/GlobCRM.Api/Controllers/CompaniesController.cs` (GetSummary) -- aggregation endpoint pattern
- Codebase analysis: `globcrm-web/src/app/features/auth/pages/login/login.component.ts` -- login redirect handling
- Codebase analysis: `globcrm-web/src/app/shared/components/navbar/navbar.component.ts` -- sidebar navigation items
- Codebase analysis: `globcrm-web/src/app/shared/services/entity-type-registry.ts` -- entity routing/display metadata

### Secondary (MEDIUM confidence)
- Angular CDK Overlay documentation -- position strategies, backdrop, focus trap
- Angular Material Sidenav documentation -- mat-sidenav nesting constraints

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- zero new packages, all existing libraries
- Architecture: HIGH -- all patterns exist in codebase, verified by reading actual code
- Pitfalls: HIGH -- pitfalls drawn from actual codebase constraints (EF Core, enum conversions, route structure)
- Backend aggregation: HIGH -- follows exact same pattern as Phase 23 summary endpoints
- Slide-in panels: MEDIUM -- CDK Overlay approach is standard Angular but not yet used in this codebase for panels
- RecentlyViewedEntity: MEDIUM -- new entity/table requires migration and tracking integration

**Research date:** 2026-02-20
**Valid until:** 2026-03-20 (stable -- no external dependencies, all codebase-internal patterns)

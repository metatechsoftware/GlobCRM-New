# Phase 25: Preview Sidebar Polish + Cross-Feature Integration - Research

**Researched:** 2026-02-20
**Domain:** Angular 19 frontend (CDK Overlay, gesture handling, global search integration, user profile preview, responsive design)
**Confidence:** HIGH

## Summary

Phase 25 transforms the existing preview sidebar from a read-only entity viewer into a power-user tool with four distinct enhancements: quick actions inside the sidebar (PREVIEW-10), search-to-preview integration (PREVIEW-09), user profile previews from feed author names (PREVIEW-11), and mobile-responsive full-width behavior with swipe-to-close (PREVIEW-08).

The codebase is well-prepared for all four requirements. The slide-in panel infrastructure from Phase 24 (`SlideInPanelService` with CDK Overlay) is already root-provided and designed for reuse. The preview sidebar (`PreviewSidebarStore`, `EntityPreviewSidebarComponent`) has a clean signal-based architecture with a navigation stack. The global search (`GlobalSearchComponent`) already has keyboard navigation and result selection -- it just navigates to the detail page instead of opening preview. The feed list already has author names rendered as plain text that can be made clickable. The `TeamDirectoryController` backend already provides `GET /api/team-directory/{userId}` returning rich profile data including name, email, phone, role, avatar, department, and job title.

**Primary recommendation:** Implement as four independent work streams mapping 1:1 to requirements. Each can be done incrementally. The slide-in panel mutual exclusion with preview sidebar needs careful handling since quick actions FROM the sidebar need to NOT close the sidebar.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Quick actions open via CDK Overlay slide-in panel (reuse Phase 24 infrastructure), not Material dialog
- After performing a quick action, sidebar stays open and refreshes its data to reflect the change (e.g., new note appears in mini-timeline)
- Action set per entity type and placement within the sidebar are Claude's discretion
- User profile preview is activity-aware: show avatar, name, role, email, phone PLUS recent activity stats (deals assigned, tasks completed today, last active)
- Clicking email in profile preview opens compose flow
- No other actions needed for user preview -- view-only beyond email link
- Whether user preview opens in same sidebar or lighter popover, and which entry points trigger it, are Claude's discretion
- Preview-first defaults: click/Enter on a search result opens preview sidebar; Ctrl/Cmd+click navigates to detail page
- When search is focused with no query, show recently previewed entities for quick re-access
- Trigger mechanism (icon button vs keyboard) and search dropdown behavior when preview opens are Claude's discretion
- Full-width sidebar on mobile (< 768px) with swipe-right-to-close gesture plus X button fallback
- Mobile layout adaptation (content density), auto-close on route navigation, and transition animation are Claude's discretion

### Claude's Discretion
- Quick action button placement in sidebar (top vs bottom vs floating)
- Which quick actions appear per entity type (contextual filtering)
- User preview container: same sidebar panel vs lighter popover
- User preview trigger scope: feed authors only vs also owner/assignee fields
- Search-to-preview trigger UX (icon button, keyboard shortcut, or hover)
- Search dropdown open/close state when preview opens
- Mobile content density adjustments
- Auto-close behavior on route navigation
- Mobile transition animation style
- Performance index selection for preview/summary/my-day queries

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PREVIEW-08 | Preview sidebar displays full-width on mobile screens (< 768px) | AppComponent already has `isMobile` signal using `BreakpointObserver('(max-width: 768px)')`. The `.preview-drawer` class needs a conditional width override. Touch events (touchstart/touchmove/touchend) can implement swipe-right-to-close without any library (no HammerJS needed). Route-change close already exists via `closePreviewOnNav` effect in AppComponent. |
| PREVIEW-09 | User can open entity preview from global search results | `GlobalSearchComponent.selectResult()` currently calls `router.navigateByUrl(hit.url)`. Needs to call `PreviewSidebarStore.open()` as default, with Ctrl/Cmd+click for navigation. SearchHit already has `entityType` and `id` fields. "Recently previewed" requires a client-side localStorage list (similar to existing `RecentSearchesService` pattern). |
| PREVIEW-10 | User can perform quick actions from the preview sidebar | `SlideInPanelService` is root-provided and reusable. CRITICAL: Its constructor has an effect that closes the slide-in when preview sidebar opens, and its `open()` method closes the preview sidebar. This mutual exclusion must be relaxed when quick actions are triggered FROM the sidebar context. The `QuickActionBarComponent` already exists with the right UI pattern. |
| PREVIEW-11 | User can click author names in feed to preview user profiles | Feed list renders `item.authorName` as plain text (`<span class="feed-author-name">`). Backend `GET /api/team-directory/{userId}` returns full profile. Need new "user preview" component and a new backend endpoint for activity stats (deals assigned, tasks completed today, last active). Feed model already has `authorId` field. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @angular/cdk | ^19.2.19 | Overlay for slide-in panel, BreakpointObserver for responsive | Already installed, used by slide-in panel and mobile detection |
| @angular/material | ^19.2.19 | Buttons, icons, tabs, tooltips in sidebar | Already installed, used throughout |
| @ngrx/signals | (installed) | PreviewSidebarStore signal store | Already the state management pattern |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Native Touch Events API | Built-in | Swipe-right-to-close gesture detection | For mobile PREVIEW-08, no library needed |
| localStorage | Built-in | Recently previewed entities persistence | For PREVIEW-09 empty search state |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native touch events | HammerJS | HammerJS adds 30KB+ for a single gesture; native touch events are sufficient for swipe detection |
| CDK Overlay popover for user preview | MatDialog / separate sidebar | CDK Overlay is consistent with Phase 24 pattern and provides positioning flexibility |
| Server-side recently-previewed | Client-side localStorage | Server-side adds endpoint complexity; client-side is sufficient for this use case and mirrors RecentSearchesService pattern |

**Installation:**
No new packages needed. All dependencies are already installed.

## Architecture Patterns

### Recommended Project Structure
```
globcrm-web/src/app/
├── shared/
│   ├── components/
│   │   ├── entity-preview-sidebar/
│   │   │   ├── entity-preview-sidebar.component.ts  (MODIFY: add quick action bar)
│   │   │   ├── entity-preview-sidebar.component.html (MODIFY: add quick actions + mobile class)
│   │   │   └── entity-preview-sidebar.component.scss (MODIFY: mobile responsive)
│   │   ├── entity-preview/
│   │   │   └── ... (existing entity-type preview components, no changes)
│   │   ├── global-search/
│   │   │   ├── global-search.component.ts (MODIFY: preview-first + recently previewed)
│   │   │   ├── recent-previews.service.ts (NEW: localStorage for recently previewed entities)
│   │   │   └── search.models.ts (no change)
│   │   └── user-preview/
│   │       └── user-preview-popover.component.ts (NEW: user profile preview popover)
│   ├── stores/
│   │   └── preview-sidebar.store.ts (MODIFY: add refreshCurrent method)
│   └── services/
│       └── entity-type-registry.ts (no change)
├── features/
│   ├── feed/
│   │   └── feed-list/
│   │       └── feed-list.component.ts (MODIFY: make author names clickable)
│   └── my-day/
│       └── slide-in-panel/
│           ├── slide-in-panel.service.ts (MODIFY: add context-aware mutual exclusion)
│           └── slide-in-panel.models.ts (MODIFY: add SlideInContext)
├── app.component.ts (MODIFY: mobile-responsive preview drawer)
src/
└── GlobCRM.Api/Controllers/
    └── TeamDirectoryController.cs (MODIFY: add user activity stats endpoint)
```

### Pattern 1: Contextual Slide-In from Preview Sidebar
**What:** When quick actions are triggered from within the preview sidebar, the slide-in panel opens ON TOP of the sidebar rather than closing it.
**When to use:** PREVIEW-10 quick actions
**Current problem:** `SlideInPanelService.open()` calls `previewSidebarStore.close()` on line 49-51 (mutual exclusion). The constructor effect on line 35-40 also closes the slide-in when preview opens.

**Solution approach:**
```typescript
// slide-in-panel.models.ts -- add context
export interface SlideInConfig {
  entityType: SlideInEntityType;
  title?: string;
  followUpSteps?: FollowUpStep[];
  context?: 'standalone' | 'preview-sidebar'; // NEW
  parentEntityType?: string; // NEW: for associating notes/activities with previewed entity
  parentEntityId?: string;   // NEW
}

// slide-in-panel.service.ts -- conditional mutual exclusion
open(config: SlideInConfig): SlideInPanelRef {
  // Only close preview sidebar if NOT opening from preview context
  if (config.context !== 'preview-sidebar' && this.previewSidebarStore.isOpen()) {
    this.previewSidebarStore.close();
  }
  // ... rest unchanged
}
```

After the slide-in closes with a result, the preview sidebar refreshes its data via a new `refreshCurrent()` method on `PreviewSidebarStore` that re-fetches the current entity without resetting the stack.

### Pattern 2: Preview-First Search
**What:** Global search results default to opening the preview sidebar instead of navigating.
**When to use:** PREVIEW-09

**Current flow:** `selectResult(hit) -> router.navigateByUrl(hit.url)`
**New flow:** `selectResult(hit, event) -> previewStore.open({entityType, entityId}) + record in recently-previewed`
**Ctrl/Cmd+click:** `router.navigateByUrl(hit.url)` (existing detail page navigation)

```typescript
// global-search.component.ts
selectResult(hit: SearchHit, event?: MouseEvent): void {
  const term = this.searchTerm();
  if (term.trim()) {
    this.recentSearchesService.addRecent(term.trim());
  }
  this.close();

  if (event?.ctrlKey || event?.metaKey) {
    // Ctrl/Cmd+click: navigate to detail page (existing behavior)
    this.router.navigateByUrl(hit.url);
  } else {
    // Default: open preview sidebar
    this.recentPreviewsService.addRecent({ entityType: hit.entityType, entityId: hit.id, entityName: hit.title });
    this.previewStore.open({ entityType: hit.entityType, entityId: hit.id, entityName: hit.title });
  }
}
```

### Pattern 3: Recently Previewed Entities (Client-Side)
**What:** When search input is focused with empty query, show recently previewed entities instead of recent search terms.
**When to use:** PREVIEW-09 empty search state

```typescript
// recent-previews.service.ts -- mirrors RecentSearchesService pattern
const STORAGE_KEY = 'globcrm_recent_previews';
const MAX_ITEMS = 8;

export interface RecentPreviewEntry {
  entityType: string;
  entityId: string;
  entityName: string;
  previewedAt: number; // timestamp
}

@Injectable({ providedIn: 'root' })
export class RecentPreviewsService {
  getRecent(): RecentPreviewEntry[] { ... }
  addRecent(entry: Omit<RecentPreviewEntry, 'previewedAt'>): void { ... }
  clearRecent(): void { ... }
}
```

The global search component shows these in the dropdown when focused with no query, alongside (or replacing) the recent search terms.

### Pattern 4: User Profile Preview Popover
**What:** A lightweight CDK Overlay popover showing user profile info + activity stats.
**When to use:** PREVIEW-11 author name clicks in feed, and optionally owner/assignee fields

**Recommendation for discretion area -- same sidebar vs popover:** Use a **CDK Overlay popover** (not the same sidebar panel). Rationale:
1. Users are not entity records -- they don't fit the entity preview paradigm with tabs/associations
2. A popover is lighter-weight and doesn't disrupt the sidebar navigation stack
3. The popover anchors to the click target (author name), providing spatial context
4. Closing the popover doesn't affect any open entity preview

```typescript
@Component({
  selector: 'app-user-preview-popover',
  template: `
    <div class="user-preview">
      <div class="user-preview__header">
        <app-avatar [avatarUrl]="profile()?.avatarUrl" ... size="lg" />
        <div>
          <h4>{{ profile()?.firstName }} {{ profile()?.lastName }}</h4>
          <span>{{ profile()?.jobTitle }}</span>
        </div>
      </div>
      <div class="user-preview__contact">
        <a (click)="onEmailClick()">{{ profile()?.email }}</a>
        <span>{{ profile()?.phone }}</span>
      </div>
      <div class="user-preview__stats">
        <div>{{ stats()?.dealsAssigned }} deals</div>
        <div>{{ stats()?.tasksCompletedToday }} tasks today</div>
        <div>Last active {{ stats()?.lastActive | relativeTime }}</div>
      </div>
    </div>
  `
})
```

**Recommendation for trigger scope:** Extend beyond just feed authors to also include owner names and assignee names in the entity preview sidebar. This provides a consistent "click any user name to see their profile" experience. The `PreviewEntityLinkComponent` pattern already shows how click handlers work in these contexts.

### Pattern 5: Swipe-Right-to-Close (Native Touch Events)
**What:** Detect right-swipe gesture to close the preview sidebar on mobile.
**When to use:** PREVIEW-08 mobile

```typescript
// In entity-preview-sidebar.component.ts or app.component.ts
private touchStartX = 0;
private touchStartY = 0;
private readonly SWIPE_THRESHOLD = 80; // px
private readonly SWIPE_MAX_Y_DRIFT = 50; // px

@HostListener('touchstart', ['$event'])
onTouchStart(event: TouchEvent): void {
  this.touchStartX = event.touches[0].clientX;
  this.touchStartY = event.touches[0].clientY;
}

@HostListener('touchend', ['$event'])
onTouchEnd(event: TouchEvent): void {
  const deltaX = event.changedTouches[0].clientX - this.touchStartX;
  const deltaY = Math.abs(event.changedTouches[0].clientY - this.touchStartY);

  if (deltaX > this.SWIPE_THRESHOLD && deltaY < this.SWIPE_MAX_Y_DRIFT) {
    this.store.close();
  }
}
```

### Pattern 6: Mobile Full-Width Preview
**What:** On mobile (< 768px), the preview drawer takes full width instead of 480px.
**When to use:** PREVIEW-08

The `AppComponent` already has `isMobile` signal. Conditionally apply a class:

```html
<mat-sidenav #previewDrawer
             position="end"
             mode="side"
             [opened]="previewStore.isOpen()"
             disableClose
             class="preview-drawer"
             [class.preview-drawer--mobile]="isMobile()">
```

```scss
.preview-drawer--mobile {
  width: 100vw !important;
}
```

### Anti-Patterns to Avoid
- **Don't break the navigation stack:** Quick actions in the sidebar should NOT push to the preview stack. They operate in a separate overlay layer.
- **Don't use HammerJS for a single gesture:** Native touch events are sufficient and avoid 30KB+ bundle cost.
- **Don't persist recently-previewed on the server:** This is a UI convenience feature -- localStorage is appropriate and avoids backend complexity.
- **Don't share the sidebar panel for user previews:** Users are not CRM entities. A popover is the right container.
- **Don't close the search dropdown on preview open:** The user may want to preview multiple results. Close the dropdown explicitly via keyboard (Escape) or clicking outside.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Swipe gesture detection | Complex gesture library | Native touchstart/touchmove/touchend | Only need one gesture direction; 15 lines of code vs 30KB library |
| Overlay positioning for user popover | Manual absolute positioning | CDK Overlay with FlexibleConnectedPositionStrategy | Handles viewport edge detection, scroll anchoring, repositioning |
| Mobile breakpoint detection | Manual window.innerWidth checks | `BreakpointObserver` (already used) | Observable-based, SSR-safe, debounced |
| Recently previewed persistence | Server-side API + database table | localStorage service (mirror `RecentSearchesService`) | Client-only feature, no multi-device sync needed |

**Key insight:** All overlay/positioning infrastructure already exists in the project via CDK. The only truly new patterns are the touch gesture handling and the user profile popover -- both are small, self-contained additions.

## Common Pitfalls

### Pitfall 1: SlideInPanelService Mutual Exclusion Race Condition
**What goes wrong:** Opening a quick action slide-in from the preview sidebar closes the preview sidebar (existing mutual exclusion code), making it impossible to refresh the sidebar after the action completes.
**Why it happens:** `SlideInPanelService.open()` unconditionally calls `previewSidebarStore.close()`. The constructor effect also closes slide-in when preview opens.
**How to avoid:** Add a `context` field to `SlideInConfig`. When `context === 'preview-sidebar'`, skip the mutual exclusion in `open()` and adjust the constructor effect to only trigger when NOT in preview context. Store the context in a signal so the effect can read it.
**Warning signs:** Preview sidebar disappears when clicking a quick action button.

### Pitfall 2: Search Result Click Handler Event Propagation
**What goes wrong:** Click on search result opens preview AND navigates (or vice versa with Ctrl+click).
**Why it happens:** The existing `(click)="selectResult(hit)"` binding doesn't pass the mouse event, so there's no way to check modifier keys.
**How to avoid:** Update the template to pass `$event`: `(click)="selectResult(hit, $event)"`. Also handle `(auxclick)` for middle-click navigation.
**Warning signs:** Ctrl+click opens preview instead of navigating; middle-click does nothing.

### Pitfall 3: Preview Sidebar Refresh After Quick Action Causes Loading Flash
**What goes wrong:** After a quick action completes, re-fetching preview data shows the loading skeleton, which feels jarring.
**Why it happens:** The `loadPreview()` method in `PreviewSidebarStore` sets `isLoading: true` and `currentData: null`.
**How to avoid:** Add a `refreshCurrent()` method that re-fetches WITHOUT clearing `currentData` or setting `isLoading`. This mirrors the "silent refreshData() skips isLoading" pattern already established in Phase 24 (STATE.md line 80).
**Warning signs:** Brief skeleton flash when a note is added from the sidebar.

### Pitfall 4: Mobile Full-Width Drawer Z-Index Conflicts
**What goes wrong:** On mobile, the full-width preview drawer doesn't cover the nav topbar, or the X button is hidden behind it.
**Why it happens:** `mat-sidenav` has its own z-index stacking. The mobile topbar is fixed at z-index above the sidenav container.
**How to avoid:** On mobile, the preview drawer needs a higher z-index or the topbar needs to be visually integrated. Since the topbar is already fixed with padding-top on content, the drawer should render below it (which is the current behavior). The X close button and swipe gesture handle closing.
**Warning signs:** Preview content clips under the topbar on mobile.

### Pitfall 5: Recently Previewed Deduplication and Stale Names
**What goes wrong:** Same entity appears multiple times in recently previewed, or entity names are outdated.
**Why it happens:** Not deduplicating by entityType+entityId when adding to the list.
**How to avoid:** On add, filter out any existing entry with same entityType+entityId before prepending. Update entityName on re-preview. Same pattern as `RecentSearchesService.addRecent()`.
**Warning signs:** Recently previewed list shows "Acme Corp" three times.

### Pitfall 6: User Activity Stats N+1 Query Performance
**What goes wrong:** The user profile preview endpoint is slow because it runs separate queries for deals assigned, tasks completed, and last active.
**Why it happens:** Each stat is a COUNT/MAX query against different tables.
**How to avoid:** Run all stat queries in parallel using `Task.WhenAll()` in the controller, or batch into a single raw SQL query with multiple CTEs.
**Warning signs:** User preview popover takes > 500ms to load.

## Code Examples

### Existing Pattern: SlideInPanelService Usage (from My Day)
```typescript
// Source: globcrm-web/src/app/features/my-day/my-day.component.ts
const panelRef = this.slideInPanelService.open({
  entityType,
  title,
  followUpSteps: followUpSteps.length > 0 ? followUpSteps : undefined,
});

panelRef.afterClosed.subscribe((result) => {
  if (result) {
    this.store.refreshData(); // silent refresh
    if (result.entity?.id) {
      this.store.setHighlight(result.entity.id);
    }
  }
});
```

### Existing Pattern: PreviewSidebarStore.open()
```typescript
// Source: globcrm-web/src/app/shared/stores/preview-sidebar.store.ts
open(entry: PreviewEntry): void {
  patchState(store, {
    isOpen: true,
    stack: [entry],
    isLoading: true,
    error: null,
    currentData: null,
  });
  loadPreview(entry);
}
```

### Existing Pattern: Feed Entity Link Click (preview-first)
```typescript
// Source: globcrm-web/src/app/features/feed/feed-list/feed-list.component.ts
onEntityClick(event: MouseEvent, item: FeedItemDto): void {
  event.stopPropagation();
  if (event.ctrlKey || event.metaKey) {
    const route = getEntityRoute(item.entityType, item.entityId);
    this.router.navigateByUrl(route);
    return;
  }
  this.previewStore.open({
    entityType: item.entityType,
    entityId: item.entityId,
    entityName: item.entityName ?? undefined,
  });
}
```

### Existing Pattern: RecentSearchesService (localStorage)
```typescript
// Source: globcrm-web/src/app/shared/components/global-search/recent-searches.service.ts
addRecent(term: string): void {
  const current = this.getRecent();
  const deduplicated = current.filter(t => t !== trimmed);
  const updated = [trimmed, ...deduplicated].slice(0, MAX_ITEMS);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}
```

### Existing Pattern: CDK Overlay Configuration (from SlideInPanelService)
```typescript
// Source: globcrm-web/src/app/features/my-day/slide-in-panel/slide-in-panel.service.ts
this.overlayRef = this.overlay.create({
  positionStrategy: this.overlay.position()
    .global()
    .right('0')
    .top('0')
    .bottom('0'),
  width: '520px',
  hasBackdrop: true,
  backdropClass: 'slide-in-backdrop',
  panelClass: ['slide-in-panel', 'slide-in-panel--animate-in'],
  scrollStrategy: this.overlay.scrollStrategies.block(),
});
```

### New Pattern: CDK Overlay for User Profile Popover
```typescript
// For user preview popover (PREVIEW-11)
// Use FlexibleConnectedPositionStrategy to anchor to click target
this.overlayRef = this.overlay.create({
  positionStrategy: this.overlay.position()
    .flexibleConnectedTo(elementRef)
    .withPositions([
      { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top' },
      { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom' },
    ]),
  width: '320px',
  hasBackdrop: true,
  backdropClass: 'cdk-overlay-transparent-backdrop',
  scrollStrategy: this.overlay.scrollStrategies.reposition(),
});
```

### Backend Pattern: User Activity Stats Endpoint
```csharp
// New endpoint on TeamDirectoryController
[HttpGet("{userId:guid}/activity-stats")]
public async Task<IActionResult> GetActivityStats(Guid userId, CancellationToken ct)
{
    var today = DateTimeOffset.UtcNow.Date;

    var dealsAssignedTask = _db.Deals
        .CountAsync(d => d.OwnerId == userId, ct);
    var tasksCompletedTodayTask = _db.Activities
        .CountAsync(a => a.AssignedToId == userId && a.IsDone && a.UpdatedAt >= today, ct);
    var lastActiveTask = _db.Set<FeedItem>()
        .Where(f => f.AuthorId == userId)
        .OrderByDescending(f => f.CreatedAt)
        .Select(f => (DateTimeOffset?)f.CreatedAt)
        .FirstOrDefaultAsync(ct);

    await Task.WhenAll(dealsAssignedTask, tasksCompletedTodayTask, lastActiveTask);

    return Ok(new {
        dealsAssigned = dealsAssignedTask.Result,
        tasksCompletedToday = tasksCompletedTodayTask.Result,
        lastActive = lastActiveTask.Result,
    });
}
```

## Discretion Recommendations

### Quick Action Placement: Top of Sidebar (Below Entity Name)
**Recommendation:** Place the `QuickActionBarComponent` directly below the entity name and owner info, above the tab group. This mirrors the summary tab pattern where the quick action bar is pinned at the top of content.
**Rationale:** Users see actions immediately without scrolling. The sidebar has limited vertical space, so floating/bottom placement risks obscuring content.

### Quick Actions Per Entity Type
**Recommendation:**
| Entity Type | Quick Actions |
|-------------|--------------|
| Contact | Add Note, Log Activity, Send Email |
| Company | Add Note, Log Activity |
| Deal | Add Note, Log Activity |
| Lead | Add Note, Log Activity, Send Email |
| Activity | Add Note |
| Product | (none -- read-only entity) |

This matches the `QuickActionBarComponent.showSendEmail` pattern already in the summary tabs, where email is only shown for Contact and Lead (entities with direct email addresses).

### User Preview: CDK Overlay Popover (Not Sidebar)
**Recommendation:** Lightweight CDK Overlay popover anchored to the clicked name.
**Rationale:** Users are fundamentally different from CRM entities. They don't have associations, pipeline stages, or notes tabs. A popover is spatially anchored, quicker to dismiss, and doesn't pollute the entity navigation stack.

### User Preview Trigger Scope: Feed Authors + Owner/Assignee Fields
**Recommendation:** Make ALL user names clickable for profile preview: feed author names, entity preview owner names, and any assignee fields shown in preview components.
**Rationale:** Consistency -- once users learn "click a name to see their profile," they expect it everywhere. The backend endpoint (`GET /api/team-directory/{userId}`) is already generic.

### Search-to-Preview: Close Dropdown on Preview Open
**Recommendation:** Close the search dropdown when a result is selected (preview opens). The user can re-open search with Ctrl+K if they want to preview another result.
**Rationale:** The preview sidebar pushes content, and an open dropdown over pushed content looks broken. The Ctrl+K shortcut provides fast re-access.

### Mobile: Auto-Close on Route Navigation (Already Done)
**Recommendation:** Keep the existing `closePreviewOnNav` effect in AppComponent. It already closes the preview sidebar on any route change, which handles the mobile case.
**Rationale:** Already implemented in Phase 22.

### Mobile Transition Animation
**Recommendation:** Use a left-to-right slide animation matching the existing slide-in panel pattern. Override the mat-sidenav transition on mobile to use `transform: translateX()` with a 250ms ease-out curve.

### Mobile Content Density
**Recommendation:** Slightly reduce padding in preview sections on mobile (16px to 12px) and reduce font sizes by one step. The content is already fairly compact; major restructuring is unnecessary.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| HammerJS for touch gestures | Native Touch Events API | Angular 18+ dropped HammerJS as optional dep | No bundle cost for simple gestures |
| MatSidenav for all overlays | CDK Overlay for positioned panels | Already established in Phase 24 | Better positioning control, no layout shift |
| Dialog-based entity creation | Slide-in panel entity creation | Phase 24 | Consistent with this phase's quick actions pattern |

**Deprecated/outdated:**
- HammerJS: Was the standard Angular gesture library, but Angular Material moved away from it. Native touch events are preferred for simple gestures.

## Open Questions

1. **Backend: FeedItem entity structure for lastActive query**
   - What we know: `FeedItem` has `AuthorId` and `CreatedAt` fields. The `FeedController` already queries feed items by author.
   - What's unclear: Whether the `FeedItem` table has an index on `(author_id, created_at DESC)` that would make the `lastActive` query efficient.
   - Recommendation: Check during implementation; add index if needed. The query only needs MAX(created_at) for a single user, so even a seq scan on filtered rows should be fast.

2. **SlideInPanelService location: Should it be moved to shared?**
   - What we know: It's currently in `features/my-day/slide-in-panel/` but is `providedIn: 'root'`.
   - What's unclear: Whether moving it to `shared/services/` would be cleaner now that it's used from both My Day and the preview sidebar.
   - Recommendation: Move to `shared/services/slide-in-panel/` as part of this phase. The service is already root-provided, so the import path change is the only breaking change. This is a cleanup task.

## Sources

### Primary (HIGH confidence)
- **Codebase analysis**: Direct reading of all relevant source files (preview sidebar, slide-in panel, global search, feed list, entity preview, app component, backend controllers)
- **Angular CDK Overlay**: Already used in project, API patterns verified from existing `SlideInPanelService` implementation
- **BreakpointObserver**: Already used in `AppComponent` and `NavbarComponent` for mobile detection

### Secondary (MEDIUM confidence)
- **Native Touch Events API**: Standard Web API, well-documented, no external dependency needed
- **localStorage**: Standard Web API used by existing `RecentSearchesService`

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- No new packages, all infrastructure exists
- Architecture: HIGH -- All patterns are extensions of existing Phase 22/24 work
- Pitfalls: HIGH -- Identified from direct code analysis (mutual exclusion, loading flash, event propagation)
- Backend: MEDIUM -- User activity stats endpoint needs implementation; the query patterns are straightforward but index needs may need validation

**Research date:** 2026-02-20
**Valid until:** 2026-03-20 (stable -- no external dependencies to go stale)

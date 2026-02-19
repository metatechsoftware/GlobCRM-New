# Phase 22: Shared Foundation + Entity Preview Sidebar - Research

**Researched:** 2026-02-20
**Domain:** Angular Material Sidenav/Drawer, preview endpoint design, tab index refactoring, EF Core migration, ngrx/signals store patterns
**Confidence:** HIGH

## Summary

Phase 22 introduces three major pieces: (1) cross-cutting infrastructure (EntityTypeRegistry, tab index refactor from index-based to label-based, entity_name denormalization on feed_items), (2) a backend preview endpoint with RBAC scope checking, and (3) a frontend EntityPreviewSidebar that slides in from the right when clicking entity links in the feed.

The existing codebase provides strong foundations for all three. Angular Material's `MatSidenavModule` (already used in `email-template-editor.component.ts`) provides the drawer primitive. The existing `RelatedEntityTabsComponent` emits tab indices via `(tabChanged)`, and all 6 detail pages that use tabs have hardcoded index-based logic in their `onTabChanged(index)` methods -- the refactor to label-based matching is straightforward. The backend's existing RBAC pattern (`IPermissionService.GetEffectivePermissionAsync` + `IsWithinScope`) is consistent across all entity controllers and should be reused directly for the preview endpoint. The FeedItem entity currently has `EntityType` (string) and `EntityId` (Guid?) but no `EntityName` -- adding this column requires an EF Core migration and backfill.

**Primary recommendation:** Use Angular Material `MatSidenavModule` with `mat-sidenav-container` in `AppComponent` for the push-content layout. Create a single `EntityPreviewController` with a generic `GET /api/entities/{type}/{id}/preview` endpoint that dispatches per-type to slim DTO projections, reusing the existing RBAC scope-checking pattern from each entity controller.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Sidebar width: ~480px
- Layout mode: Push content (feed compresses to make room, both visible side by side)
- Animation: Smooth ease ~350ms slide-in from right
- Custom fields: Show pinned custom fields only (requires a `show_in_preview` boolean flag on custom field definitions)
- Pipeline stage display: Mini stage progress bar for Deals and Leads (horizontal bar showing all stages with current highlighted)
- Owner display: Avatar + name shown for entity owner
- Entity name affordance: Styled as links with underline on hover
- Click behavior: Single click opens preview sidebar; Ctrl/Cmd+click navigates to full detail page
- Multi-click: Clicking a different entity replaces sidebar content with back navigation (breadcrumb/back button to return to previous preview)
- Hover tooltip: Small lightweight tooltip showing entity type icon + name (no API call, uses data already in the feed item)
- Navigation stack: Sidebar maintains a navigation stack (from feed clicks and association chip clicks)
- Back button returns to previous preview in the stack
- "Open full record" navigates to the full detail page and closes sidebar
- Escape key and clicking outside close the sidebar entirely (clears stack)
- Association chip click behavior: Opens nested preview of that entity (replaces sidebar content with back button to return)
- Recent activities: Mini vertical timeline with dots/lines connecting the last 3 activities (type icon, title, time)
- Activity section footer: "View all activities" link navigates to entity's full detail page activities tab

### Claude's Discretion
- Sidebar header layout (icon + name + badge vs full header card -- pick what fits best)
- Field selection per entity type (which key properties and how many)
- Association chip format (counts vs named -- pick based on available space)
- Loading skeleton design
- Exact spacing, typography, and section ordering within the preview
- Error state handling (deleted/not found entities)
- Tooltip implementation details

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PREVIEW-01 | User can click entity names in feed items to open a preview sidebar instead of navigating away | Feed entity link currently uses `navigateToEntity()` in `FeedListComponent` -- replace with sidebar open call. FeedItemDto already has `entityType` and `entityId`. |
| PREVIEW-02 | Preview sidebar slides in from the right (~480px) as push-content layout | User decision overrides original overlay spec. Use `MatSidenavModule` `mat-sidenav` with `mode="side"` and `position="end"` in `AppComponent`. |
| PREVIEW-03 | User sees key properties (name, status/stage, owner, primary info) for each entity type in preview | New backend preview endpoint returns per-entity-type slim DTOs. Field selection per entity type documented in Architecture Patterns. |
| PREVIEW-04 | User can click "Open full record" to navigate to the entity detail page from preview | EntityTypeRegistry provides route mapping per entity type. Sidebar close + router navigate. |
| PREVIEW-05 | User can close the preview sidebar by clicking outside or pressing Escape | `MatSidenav` supports `(keydown.escape)` and backdrop click via `autoFocus` + keyboard event handling. Push mode does not have a backdrop, so "click outside" means clicking the feed area. |
| PREVIEW-06 | User sees a loading skeleton while preview data is being fetched | Custom skeleton component with CSS animation. No library needed. |
| PREVIEW-07 | Feed scroll position is preserved when opening and closing the preview sidebar | Push-content layout preserves scroll position naturally since the feed component is not destroyed. The `mat-sidenav-content` wraps the router outlet. |
| PREVIEW-12 | Preview sidebar displays association chips (related records) linking to their detail pages | Backend preview DTO includes association summaries. Chip click opens nested preview (navigation stack). |
| PREVIEW-13 | Preview sidebar shows last 3 recent activities in condensed timeline | Backend preview endpoint includes `recentActivities` array (last 3). Reuse `EntityTimelineComponent` patterns for mini timeline. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @angular/material/sidenav | ^19.2.19 | MatSidenav for push-content drawer | Already in project, `MatSidenavModule` used in email-template-editor |
| @angular/cdk | ^19.2.19 | Overlay, keyboard, a11y utilities | Already in project, provides keyboard handling for Escape |
| @ngrx/signals | ^19.2.1 | PreviewSidebarStore (signal store) | Project standard for state management |
| @angular/animations | ^19.2.18 | Slide-in/out animation (350ms ease) | Already in project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @angular/material/tooltip | ^19.2.19 | Hover tooltip on entity links | Already available, `MatTooltipModule` used elsewhere |
| @angular/material/progress-bar | ^19.2.19 | Mini stage progress bar for deals/leads | Already available in Material |
| @angular/material/chips | ^19.2.19 | Association chips | Already used in detail pages |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| MatSidenav (push mode) | CDK Portal + custom sidebar | MatSidenav handles push layout, animation, and accessibility natively. No reason to hand-roll. |
| Navigation stack in store | Router auxiliary routes | Stack approach is simpler for preview-within-preview. Router aux routes add URL complexity for a transient UI element. |

**Installation:**
No new packages needed. All dependencies are already installed.

## Architecture Patterns

### Recommended Project Structure
```
globcrm-web/src/app/
  shared/
    components/
      entity-preview-sidebar/
        entity-preview-sidebar.component.ts    # Shell: mat-sidenav, header, back nav, close button
        entity-preview-sidebar.component.html
        entity-preview-sidebar.component.scss
        preview-skeleton.component.ts           # Loading skeleton
      entity-preview/
        contact-preview.component.ts            # Per-type field template
        company-preview.component.ts
        deal-preview.component.ts
        lead-preview.component.ts
        activity-preview.component.ts
        product-preview.component.ts
    services/
      entity-type-registry.ts                   # EntityTypeRegistry (icon, route, label per type)
      entity-preview.service.ts                 # API calls to preview endpoint
    stores/
      preview-sidebar.store.ts                  # PreviewSidebarStore (root-level signal store)
  app.component.ts                              # Add mat-sidenav-container wrapping router-outlet

src/GlobCRM.Api/Controllers/
  EntityPreviewController.cs                    # GET /api/entities/{type}/{id}/preview

src/GlobCRM.Domain/Entities/
  FeedItem.cs                                   # Add EntityName property
  CustomFieldDefinition.cs                      # Add ShowInPreview property
```

### Pattern 1: Push-Content Sidebar with MatSidenav
**What:** Use `mat-sidenav-container` in AppComponent to wrap the router-outlet. The preview sidebar is a `mat-sidenav` with `position="end"`, `mode="side"`, and fixed width ~480px. When opened, it pushes the main content to the left.
**When to use:** For the entity preview sidebar on the feed page (and potentially other pages later).
**Example:**
```typescript
// app.component.ts - Template changes
@Component({
  template: `
    @if (showNavbar()) {
      <app-navbar />
    }
    <mat-sidenav-container class="app-sidenav-container">
      <mat-sidenav-content>
        <main class="app-content" ...>
          <router-outlet />
        </main>
      </mat-sidenav-content>
      <mat-sidenav #previewSidenav
                    position="end"
                    mode="side"
                    [opened]="previewStore.isOpen()"
                    class="preview-sidenav">
        <app-entity-preview-sidebar />
      </mat-sidenav>
    </mat-sidenav-container>
  `,
  imports: [..., MatSidenavModule, EntityPreviewSidebarComponent],
})
```

**Critical note on push layout:** `mat-sidenav` with `mode="side"` naturally pushes the `mat-sidenav-content`. The existing `margin-left` on `.app-content` for the nav sidebar must coexist with the sidenav container. This requires careful CSS layout -- the sidenav-container must NOT interfere with the existing left sidebar margin-left approach. Solution: the `mat-sidenav-container` wraps only the main content area (after the navbar has already applied `margin-left`), so the preview sidenav pushes within that content area.

### Pattern 2: PreviewSidebarStore (root-level signal store with navigation stack)
**What:** A `providedIn: 'root'` signal store that tracks the sidebar open/closed state, navigation stack, and current preview data.
**When to use:** All components that need to open/close the preview or read its state.
**Example:**
```typescript
// preview-sidebar.store.ts
interface PreviewEntry {
  entityType: string;
  entityId: string;
  entityName?: string;  // For display before data loads
}

interface PreviewSidebarState {
  isOpen: boolean;
  stack: PreviewEntry[];     // Navigation stack
  currentData: EntityPreviewDto | null;
  isLoading: boolean;
  error: string | null;
}

export const PreviewSidebarStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    currentEntry: computed(() => {
      const stack = store.stack();
      return stack.length > 0 ? stack[stack.length - 1] : null;
    }),
    canGoBack: computed(() => store.stack().length > 1),
  })),
  withMethods((store) => {
    const previewService = inject(EntityPreviewService);
    return {
      open(entry: PreviewEntry): void {
        patchState(store, {
          isOpen: true,
          stack: [entry],
          isLoading: true,
          error: null,
        });
        // Load preview data...
      },
      pushPreview(entry: PreviewEntry): void {
        patchState(store, {
          stack: [...store.stack(), entry],
          isLoading: true,
          error: null,
        });
        // Load preview data...
      },
      goBack(): void {
        const stack = store.stack();
        if (stack.length <= 1) return;
        patchState(store, {
          stack: stack.slice(0, -1),
          isLoading: true,
        });
        // Reload previous entry data...
      },
      close(): void {
        patchState(store, {
          isOpen: false,
          stack: [],
          currentData: null,
          error: null,
        });
      },
    };
  })
);
```

### Pattern 3: EntityTypeRegistry (centralized entity metadata)
**What:** A constant map that provides icon, label, route prefix, and color for each entity type string. Eliminates scattered switch/if chains across the codebase.
**When to use:** Anywhere entity type strings need to be mapped to display properties.
**Example:**
```typescript
// entity-type-registry.ts
export interface EntityTypeConfig {
  icon: string;         // Material icon name
  label: string;        // Display name (e.g., "Contact")
  labelPlural: string;  // Display name plural (e.g., "Contacts")
  routePrefix: string;  // Route path segment (e.g., "/contacts")
  color: string;        // CSS variable for entity type badge color
}

export const ENTITY_TYPE_REGISTRY: Record<string, EntityTypeConfig> = {
  Contact:  { icon: 'person',        label: 'Contact',  labelPlural: 'Contacts',  routePrefix: '/contacts',  color: 'var(--color-info)' },
  Company:  { icon: 'business',      label: 'Company',  labelPlural: 'Companies', routePrefix: '/companies', color: 'var(--color-secondary)' },
  Deal:     { icon: 'handshake',     label: 'Deal',     labelPlural: 'Deals',     routePrefix: '/deals',     color: 'var(--color-warning)' },
  Lead:     { icon: 'trending_up',   label: 'Lead',     labelPlural: 'Leads',     routePrefix: '/leads',     color: 'var(--color-success)' },
  Activity: { icon: 'task_alt',      label: 'Activity', labelPlural: 'Activities',routePrefix: '/activities',color: 'var(--color-accent)' },
  Product:  { icon: 'inventory_2',   label: 'Product',  labelPlural: 'Products',  routePrefix: '/products',  color: 'var(--color-primary)' },
};

export function getEntityConfig(entityType: string): EntityTypeConfig | null {
  return ENTITY_TYPE_REGISTRY[entityType] ?? null;
}
```

### Pattern 4: Tab Index Refactor (index-based to label-based)
**What:** Change `RelatedEntityTabsComponent` to emit the tab label string instead of (or in addition to) the index. Change all 6 detail pages to match on label instead of hardcoded indices.
**When to use:** All entity detail pages that use `RelatedEntityTabsComponent`.

**Current (fragile) pattern:**
```typescript
// contact-detail.component.ts
onTabChanged(index: number): void {
  if (index === 3) this.loadLinkedActivities();  // fragile!
  if (index === 4) this.loadLinkedQuotes();       // breaks if tabs reorder
}
```

**New (robust) pattern:**
```typescript
// RelatedEntityTabsComponent - emit label
onTabChange(index: number): void {
  const tab = this.tabs()[index];
  this.tabChanged.emit(tab?.label ?? '');  // emit label string
}

// contact-detail.component.ts
onTabChanged(label: string): void {
  if (label === 'Activities') this.loadLinkedActivities();
  if (label === 'Quotes') this.loadLinkedQuotes();
}
```

**Pages that need refactoring (5 that use RelatedEntityTabsComponent + 1 with direct MatTabs):**
1. `company-detail.component.ts` -- COMPANY_TABS, indices: 1 (Contacts), 3 (Activities), 4 (Quotes), 5 (Requests), 6 (Emails), 7 (Notes)
2. `contact-detail.component.ts` -- CONTACT_TABS, indices: 3 (Activities), 4 (Quotes), 5 (Requests), 6 (Emails), 7 (Notes)
3. `deal-detail.component.ts` -- DEAL_TABS, indices: 3 (Activities), 4 (Quotes), 6 (Notes)
4. `lead-detail.component.ts` -- dynamic computed tabs, indices: 1 (Activities), 2 (Notes)
5. `activity-detail.component.ts` -- uses `mat-tab-group` directly with `selectedTabIndex`, index: 6 (Notes). Needs separate handling.
6. **Product detail** -- no tabs, skip.

### Pattern 5: Backend Preview Endpoint with RBAC
**What:** A single `EntityPreviewController` with `GET /api/entities/{type}/{id}/preview` that resolves entity type, loads entity, checks RBAC scope, and returns a slim preview DTO.
**When to use:** All entity preview requests from the sidebar.

**Key pattern to follow from existing controllers:**
```csharp
// Existing scope-check pattern (from ContactsController.GetById)
var userId = GetCurrentUserId();
var permission = await _permissionService.GetEffectivePermissionAsync(userId, entityType, "View");
var teamMemberIds = await GetTeamMemberIds(userId, permission.Scope);
if (!IsWithinScope(entity.OwnerId, permission.Scope, userId, teamMemberIds))
    return Forbid();
```

**Preview DTO structure (polymorphic via discriminator):**
```csharp
public record EntityPreviewDto
{
    public Guid Id { get; init; }
    public string EntityType { get; init; }
    public string Name { get; init; }
    public string? OwnerName { get; init; }
    public string? OwnerAvatarUrl { get; init; }

    // Per-entity-type fields (flattened, nullable)
    public Dictionary<string, object?> Fields { get; init; }

    // Pinned custom fields
    public List<CustomFieldPreviewDto> PinnedCustomFields { get; init; }

    // Associations
    public List<AssociationChipDto> Associations { get; init; }

    // Pipeline stage info (deals/leads only)
    public PipelineStagePreviewDto? PipelineStage { get; init; }

    // Recent activities (last 3)
    public List<RecentActivityDto> RecentActivities { get; init; }
}
```

### Pattern 6: entity_name Denormalization on feed_items
**What:** Add `EntityName` (string, nullable) column to `feed_items` table. Populate on feed item creation. Used for hover tooltip display without extra API call.
**When to use:** All feed item creation points in controllers.

**Migration required:**
- Add `entity_name` column to `feed_items` table (nullable string, max 200)
- Add property to `FeedItem` entity
- Update `FeedItemConfiguration` with column mapping
- Add backfill migration to populate existing rows from their source entities
- Update `FeedItemDto` to include `EntityName`

**Feed item creation points that need updating (from codebase search):**
- `DealsController.cs` -- 5 places where `new FeedItem { EntityType = "Deal" ... }`
- `LeadsController.cs` -- 6 places where `new FeedItem { EntityType = "Lead" ... }`
- `ActivitiesController.cs` -- 5 places where `new FeedItem { EntityType = "Activity" ... }`
- `TenantSeeder.cs` -- seed data creation
- `GmailSyncService.cs` -- email sync feed items
- `DueDateNotificationService.cs` -- due date reminders

### Pattern 7: show_in_preview Flag on CustomFieldDefinition
**What:** Add `ShowInPreview` bool property (default false) to `CustomFieldDefinition`. Admin UI gets a toggle. Preview endpoint filters custom fields by this flag.
**When to use:** Custom field definitions that should appear in the preview sidebar.

**Migration required:**
- Add `show_in_preview` column to `custom_field_definitions` table (bool, default false)
- Add property to `CustomFieldDefinition` entity
- Update `CustomFieldDefinitionConfiguration`
- Update admin custom field edit endpoint to accept `ShowInPreview`
- Frontend: add toggle in custom field settings form

### Anti-Patterns to Avoid
- **Index-based tab matching across component boundaries:** The current pattern where parent components match `if (index === 3)` breaks silently when tabs are added/removed/reordered. Always match on label.
- **Loading full detail DTOs for preview:** The preview endpoint must return slim DTOs, not reuse existing detail endpoints. Detail DTOs include navigation properties, full comment lists, etc. that are wasteful for a preview.
- **Separate preview endpoints per entity type:** Don't create `/api/contacts/{id}/preview`, `/api/deals/{id}/preview`, etc. Use a single polymorphic endpoint to keep the frontend simple.
- **Storing navigation stack in URL:** The preview sidebar is transient UI. Don't pollute the browser URL with preview state. Use in-memory store only.
- **Blocking on preview load for tooltip:** Hover tooltip must use data already in the feed item (entityType + entityName from denormalized column). Never make an API call on hover.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Push-content drawer | Custom CSS sidebar with absolute positioning | `MatSidenav` with `mode="side"`, `position="end"` | Handles push layout, animation, keyboard focus trapping, accessibility natively |
| Tooltip on hover | Custom tooltip div with mouse event handlers | `MatTooltip` | Accessible, handles positioning, delay, and keyboard |
| Loading skeleton | Shimmer animation from scratch | CSS `@keyframes` on div placeholders | Simple enough that a library is overkill, but don't over-engineer. ~15 lines of CSS. |
| Stage progress bar | Complex SVG pipeline visualization | Simple flex row with colored segments | The mini progress bar is a simple horizontal flex row of stage dots/bars. No complex charting needed. |

**Key insight:** The project already has Angular Material installed with all needed modules. The push-content sidebar, tooltips, and chips are all standard Material components. The only custom work is the per-entity preview templates and the navigation stack store.

## Common Pitfalls

### Pitfall 1: mat-sidenav-container vs existing sidebar layout conflict
**What goes wrong:** Wrapping the entire app in `mat-sidenav-container` breaks the existing left navigation sidebar (which uses fixed positioning + margin-left on `.app-content`).
**Why it happens:** `mat-sidenav-container` creates a flex layout that can conflict with the existing `margin-left`-based sidebar.
**How to avoid:** Place the `mat-sidenav-container` INSIDE the `.app-content` area (after the nav sidebar's margin is already applied), or only wrap the main content area. The preview sidenav pushes content within the already-offset content area.
**Warning signs:** Left navigation sidebar overlapping or disappearing, content area sizing incorrectly.

### Pitfall 2: Scroll position reset on sidebar open/close
**What goes wrong:** Opening the sidebar causes the feed page to scroll to top.
**Why it happens:** If the sidebar open/close causes component re-render or DOM restructuring, scroll position can be lost.
**How to avoid:** Use `mode="side"` (not `mode="over"` or `mode="push"`) -- `side` mode keeps the content in the same DOM position and just adjusts width. The `mat-sidenav-content` element maintains its own scroll position.
**Warning signs:** Feed jumps to top when opening/closing preview.

### Pitfall 3: Tab index refactor breaking lazy loading
**What goes wrong:** Changing `tabChanged` output type from `number` to `string` breaks all existing consumers at once, and if any consumer is missed, lazy tab loading silently stops working.
**Why it happens:** The refactor touches 5+ files and the output type change is a breaking API change.
**How to avoid:** Approach options:
  - **Option A (recommended):** Change `tabChanged` to emit the label string. Update all consumers in the same commit. TypeScript will catch type mismatches.
  - **Option B:** Add a second output `tabLabelChanged` alongside `tabChanged`. Migrate consumers incrementally. Remove `tabChanged` later.
  - Option A is cleaner since we're doing it all in one phase.
**Warning signs:** Tab content not loading when clicked, no errors in console (silent failure).

### Pitfall 4: RBAC scope check missing for preview endpoint
**What goes wrong:** Preview endpoint returns entity data that the user shouldn't have access to based on their permission scope (Own/Team/All).
**Why it happens:** New endpoint forgets to replicate the scope-checking pattern from existing controllers.
**How to avoid:** Copy the exact pattern from `ContactsController.GetById`: `GetEffectivePermissionAsync` + `GetTeamMemberIds` + `IsWithinScope`. Extract to a shared helper if desired.
**Warning signs:** Users with "Own" scope seeing all entities in preview.

### Pitfall 5: entity_name denormalization going stale
**What goes wrong:** Entity names change (contact renamed, deal title updated) but the feed_items.entity_name column still has the old value.
**Why it happens:** Denormalized data needs update triggers or application-level sync.
**How to avoid:** Accept eventual consistency. The entity_name is only used for the hover tooltip display. If a user clicks through to the full preview, the live entity name is fetched. Optionally add a simple update query in entity rename operations, but don't over-engineer -- slightly stale tooltip text is an acceptable tradeoff.
**Warning signs:** Tooltip showing old entity name after rename.

### Pitfall 6: Navigation stack memory leak
**What goes wrong:** User clicks through many association chips, building an unbounded stack.
**Why it happens:** No limit on stack depth.
**How to avoid:** Cap the navigation stack at a reasonable depth (e.g., 10). When exceeded, drop the oldest entry. In practice, users rarely go deeper than 3-4 levels.
**Warning signs:** Store state growing unbounded in long-running sessions.

## Code Examples

### Example 1: AppComponent with MatSidenav Integration
```typescript
// Source: Verified against existing app.component.ts and Angular Material docs
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule, RouterOutlet, NavbarComponent,
    MatSidenavModule, EntityPreviewSidebarComponent,
  ],
  template: `
    @if (showNavbar()) {
      <app-navbar />
    }
    <mat-sidenav-container class="app-sidenav-container"
                           [class.has-nav-sidebar]="showNavbar() && !isMobile()"
                           [class.nav-sidebar-collapsed]="showNavbar() && !isMobile() && sidebarState.isCollapsed()">
      <mat-sidenav-content class="app-content"
                           [class.app-content--with-topbar]="showNavbar() && isMobile()">
        <router-outlet />
      </mat-sidenav-content>

      @if (showNavbar()) {
        <mat-sidenav #previewDrawer
                     position="end"
                     mode="side"
                     [opened]="previewStore.isOpen()"
                     class="preview-drawer"
                     (keydown.escape)="previewStore.close()">
          <app-entity-preview-sidebar />
        </mat-sidenav>
      }
    </mat-sidenav-container>
  `,
  styles: [`
    .app-sidenav-container {
      height: 100vh;
    }

    .app-sidenav-container.has-nav-sidebar {
      margin-left: 240px;
      padding-top: 56px;
      transition: margin-left 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .app-sidenav-container.nav-sidebar-collapsed {
      margin-left: 64px;
    }

    .preview-drawer {
      width: 480px;
      border-left: 1px solid var(--color-border);
    }
  `],
})
export class AppComponent {
  readonly previewStore = inject(PreviewSidebarStore);
  // ... existing injects unchanged
}
```

### Example 2: Feed Entity Link with Sidebar Open + Ctrl/Cmd+Click
```typescript
// Source: Existing feed-list.component.ts navigateToEntity pattern
// Template:
// <a class="feed-entity-link"
//    [matTooltip]="getEntityTooltip(item)"
//    (click)="onEntityClick($event, item)"
//    (auxclick)="onEntityMiddleClick($event, item)">
//   <mat-icon>{{ getEntityIcon(item.entityType) }}</mat-icon>
//   {{ item.entityName || ('View ' + item.entityType) }}
// </a>

onEntityClick(event: MouseEvent, item: FeedItemDto): void {
  if (!item.entityType || !item.entityId) return;

  if (event.ctrlKey || event.metaKey) {
    // Ctrl/Cmd+click: navigate to full detail page
    this.navigateToEntity(item);
    return;
  }

  // Normal click: open preview sidebar
  this.previewStore.open({
    entityType: item.entityType,
    entityId: item.entityId,
    entityName: item.entityName ?? undefined,
  });
}
```

### Example 3: Backend Preview Controller (per-type dispatch)
```csharp
// Source: Follows existing ContactsController.GetById pattern
[ApiController]
[Route("api/entities")]
[Authorize]
public class EntityPreviewController : ControllerBase
{
    [HttpGet("{type}/{id:guid}/preview")]
    public async Task<IActionResult> GetPreview(string type, Guid id)
    {
        var userId = GetCurrentUserId();

        return type.ToLower() switch
        {
            "contact" => await GetContactPreview(id, userId),
            "company" => await GetCompanyPreview(id, userId),
            "deal"    => await GetDealPreview(id, userId),
            "lead"    => await GetLeadPreview(id, userId),
            "activity"=> await GetActivityPreview(id, userId),
            "product" => await GetProductPreview(id, userId),
            _ => BadRequest(new { error = $"Unknown entity type: {type}" }),
        };
    }

    private async Task<IActionResult> GetContactPreview(Guid id, Guid userId)
    {
        var contact = await _contactRepository.GetByIdAsync(id);
        if (contact is null) return NotFound(new { error = "Entity not found." });

        var permission = await _permissionService.GetEffectivePermissionAsync(
            userId, "Contact", "View");
        var teamMemberIds = await GetTeamMemberIds(userId, permission.Scope);
        if (!IsWithinScope(contact.OwnerId, permission.Scope, userId, teamMemberIds))
            return Forbid();

        // Load pinned custom fields
        var pinnedFields = await _customFieldRepository.GetPinnedForPreviewAsync("Contact");

        return Ok(ContactPreviewDto.FromEntity(contact, pinnedFields));
    }
}
```

### Example 4: Tab Refactor - RelatedEntityTabsComponent Output Change
```typescript
// Source: Existing related-entity-tabs.component.ts
// Change output type from EventEmitter<number> to EventEmitter<string>
tabChanged = output<string>();

onTabChange(index: number): void {
  const tab = this.tabs()[index];
  if (tab) {
    this.tabChanged.emit(tab.label);
  }
}

// Consumer (e.g., contact-detail.component.ts):
onTabChanged(label: string): void {
  switch (label) {
    case 'Activities': this.loadLinkedActivities(); break;
    case 'Quotes':     this.loadLinkedQuotes();     break;
    case 'Requests':   this.loadLinkedRequests();    break;
    case 'Emails':     this.loadContactEmails();     break;
    case 'Notes':      this.loadContactNotes();      break;
  }
}
```

### Example 5: Mini Stage Progress Bar
```typescript
// For Deal/Lead preview - a compact horizontal stage indicator
@Component({
  selector: 'app-mini-stage-bar',
  standalone: true,
  template: `
    <div class="stage-bar">
      @for (stage of stages(); track stage.id) {
        <div class="stage-segment"
             [class.past]="stage.sortOrder < currentSortOrder()"
             [class.current]="stage.id === currentStageId()"
             [class.future]="stage.sortOrder > currentSortOrder()"
             [style.background-color]="stage.id === currentStageId() ? stage.color : null"
             [matTooltip]="stage.name">
        </div>
      }
    </div>
  `,
  styles: [`
    .stage-bar {
      display: flex;
      gap: 2px;
      height: 6px;
      border-radius: 3px;
      overflow: hidden;
    }
    .stage-segment {
      flex: 1;
      border-radius: 3px;
      transition: background-color 0.2s;
    }
    .stage-segment.past { background: var(--color-success); opacity: 0.6; }
    .stage-segment.current { /* color set via style binding */ }
    .stage-segment.future { background: var(--color-bg-secondary); }
  `],
})
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Index-based tab events | Label-based tab events | This phase | All 5 tab-using detail pages must be updated |
| Feed entity links navigate away | Feed entity links open preview sidebar | This phase | FeedListComponent's `navigateToEntity()` method replaced |
| FeedItem has no entity name | FeedItem denormalizes entity_name | This phase | All feed item creation points need updating + backfill migration |
| CustomFieldDefinition has no preview flag | ShowInPreview boolean added | This phase | Migration + admin UI toggle needed |

**Deprecated/outdated:**
- None in this domain. All patterns used are current Angular 19 / Material M3 / ngrx/signals 19.

## Discretion Recommendations

### Sidebar Header Layout
**Recommendation:** Icon + name + entity type badge as a compact header card. Include a small colored chip showing the entity type (using EntityTypeRegistry color), the entity name as primary text, and the owner avatar + name as secondary text. This provides maximum information density for the 480px width.

### Field Selection Per Entity Type
**Recommendation:**
- **Contact (6 fields):** Full name, email, phone, job title, company name, city
- **Company (6 fields):** Name, industry, phone, website, size, city
- **Deal (7 fields):** Title, value (formatted currency), probability, expected close date, stage (via mini progress bar), company name, pipeline name
- **Lead (7 fields):** Full name, email, phone, company name, temperature badge, source, stage (via mini progress bar)
- **Activity (5 fields):** Subject, type, status, priority, due date
- **Product (4 fields):** Name, unit price, SKU, category

### Association Chip Format
**Recommendation:** Use named chips with counts when the count is small (1-3 items show individual names), counts-only when larger (e.g., "5 Contacts"). This balances information density with space constraints.
- 1-3 associations: Show as individual named chips (e.g., "John Doe", "Jane Smith")
- 4+ associations: Show as count chip (e.g., "7 Contacts")

### Loading Skeleton Design
**Recommendation:** Simple pulse-animated rectangular placeholders matching the field layout. Header skeleton: circle (avatar) + two lines. Fields skeleton: 4-6 rows of label+value pairs. Timeline skeleton: 3 dot+line pairs.

### Error State Handling
**Recommendation:** For deleted/not found entities, show an inline message within the sidebar (not a snackbar): entity type icon, "This [entity type] was not found", and "It may have been deleted or merged", with a close button. For permission denied (403), show "You don't have permission to view this [entity type]".

### Tooltip Implementation
**Recommendation:** Use `MatTooltip` with a short tooltip string: `${entityTypeIcon} ${entityName || entityType}`. Use the `matTooltipShowDelay` of 300ms to avoid tooltip flicker on quick mouse movements. The tooltip is purely informational since the feed item already contains all needed data (entityType + entityName from denormalized column).

## Open Questions

1. **Backfill strategy for entity_name on existing feed_items**
   - What we know: New feed items will populate entity_name at creation time. Existing rows have NULL.
   - What's unclear: Should we run a complex SQL backfill that joins across all entity tables (contacts, deals, leads, activities)? Or accept NULL for historical items?
   - Recommendation: Write a SQL migration that does a multi-table UPDATE join to backfill. The query is straightforward (CASE on entity_type, join to the relevant table, set name). Run once. New items populated by application code going forward.

2. **Activity detail page tab refactor scope**
   - What we know: Activity detail uses `mat-tab-group` directly with `selectedTabIndex` and `(selectedIndexChange)`, not `RelatedEntityTabsComponent`.
   - What's unclear: Should we refactor activity-detail to use `RelatedEntityTabsComponent` (consistency), or just change its local `onTabChange` to use label matching?
   - Recommendation: Keep activity-detail using `mat-tab-group` directly for now (it's a complex page with custom tab content). Just update its local handler to match on tab label instead of index. The important thing is that tab insertion in Phase 23 won't break it.

3. **Product entity in preview**
   - What we know: Product has no OwnerId (shared tenant resource, no RBAC scope check needed). Feed items don't currently link to Products.
   - What's unclear: Will products ever appear in the preview sidebar?
   - Recommendation: Include Product in the preview endpoint for completeness (association chips on Deals can link to Products). But the feed integration won't trigger Product previews since no feed items reference Products.

## Sources

### Primary (HIGH confidence)
- **Codebase analysis** (direct file reads, all confidence HIGH):
  - `globcrm-web/src/app/app.component.ts` -- existing layout structure
  - `globcrm-web/src/app/features/feed/feed-list/feed-list.component.ts` -- current entity link pattern
  - `globcrm-web/src/app/features/feed/feed.models.ts` -- FeedItemDto shape
  - `globcrm-web/src/app/shared/components/related-entity-tabs/related-entity-tabs.component.ts` -- tab system, COMPANY_TABS, CONTACT_TABS, DEAL_TABS
  - `globcrm-web/src/app/features/contacts/contact-detail/contact-detail.component.ts` -- index-based tab pattern
  - `globcrm-web/src/app/features/companies/company-detail/company-detail.component.ts` -- index-based tab pattern
  - `globcrm-web/src/app/features/deals/deal-detail/deal-detail.component.ts` -- index-based tab pattern
  - `globcrm-web/src/app/features/leads/lead-detail/lead-detail.component.ts` -- dynamic tabs with index-based loading
  - `globcrm-web/src/app/features/activities/activity-detail/activity-detail.component.ts` -- direct mat-tab-group usage
  - `src/GlobCRM.Api/Controllers/FeedController.cs` -- FeedItemDto, FeedItem entity
  - `src/GlobCRM.Api/Controllers/ContactsController.cs` -- RBAC scope-check pattern (GetEffectivePermissionAsync + IsWithinScope)
  - `src/GlobCRM.Domain/Entities/FeedItem.cs` -- current entity structure (no EntityName)
  - `src/GlobCRM.Domain/Entities/CustomFieldDefinition.cs` -- current structure (no ShowInPreview)
  - `src/GlobCRM.Domain/Entities/Contact.cs`, `Company.cs`, `Deal.cs`, `Lead.cs`, `Activity.cs`, `Product.cs` -- entity fields for preview DTO design
  - `src/GlobCRM.Infrastructure/Persistence/Configurations/FeedItemConfiguration.cs` -- EF Core config pattern
  - `globcrm-web/src/app/core/permissions/permission.store.ts` -- frontend permission checking
  - `globcrm-web/src/app/shared/components/entity-timeline/entity-timeline.component.ts` -- timeline rendering pattern
  - `globcrm-web/src/app/core/api/api.service.ts` -- API call pattern
  - `globcrm-web/src/app/features/email-templates/email-template-editor/email-template-editor.component.ts` -- existing MatSidenavModule usage precedent

### Secondary (MEDIUM confidence)
- Angular Material Sidenav docs -- `mode="side"` with `position="end"` pushes content. Verified by existing usage in email-template-editor.
- ngrx/signals store patterns -- `signalStore`, `withState`, `withMethods`, `patchState` -- verified by 10+ stores in codebase.

### Tertiary (LOW confidence)
- None. All findings are codebase-verified.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- All libraries already installed and in use
- Architecture: HIGH -- Patterns directly follow existing codebase conventions
- Pitfalls: HIGH -- Identified from real code analysis (tab index fragility, layout conflicts, RBAC replication)

**Research date:** 2026-02-20
**Valid until:** 2026-03-20 (stable -- no fast-moving dependencies)

# Phase 4: Deals & Pipelines - Research

**Researched:** 2026-02-17
**Domain:** CRM deal/pipeline management with Kanban board, multiple views (list/calendar), drag-drop stage transitions, entity linking, and stage history timeline
**Confidence:** HIGH

## Summary

Phase 4 introduces the most interaction-rich feature in GlobCRM so far: configurable deal pipelines with a Kanban board view. The primary challenge is NOT creating yet another CRUD entity (that pattern is well-established from Phase 3 with Company/Contact/Product), but rather building three NEW UI paradigms: (1) a Kanban board with drag-drop stage transitions using Angular CDK, (2) a calendar view using FullCalendar, and (3) a pipeline configuration admin interface. The backend adds significant relational complexity: Pipeline -> PipelineStage -> Deal, plus join tables for Deal-Contact, Deal-Company, and Deal-Product links. Stage history tracking (DealStageHistory) is essential for the timeline and reporting.

The established entity pattern from Phase 3 (domain entity -> EF Core config -> repository -> API controller -> Angular signal store -> list/detail/form components) applies directly to the Deal entity for CRUD and list views. Pipeline and PipelineStage are admin-configured entities that follow a simpler pattern (no dynamic table, no custom fields on pipelines themselves). The Kanban board is a new shared-worthy component that renders deals grouped by stage columns with CDK drag-drop for stage transitions.

The secondary challenge is entity linking: deals link to multiple contacts, companies, and products via join tables. The deal detail page must show these relationships in tabs (matching the RelatedEntityTabs pattern from Phase 3) plus a timeline showing stage history. The Company and Contact detail pages must also have their "Deals" tabs enabled (currently disabled with "coming soon").

**Primary recommendation:** Build Pipeline/PipelineStage as admin-configured entities first (backend + settings UI), then Deal as a standard CRM entity following Phase 3 patterns. Build the Kanban board as a shared component using Angular CDK drag-drop with cdkDropListGroup for connected columns. Use FullCalendar (@fullcalendar/angular v6.x) for the calendar view. Track stage transitions in a DealStageHistory table for timeline and audit purposes.

## Standard Stack

### Core (Already in Project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Angular | 19.2.x | Frontend framework | Already installed |
| Angular Material | 19.2.x | UI components (cards, buttons, tabs, dialogs) | Already installed |
| Angular CDK | 19.2.x | Drag-drop for Kanban board (CdkDropList, CdkDrag, CdkDropListGroup) | Already installed, already used in DynamicTable |
| @ngrx/signals | 19.2.x | Signal-based stores for Deal/Pipeline state | Already installed |
| ASP.NET Core | 10.0.3 | Backend framework | Already installed |
| EF Core + Npgsql | 10.0.x | ORM with JSONB support | Already installed |
| FluentValidation | 12.x | Request validation | Already installed |
| Finbuckle.MultiTenant | 10.0.3 | Tenant isolation | Already installed |

### New Dependencies
| Library | Version | Purpose | Why Needed |
|---------|---------|---------|------------|
| @fullcalendar/angular | 6.1.x | Angular wrapper for FullCalendar | Calendar view for deals (DEAL-05) |
| @fullcalendar/core | 6.1.x | FullCalendar core engine | Required peer dependency |
| @fullcalendar/daygrid | 6.1.x | Month/day grid view plugin | Month calendar view |
| @fullcalendar/interaction | 6.1.x | Click and drag interaction plugin | Event click to navigate to deal detail |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| FullCalendar | Custom CSS grid calendar | FullCalendar handles edge cases (multi-day events, timezone, responsive) that a custom calendar would need to reimplement. DEAL-05 explicitly requires calendar view. |
| CDK drag-drop for Kanban | Third-party Kanban library (e.g., ngx-kanban) | CDK is already installed, well-documented, and used in the project. No additional dependency needed. Custom Kanban with CDK gives full control over styling and behavior. |
| Join tables for Deal-Contact/Company/Product | JSONB arrays of IDs | Join tables provide referential integrity, cascade deletes, and efficient queries. JSONB arrays would require manual consistency management. |

### Installation
```bash
cd globcrm-web
npm install @fullcalendar/angular @fullcalendar/core @fullcalendar/daygrid @fullcalendar/interaction
```

No new NuGet packages required on the backend.

## Architecture Patterns

### Recommended Project Structure

**Backend additions:**
```
src/GlobCRM.Domain/
  Entities/
    Pipeline.cs               # NEW: Pipeline config entity (admin-managed)
    PipelineStage.cs          # NEW: Stage within pipeline (ordered, with probability)
    Deal.cs                   # NEW: Deal CRM entity (value, probability, dates)
    DealContact.cs            # NEW: Join table Deal <-> Contact (many-to-many)
    DealProduct.cs            # NEW: Join table Deal <-> Product (many-to-many with quantity)
    DealStageHistory.cs       # NEW: Audit trail of stage transitions
  Interfaces/
    IPipelineRepository.cs    # NEW: Pipeline + stage CRUD
    IDealRepository.cs        # NEW: Deal CRUD + query with pipeline filtering

src/GlobCRM.Infrastructure/
  Persistence/
    Configurations/
      PipelineConfiguration.cs       # NEW
      PipelineStageConfiguration.cs  # NEW
      DealConfiguration.cs           # NEW
      DealContactConfiguration.cs    # NEW
      DealProductConfiguration.cs    # NEW
      DealStageHistoryConfiguration.cs # NEW
    Repositories/
      PipelineRepository.cs          # NEW
      DealRepository.cs              # NEW
    Migrations/App/
      YYYYMMDDHHMMSS_AddDealsAndPipelines.cs  # NEW: Single migration

src/GlobCRM.Api/
  Controllers/
    PipelinesController.cs    # NEW: Pipeline admin CRUD + stages
    DealsController.cs        # NEW: Deal CRUD + stage transition + linking + timeline
```

**Frontend additions:**
```
globcrm-web/src/app/
  features/
    deals/
      deals.routes.ts                    # NEW: List + Kanban + Calendar + detail routes
      deal.models.ts                     # NEW: Deal, Pipeline, Stage TypeScript models
      deal.service.ts                    # NEW: API service for deals + pipelines
      deal.store.ts                      # NEW: NgRx signal store for deal state
      deal-list/
        deal-list.component.ts/html/scss # NEW: Dynamic table list view (DEAL-02)
      deal-kanban/
        deal-kanban.component.ts/html/scss # NEW: Kanban board with CDK drag-drop (DEAL-04)
      deal-calendar/
        deal-calendar.component.ts/html/scss # NEW: FullCalendar view (DEAL-05)
      deal-detail/
        deal-detail.component.ts/html      # NEW: Detail page with tabs + timeline (DEAL-08)
      deal-form/
        deal-form.component.ts/html        # NEW: Create/edit form (DEAL-01, DEAL-06, DEAL-07)
    settings/
      pipelines/
        pipeline-list.component.ts         # NEW: Pipeline config list (DEAL-03)
        pipeline-edit.component.ts         # NEW: Pipeline + stage editor (DEAL-03, DEAL-10)
```

### Pattern 1: Domain Entities - Pipeline/Stage Hierarchy

**What:** Pipeline is a tenant-scoped admin-configured entity. PipelineStage is a child entity belonging to a Pipeline. Deals belong to a Pipeline and reference a current PipelineStage.

**When to use:** Admin configures pipelines per team. Multiple pipelines can exist per tenant.

**Example:**
```csharp
// Pipeline entity - admin-configured, team-scoped
public class Pipeline
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public Guid? TeamId { get; set; }        // Optional team scope (DEAL-03)
    public Team? Team { get; set; }
    public bool IsDefault { get; set; }       // Default pipeline for new deals
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    public ICollection<PipelineStage> Stages { get; set; } = new List<PipelineStage>();
    public ICollection<Deal> Deals { get; set; } = new List<Deal>();
}

// PipelineStage - ordered stage within a pipeline
public class PipelineStage
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid PipelineId { get; set; }
    public Pipeline Pipeline { get; set; } = null!;
    public string Name { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public string Color { get; set; } = "#1976d2";  // Stage color for Kanban
    public decimal DefaultProbability { get; set; }  // DEAL-10: e.g., 0.25 for 25%
    public bool IsWon { get; set; }                  // Terminal stage: Closed Won
    public bool IsLost { get; set; }                 // Terminal stage: Closed Lost
    public Dictionary<string, object?> RequiredFields { get; set; } = new(); // DEAL-10
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
```

### Pattern 2: Deal Entity with Ownership and Entity Links

**What:** Deal follows the same triple-layer tenant isolation as Company/Contact. It has an OwnerId for permission scoping, belongs to a Pipeline/PipelineStage, and links to Contacts, Companies, and Products via join tables.

**Example:**
```csharp
public class Deal
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }

    // Core fields (DEAL-06)
    public string Title { get; set; } = string.Empty;
    public decimal? Value { get; set; }              // Deal monetary value
    public decimal? Probability { get; set; }        // Override stage default (0.0-1.0)
    public DateOnly? ExpectedCloseDate { get; set; } // For calendar view
    public DateOnly? ActualCloseDate { get; set; }   // Set when won/lost

    // Pipeline position
    public Guid PipelineId { get; set; }
    public Pipeline Pipeline { get; set; } = null!;
    public Guid PipelineStageId { get; set; }
    public PipelineStage Stage { get; set; } = null!;

    // Ownership
    public Guid? OwnerId { get; set; }
    public ApplicationUser? Owner { get; set; }

    // Primary company link (direct FK, nullable)
    public Guid? CompanyId { get; set; }
    public Company? Company { get; set; }

    // Custom fields (DEAL-09)
    public Dictionary<string, object?> CustomFields { get; set; } = new();

    public string? Description { get; set; }
    public bool IsSeedData { get; set; } = false;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    // Many-to-many navigations (DEAL-07)
    public ICollection<DealContact> DealContacts { get; set; } = new List<DealContact>();
    public ICollection<DealProduct> DealProducts { get; set; } = new List<DealProduct>();
}

// Join table: Deal <-> Contact (many-to-many)
public class DealContact
{
    public Guid DealId { get; set; }
    public Deal Deal { get; set; } = null!;
    public Guid ContactId { get; set; }
    public Contact Contact { get; set; } = null!;
    public DateTimeOffset LinkedAt { get; set; } = DateTimeOffset.UtcNow;
}

// Join table: Deal <-> Product (with quantity for deal-specific product association)
public class DealProduct
{
    public Guid DealId { get; set; }
    public Deal Deal { get; set; } = null!;
    public Guid ProductId { get; set; }
    public Product Product { get; set; } = null!;
    public int Quantity { get; set; } = 1;
    public decimal? UnitPrice { get; set; }  // Override product default price
    public DateTimeOffset LinkedAt { get; set; } = DateTimeOffset.UtcNow;
}
```

### Pattern 3: Stage History for Timeline and Audit

**What:** Every time a deal moves between stages, a DealStageHistory record is created. This powers the timeline (DEAL-08) and enables future reporting on conversion rates.

**Example:**
```csharp
public class DealStageHistory
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid DealId { get; set; }
    public Deal Deal { get; set; } = null!;
    public Guid FromStageId { get; set; }
    public PipelineStage FromStage { get; set; } = null!;
    public Guid ToStageId { get; set; }
    public PipelineStage ToStage { get; set; } = null!;
    public Guid? ChangedByUserId { get; set; }
    public ApplicationUser? ChangedByUser { get; set; }
    public DateTimeOffset ChangedAt { get; set; } = DateTimeOffset.UtcNow;
}
```

### Pattern 4: Kanban Board with Angular CDK Drag-Drop

**What:** The Kanban board renders pipeline stages as columns, with deal cards inside each column. CDK drag-drop with `cdkDropListGroup` enables cross-column transfer.

**When to use:** DEAL-04 requires drag-and-drop stage transitions.

**Example:**
```typescript
// Kanban board component using CDK drag-drop
import {
  CdkDragDrop,
  CdkDropList,
  CdkDropListGroup,
  CdkDrag,
  transferArrayItem,
  moveItemInArray,
} from '@angular/cdk/drag-drop';

// Template structure:
// <div cdkDropListGroup>
//   @for (stage of stages(); track stage.id) {
//     <div class="kanban-column">
//       <div class="column-header" [style.border-top-color]="stage.color">
//         {{ stage.name }} ({{ getDealsForStage(stage.id).length }})
//       </div>
//       <div cdkDropList
//            [cdkDropListData]="getDealsForStage(stage.id)"
//            (cdkDropListDropped)="onDrop($event, stage.id)">
//         @for (deal of getDealsForStage(stage.id); track deal.id) {
//           <div cdkDrag class="deal-card">
//             {{ deal.title }}
//           </div>
//         }
//       </div>
//     </div>
//   }
// </div>

// Drop handler:
onDrop(event: CdkDragDrop<DealDto[]>, targetStageId: string): void {
  if (event.previousContainer === event.container) {
    moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
  } else {
    transferArrayItem(
      event.previousContainer.data,
      event.container.data,
      event.previousIndex,
      event.currentIndex,
    );
    // API call to update deal stage
    const deal = event.container.data[event.currentIndex];
    this.dealService.updateStage(deal.id, targetStageId).subscribe();
  }
}
```

### Pattern 5: FullCalendar Integration for Calendar View

**What:** Calendar view renders deals by their expected close date using FullCalendar Angular component.

**When to use:** DEAL-05 requires calendar view.

**Example:**
```typescript
import { FullCalendarModule } from '@fullcalendar/angular';
import { CalendarOptions } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';

// Component:
calendarOptions = signal<CalendarOptions>({
  plugins: [dayGridPlugin, interactionPlugin],
  initialView: 'dayGridMonth',
  events: [],  // Populated from deal data
  eventClick: (info) => {
    this.router.navigate(['/deals', info.event.id]);
  },
});

// Map deals to calendar events:
private mapDealsToEvents(deals: DealDto[]): EventInput[] {
  return deals
    .filter(d => d.expectedCloseDate)
    .map(d => ({
      id: d.id,
      title: d.title,
      date: d.expectedCloseDate,
      backgroundColor: d.stageColor,
    }));
}
```

### Pattern 6: Deal View Switching (List / Kanban / Calendar)

**What:** The deals page has a view mode switcher (like a tab bar or toggle group) that switches between List (DynamicTable), Kanban (CDK drag-drop board), and Calendar (FullCalendar) views.

**When to use:** This is a new UI pattern not present in Phase 3 entities. Deals are the first entity with multiple view modes.

**Example:**
```typescript
// deals.routes.ts
export const DEAL_ROUTES: Routes = [
  { path: '', component: DealListComponent },     // Default: list view
  { path: 'kanban', component: DealKanbanComponent },
  { path: 'calendar', component: DealCalendarComponent },
  { path: 'new', loadComponent: () => import('./deal-form/deal-form.component').then(m => m.DealFormComponent) },
  { path: ':id', loadComponent: () => import('./deal-detail/deal-detail.component').then(m => m.DealDetailComponent) },
  { path: ':id/edit', loadComponent: () => import('./deal-form/deal-form.component').then(m => m.DealFormComponent) },
];
```

### Anti-Patterns to Avoid

- **Storing stage order in Deal entity:** Stage position within a column is ephemeral UI state. Don't persist deal-to-deal ordering within a stage. Sort deals within each stage by a consistent criterion (e.g., value descending, updatedAt descending).
- **Loading all deals for Kanban without pagination:** Kanban views can have hundreds of deals. Use pipeline + stage filtering on the backend. For initial implementation, load all non-terminal deals (not Closed Won/Lost) for the active pipeline, with a "Show closed" toggle.
- **Re-fetching all deals after each drag-drop:** Optimistically update the local state on drop, then sync the stage change via API. Only reload on error.
- **Putting Pipeline CRUD in PipelinesController AND DealsController:** Pipeline admin operations belong in PipelinesController. DealsController only reads pipeline/stage data for display.
- **Nullable PipelineStageId on Deal:** Every deal MUST belong to a stage. The PipelineStageId should be non-nullable. When a deal is created, it enters the first stage of its pipeline by default.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Calendar view | Custom month/week grid with CSS | @fullcalendar/angular v6 | FullCalendar handles month boundaries, multi-day events, timezone edge cases, responsive layout. Building from scratch would take 10x longer. |
| Drag-drop between columns | Custom mouse event handlers | Angular CDK drag-drop (CdkDropListGroup + CdkDropList + CdkDrag) | Already in the project, handles touch events, accessibility, animation, scroll containers. Custom mouse handlers miss keyboard accessibility and mobile. |
| Stage transition validation | Manual if/else chains | Backend service method with configurable rules | Required fields per stage (DEAL-10) need a systematic approach, not ad-hoc checks. |

**Key insight:** The Kanban board and calendar view are the two most complex UI components in the entire CRM. Use well-tested libraries (CDK drag-drop, FullCalendar) and keep the custom code focused on business logic (stage transitions, pipeline filtering, deal aggregation).

## Common Pitfalls

### Pitfall 1: Kanban Column State vs. Backend State Drift
**What goes wrong:** User drags deal from "Proposal" to "Negotiation". Optimistic UI update shows the deal in the new column. API call fails. Deal is visually in "Negotiation" but database still has "Proposal".
**Why it happens:** Network failures, concurrent edits, permission denials.
**How to avoid:** On API error, revert the local state (move the card back to the original column). Show a snackbar error. Consider keeping a local "pending transitions" queue.
**Warning signs:** Deals appearing in wrong columns after page refresh.

### Pitfall 2: Pipeline Stage Deletion with Active Deals
**What goes wrong:** Admin deletes a pipeline stage that has deals in it. Deals lose their stage reference. Kanban board breaks.
**Why it happens:** No referential integrity check before stage deletion.
**How to avoid:** Backend must check for active deals before allowing stage deletion. Either block deletion or require the admin to choose a target stage for reassignment. Use a "move deals to stage X" dialog.
**Warning signs:** Orphaned deals in database, Kanban showing empty columns.

### Pitfall 3: Join Table Cascade Deletes
**What goes wrong:** Deleting a Contact that is linked to deals breaks DealContact references. Deleting a Product linked to deals breaks DealProduct.
**Why it happens:** Missing or incorrect cascade delete configuration.
**How to avoid:** Use `DeleteBehavior.Cascade` on DealContact and DealProduct (deleting the link row, not the deal). Use `DeleteBehavior.Restrict` on Deal -> PipelineStage (can't delete a stage with deals). Contact/Product deletion should cascade-delete the join rows but NOT the deal.
**Warning signs:** Foreign key constraint violations on delete operations.

### Pitfall 4: FullCalendar Change Detection
**What goes wrong:** Calendar doesn't update when deal data changes. Events appear stale.
**Why it happens:** FullCalendar uses reference equality for change detection on complex options. Modifying an existing array reference won't trigger re-render.
**How to avoid:** When updating events, create a NEW array reference: `this.calendarOptions.update(opts => ({ ...opts, events: newEvents }))`. Don't mutate the existing events array.
**Warning signs:** Calendar showing old deals after creating new ones, or not reflecting stage changes.

### Pitfall 5: N+1 Queries on Kanban Board
**What goes wrong:** Loading the Kanban board triggers separate queries for each stage's deals, each deal's contacts, each deal's company.
**Why it happens:** Naive implementation loads deals per stage with eager loading of all navigations.
**How to avoid:** Single query: load all non-terminal deals for the pipeline with `.Include(d => d.Stage).Include(d => d.Company).Include(d => d.Owner)`. Group client-side by StageId. Don't include DealContacts and DealProducts in the Kanban query (load those only on deal detail page).
**Warning signs:** Slow Kanban board load, many SQL queries in logs.

### Pitfall 6: DealStageHistory Missing on Direct Updates
**What goes wrong:** Stage history only records drag-drop transitions but not programmatic stage changes (e.g., API PUT that changes PipelineStageId).
**Why it happens:** Stage history creation is only wired into the Kanban drop handler, not the general update endpoint.
**How to avoid:** Create the stage history record in the backend Deal update logic whenever PipelineStageId changes, regardless of the API endpoint that triggered the change.
**Warning signs:** Timeline missing stage transitions that were made via the edit form.

## Code Examples

### Backend: Deal Repository with Pipeline Filtering
```csharp
// Source: Follows CompanyRepository pattern from Phase 3
public async Task<PagedResult<Deal>> GetPagedAsync(
    EntityQueryParams queryParams,
    PermissionScope scope,
    Guid userId,
    List<Guid>? teamMemberIds = null,
    Guid? pipelineId = null,
    Guid? stageId = null)
{
    var query = _db.Deals
        .Include(d => d.Stage)
        .Include(d => d.Company)
        .Include(d => d.Owner)
        .AsQueryable();

    // Pipeline filter (for Kanban: show one pipeline at a time)
    if (pipelineId.HasValue)
        query = query.Where(d => d.PipelineId == pipelineId.Value);

    // Stage filter
    if (stageId.HasValue)
        query = query.Where(d => d.PipelineStageId == stageId.Value);

    // Ownership scope (same pattern as Company)
    query = ApplyOwnershipScope(query, scope, userId, teamMemberIds);

    // Search, filters, sorting, pagination...
    // (follows CompanyRepository pattern)
}
```

### Backend: Stage Transition with History
```csharp
// In DealsController or a DealService
public async Task<IActionResult> UpdateStage(Guid dealId, Guid newStageId)
{
    var deal = await _dealRepository.GetByIdAsync(dealId);
    if (deal is null) return NotFound();

    // Permission check...

    var oldStageId = deal.PipelineStageId;
    if (oldStageId == newStageId) return NoContent(); // No change

    // Validate new stage belongs to same pipeline
    var newStage = await _db.PipelineStages.FindAsync(newStageId);
    if (newStage is null || newStage.PipelineId != deal.PipelineId)
        return BadRequest("Invalid stage for this pipeline.");

    // Update deal stage
    deal.PipelineStageId = newStageId;
    deal.Probability = newStage.DefaultProbability; // Auto-update probability
    if (newStage.IsWon || newStage.IsLost)
        deal.ActualCloseDate = DateOnly.FromDateTime(DateTime.UtcNow);
    deal.UpdatedAt = DateTimeOffset.UtcNow;

    // Create stage history
    var history = new DealStageHistory
    {
        DealId = dealId,
        FromStageId = oldStageId,
        ToStageId = newStageId,
        ChangedByUserId = GetCurrentUserId(),
    };
    _db.DealStageHistories.Add(history);

    await _db.SaveChangesAsync();
    return NoContent();
}
```

### Frontend: Deal Kanban Board Signal Store
```typescript
// Extends the base DealStore with Kanban-specific methods
interface KanbanState {
  pipelineId: string | null;
  stages: PipelineStageDto[];
  dealsByStage: Record<string, DealKanbanDto[]>;
  isLoading: boolean;
}

// Methods:
// loadKanban(pipelineId: string) - loads pipeline stages and deals, groups by stage
// moveStage(dealId: string, fromStageId: string, toStageId: string) - optimistic update + API call
// revertMove(dealId: string, fromStageId: string, toStageId: string) - revert on API error
```

### Frontend: Pipeline Configuration Store Pattern
```typescript
// Pipeline management follows admin settings pattern (like RoleStore)
// NOT component-provided (pipelines are shared config data)
// Used in settings/pipelines/ pages
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Client-side Kanban state | Signal-based reactive state with optimistic updates | Angular 19 signals | Cleaner state management for drag-drop |
| jQuery UI Sortable for drag-drop | Angular CDK drag-drop | Angular CDK v7+ (2018) | Native Angular integration, accessibility, touch support |
| Custom calendar widgets | FullCalendar v6 Angular component | FullCalendar v6 (2022) | Standalone component support, tree-shakeable plugins |
| EAV tables for deal metadata | JSONB custom fields | PostgreSQL 12+ | Same pattern as Company/Contact (already established) |

**Deprecated/outdated:**
- **FullCalendar v5 Angular integration:** v6 uses standalone components, no NgModule needed. Don't follow v5 tutorials.
- **jQuery-based Kanban boards:** No jQuery in this project. Angular CDK is the standard.

## Open Questions

1. **Deal-to-Company: Direct FK or Join Table?**
   - What we know: DEAL-07 says "link deals to contacts, companies, and products." Contacts and Products clearly need join tables (many-to-many). Company could be a simple nullable FK (like Contact.CompanyId) since a deal typically belongs to one company.
   - What's unclear: Can a deal be linked to multiple companies? Most CRM systems use single-company linkage.
   - Recommendation: Use direct nullable FK `Deal.CompanyId` for the primary company (simpler queries, matches Contact pattern). If multi-company linking is needed later, add a DealCompany join table in a future phase.

2. **Kanban Deal Ordering Within Columns**
   - What we know: CDK drag-drop supports reordering within a column (moveItemInArray).
   - What's unclear: Should users be able to manually reorder deals within a stage? This would require a `SortOrder` column on Deal that updates frequently.
   - Recommendation: Don't persist manual ordering within stages. Sort deals within each Kanban column by value (descending) or updatedAt (descending). This avoids complex sort-order maintenance and concurrent edit conflicts.

3. **Pipeline Switching on Kanban Board**
   - What we know: DEAL-03 says "multiple pipelines with custom stages per team."
   - What's unclear: How should the UI handle pipeline switching? Dropdown selector? Tabs?
   - Recommendation: Pipeline dropdown selector at the top of the Kanban view. Default to the tenant's default pipeline. If a team has a team-scoped pipeline, show that as the default for team members.

4. **Required Fields Per Stage (DEAL-10)**
   - What we know: Pipeline stages should have configurable required fields that must be filled before a deal can enter that stage.
   - What's unclear: How to define which fields are required (core fields? custom fields? both?) and where to validate.
   - Recommendation: Store required field IDs as a JSONB array on PipelineStage. Validate on the backend when `PipelineStageId` changes. Return validation errors that the Kanban board shows as a dialog: "Before moving to Negotiation, please fill in: Expected Close Date, Value."

5. **Calendar View Scope**
   - What we know: DEAL-05 says "calendar views." The calendar shows deals by expected close date.
   - What's unclear: Should the calendar show all deals or filter by pipeline? Should it be a simple month view or also support week/day?
   - Recommendation: Start with month view (dayGridMonth) with pipeline filter dropdown. Keep it simple for Phase 4. Week/day views can be added in Phase 11 (Polish).

## Integration Points with Existing Codebase

### Backend Integration

1. **EntityType enum:** Add `Deal` to `EntityType` enum (it's already there: `Deal` is listed in the enum at line 10 of EntityType.cs). Pipeline is NOT in the EntityType enum because it's admin-config, not a user CRM entity.

2. **RoleTemplateSeeder:** `EnsurePermissionsForAllEntityTypesAsync` already iterates `Enum.GetNames<EntityType>()` which includes `Deal`. No code change needed -- existing tenants will automatically get Deal permissions on next startup.

3. **TenantSeeder:** The seed manifest already has `PipelineSeed` and `DealSeed` data structures. Phase 4 implementation should wire these up to create actual Pipeline, PipelineStage, and Deal entities during tenant seeding.

4. **ApplicationDbContext:** Add DbSets for Pipeline, PipelineStage, Deal, DealContact, DealProduct, DealStageHistory. Add global query filters for Pipeline and Deal (tenant-scoped). PipelineStage, DealContact, DealProduct, DealStageHistory inherit tenant isolation via parent FK (same pattern as RolePermission, TeamMember).

5. **RLS script:** Add RLS policies for `pipelines` and `deals` tables. Child tables (pipeline_stages, deal_contacts, deal_products, deal_stage_histories) do NOT need RLS (accessed via FK joins from tenant-filtered parents).

6. **Custom fields:** Deal entity supports JSONB custom fields following the same pattern as Company/Contact. CustomFieldDefinition.EntityType = "Deal" enables admin-defined fields.

### Frontend Integration

1. **App routes:** Add `deals` route with authGuard in app.routes.ts.

2. **Navbar:** Add "Deals" link in navbar between "Products" and "Team" (matching entity navigation order).

3. **RelatedEntityTabs:** Enable the "Deals" tab on COMPANY_TABS and CONTACT_TABS (currently `enabled: false`). Create `DealTab` configurations for Deal detail page.

4. **Dynamic table:** Deal list page reuses DynamicTableComponent and ViewStore (same as Company/Contact list pages).

5. **Entity timeline:** Deal timeline aggregates: creation, stage changes (from DealStageHistory), linked contact/company/product events, future activity events.

6. **Permission directives:** Use `*appHasPermission="'Deal:Create'"` etc. on deal UI elements (same pattern as Company/Contact).

7. **Settings routes:** Add pipeline configuration pages under `/settings/pipelines` (admin-only, protected by adminGuard).

## Sources

### Primary (HIGH confidence)
- Existing codebase inspection: Company entity pattern, CompanyRepository, CompaniesController, CompanyStore, CompanyListComponent -- establishes the exact patterns to follow
- Existing codebase: EntityType enum already includes `Deal` -- no enum changes needed
- Existing codebase: TenantSeeder already has PipelineSeed and DealSeed structures -- ready for wiring
- Existing codebase: Angular CDK drag-drop already imported and used in DynamicTableComponent -- CdkDrag, CdkDropList, moveItemInArray
- Existing codebase: RoleTemplateSeeder.EnsurePermissionsForAllEntityTypesAsync iterates all EntityType values -- Deal permissions auto-seed

### Secondary (MEDIUM confidence)
- Angular CDK drag-drop documentation: cdkDropListGroup + cdkDropListConnectedTo for cross-list transfer, transferArrayItem for Kanban columns
- FullCalendar Angular v6: Supports Angular 12-20, standalone components, v6.1.x current
- FullCalendar npm page and GitHub: Active maintenance, latest v6.1.20

### Tertiary (LOW confidence)
- None -- all findings verified against existing codebase patterns or official documentation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all core libraries already in project; only FullCalendar is new (verified Angular 19 compatibility)
- Architecture: HIGH - entity CRUD pattern is identical to Phase 3; Kanban and calendar are new UI patterns but use well-established libraries
- Pitfalls: HIGH - identified from codebase analysis (cascade deletes, state drift, N+1 queries) and standard CRM pipeline implementation challenges

**Research date:** 2026-02-17
**Valid until:** 2026-03-17 (30 days -- stable domain, no rapidly changing dependencies)

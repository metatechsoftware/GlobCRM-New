# Phase 23: Summary Tabs on Detail Pages - Research

**Researched:** 2026-02-20
**Domain:** Angular 19 summary aggregation UI + .NET 10 batched API endpoints
**Confidence:** HIGH

## Summary

Phase 23 adds a Summary tab as the default first tab (index 0) on all 6 major entity detail pages (Company, Contact, Deal, Lead, Quote, Request). Each summary tab loads its data via a single backend aggregation endpoint that uses `Task.WhenAll` to batch multiple queries (activities, notes, associations, email stats, pipeline stats, attachments count). The frontend renders this data in a card-grid layout with a QuickActionBarComponent pinned at the top for Add Note, Log Activity, and Send Email actions. Summary tab data auto-refreshes when mutations occur on sibling tabs via a dirty-flag invalidation pattern.

The codebase already has substantial infrastructure to build on: `RelatedEntityTabsComponent` with label-based tab switching (Phase 22), `EntityPreviewController` with per-type association/activity/pipeline queries, `MiniStageBarComponent` for pipeline visualization, `MiniTimelineComponent` for activity rendering, `AssociationChipsComponent` for related entity chips, and `EntityFormDialogComponent` for dialog-based entity creation. The summary endpoint pattern mirrors the existing `DashboardsController` widget-data batched endpoint, but is simpler (single entity, no date range). No new packages are needed.

**Primary recommendation:** Build 6 backend summary endpoints (one per entity type on each existing controller) that use `Task.WhenAll` for parallel data fetching, create a shared `EntitySummaryTabComponent` with entity-type-specific card configurations via `@switch`, and insert the Summary tab at index 0 in each entity's tab constants.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Card grid layout -- distinct cards for each section (key properties, activities, associations, pipeline, etc.), arranged in a responsive grid with clear card separation
- Moderate detail density: 3-5 items per card with enough context to be useful without clicking into the full tab (activities: title + status + due date; notes: 2-3 line preview; associations: name + type)
- No "View all" links on cards -- summary is standalone, users switch tabs manually to see full data
- Horizontal action bar pinned at the top of the summary tab content, always visible as the first thing below the tab strip
- Quick actions open dialog/modal forms (consistent with existing form patterns in the app)
- After a quick action completes (note saved, activity logged), summary tab data auto-refreshes to reflect the change immediately
- Activities & timeline should get the most visual prominence -- the summary is primarily about "what's happening with this entity"
- Reading order: key properties + stage indicator at top, then activities + associations below
- Grid flows: identity first (who/what), then dynamics (what's happening, who's connected)
- Company and Contact: dedicated deal pipeline mini-chart card showing deals by stage, total value, win rate -- full visual bar or donut chart, not just numbers
- Deal and Lead: horizontal stage progress bar showing all pipeline stages with current stage highlighted -- stepped progress indicator, not just a badge
- Contact: dedicated email engagement card showing last sent, last received, total emails exchanged, and sequence enrollment status
- Quote and Request: simpler summaries without pipeline or email cards -- focus on properties, activities, and associations

### Claude's Discretion
- Key properties card: Claude picks the right 4-8 fields per entity type based on typical usage patterns
- Association count presentation: chips vs badges, whether clicking navigates or shows inline preview
- Activities card structure: whether to split recent/upcoming into separate cards or combine into one card with two sections
- Quick action set per entity type: core set (Add Note, Log Activity) on all entities, plus entity-specific actions where they make sense (Send Email on Contact/Lead, etc.)
- Shared template vs per-entity layouts: Claude decides based on how different the entity summaries actually need to be

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SUMMARY-01 | Summary tab appears as the first (default) tab on Company, Contact, Deal, Lead, Quote, and Request detail pages | Tab constants (COMPANY_TABS, CONTACT_TABS, DEAL_TABS) in `related-entity-tabs.component.ts` use label-based arrays; insert `{ label: 'Summary', icon: 'dashboard', enabled: true }` at index 0; Lead uses computed `tabs()` signal that also needs index 0 insertion; Quote and Request use raw `mat-tab-group` -- need refactoring to use RelatedEntityTabsComponent or inserting Summary tab directly |
| SUMMARY-02 | Summary tab displays a key properties card with 4-8 highlighted fields per entity type (read-only) | Each detail component already has entity DTO signals (`company()`, `contact()`, `deal()`, etc.) with all needed fields; backend summary endpoint returns a `keyProperties` section from the entity's detail DTO fields |
| SUMMARY-03 | Summary tab shows association counts (e.g., "5 Contacts, 3 Deals") that link to respective tabs | `EntityPreviewController` already queries association counts per entity type via `GetContactAssociations()`, `GetCompanyAssociations()`, etc.; reuse `AssociationChipDto` model; clicking chips switches to the corresponding tab |
| SUMMARY-04 | Summary tab displays last 3-5 recent activities in condensed format | `EntityPreviewController.GetRecentActivities()` already queries `ActivityLinks` for the last 3; extend to 5; `MiniTimelineComponent` exists for condensed display; add status and dueDate to `RecentActivityDto` |
| SUMMARY-05 | Summary tab displays upcoming activities (not done, due today or later) in condensed format | New query needed: filter `ActivityLinks` where `Activity.Status != Done` AND `Activity.DueDate >= today`, ordered by DueDate ascending, take 5 |
| SUMMARY-06 | Summary tab shows stage/status indicator: pipeline stepper for Deals, stage+temperature for Leads, status badges for Quotes/Requests | `MiniStageBarComponent` exists for Deal/Lead pipelines (from Phase 22 preview sidebar); `PipelineStagePreviewDto` model already has all stage data; Quote/Request use existing status chip patterns with `QUOTE_STATUSES`/`REQUEST_STATUSES` constants |
| SUMMARY-07 | Summary tab includes a quick action bar (Add Note, Log Activity, Send Email) with entity-type-specific actions | `EntityFormDialogComponent` exists for creating entities via dialog; Note creation via `/notes/new` with queryParams; Activity form supports `dialogMode` input; Email sending via `EmailService.send()`; QuickActionBarComponent is a new shared component |
| SUMMARY-08 | Company and Contact summary tabs show mini deal/pipeline summary (total value, deals by stage chart, win rate) | Backend needs new query: group deals by stage for the entity, sum values, count won/lost for win rate; frontend renders as a donut/bar chart using CSS-only (no chart library, per zero-new-packages constraint) |
| SUMMARY-09 | Contact summary tab shows email engagement summary (last sent/received, total exchanged) | `EmailMessages` entity has `LinkedContactId`, `IsInbound`, `SentAt` fields; backend query: count total emails, get max SentAt for inbound/outbound, check sequence enrollment via `SequenceEnrollments` table |
| SUMMARY-10 | Summary tab shows last 2-3 notes preview (truncated to ~100 chars) | `Notes` entity has `PlainTextBody` for truncation; query: top 3 notes by EntityType+EntityId ordered by CreatedAt desc |
| SUMMARY-11 | Summary tab displays "Last contacted" timestamp prominently | Derive from: most recent activity completion date, or most recent email sent date, whichever is later; computed server-side in the summary endpoint |
| SUMMARY-12 | Summary tab shows attachments count badge | `Attachments` entity has `EntityType`+`EntityId` polymorphic columns; simple COUNT query |
</phase_requirements>

## Standard Stack

### Core (Already in Project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Angular | 19 | Frontend framework | Already in use; standalone components with OnPush |
| @ngrx/signals | Latest | Signal-based state management | Already in use for stores |
| Angular Material | 19 | UI component library (mat-tab, mat-chip, mat-icon, mat-dialog, etc.) | Already in use throughout |
| .NET 10 | 10.0 | Backend API framework | Already in use |
| EF Core | 10 | ORM for PostgreSQL queries | Already in use |

### Supporting (Already in Project)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| MatDialogModule | M3 | Quick action dialogs (Add Note, Log Activity) | Quick action bar button clicks |
| MatChipsModule | M3 | Association count badges | Summary tab association section |
| MatTooltipModule | M3 | Stage bar segment tooltips | Pipeline stepper hover info |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CSS-only charts (donut/bar) | Chart.js / ng2-charts | User decided zero new packages for v1.2; CSS can render simple donut/bar charts for deal pipeline |
| Shared EntitySummaryTabComponent | 6 separate per-entity summary components | Shared component with @switch on entityType is cleaner; the layouts differ moderately but share enough structure (action bar, card grid, activities, notes, attachments) |

**Installation:**
```bash
# No new packages needed -- zero new packages for v1.2
```

## Architecture Patterns

### Recommended Project Structure
```
src/GlobCRM.Api/Controllers/
  CompaniesController.cs          # Add GET {id}/summary endpoint
  ContactsController.cs           # Add GET {id}/summary endpoint
  DealsController.cs              # Add GET {id}/summary endpoint
  LeadsController.cs              # Add GET {id}/summary endpoint
  QuotesController.cs             # Add GET {id}/summary endpoint
  RequestsController.cs           # Add GET {id}/summary endpoint

globcrm-web/src/app/shared/components/
  summary-tab/
    entity-summary-tab.component.ts     # Shared summary tab container
    entity-summary-tab.component.html   # Card grid template with @switch per entity type
    entity-summary-tab.component.scss   # Card grid responsive styles
    summary.models.ts                   # Summary DTO interfaces
    summary.service.ts                  # API calls to summary endpoints
  quick-action-bar/
    quick-action-bar.component.ts       # Horizontal action bar
```

### Pattern 1: Batched Summary Endpoint (Backend)
**What:** Single GET endpoint per entity type that aggregates all summary data via parallel queries.
**When to use:** Every entity detail page loads the summary tab.
**Example:**
```csharp
// Source: Existing pattern from DashboardsController.GetWidgetData + EntityPreviewController
[HttpGet("{id:guid}/summary")]
[Authorize(Policy = "Permission:Company:View")]
public async Task<IActionResult> GetSummary(Guid id)
{
    var company = await _companyRepository.GetByIdAsync(id);
    if (company is null) return NotFound();

    // RBAC scope check (same pattern as existing GetById)
    var userId = GetCurrentUserId();
    var permission = await _permissionService.GetEffectivePermissionAsync(userId, "Company", "View");
    // ... scope check ...

    // Parallel data fetching
    var recentActivitiesTask = GetRecentActivities("Company", id, 5);
    var upcomingActivitiesTask = GetUpcomingActivities("Company", id, 5);
    var recentNotesTask = GetRecentNotes("Company", id, 3);
    var associationsTask = GetCompanyAssociations(id);
    var attachmentCountTask = _db.Attachments.CountAsync(a => a.EntityType == "Company" && a.EntityId == id);
    var lastContactedTask = GetLastContactedDate("Company", id);
    var dealPipelineSummaryTask = GetDealPipelineSummary(id); // Company-specific

    await Task.WhenAll(
        recentActivitiesTask, upcomingActivitiesTask, recentNotesTask,
        associationsTask, attachmentCountTask, lastContactedTask, dealPipelineSummaryTask);

    return Ok(new CompanySummaryDto { /* ... assembled from awaited tasks ... */ });
}
```

### Pattern 2: Summary Tab Data + Dirty-Flag Invalidation (Frontend)
**What:** Summary tab loads data once via the summary service; sibling tab mutations set a dirty flag; when user returns to Summary tab, it reloads if dirty.
**When to use:** Every detail page component.
**Example:**
```typescript
// Source: Angular Signals pattern
// In the detail component:
summaryDirty = signal(false);
summaryData = signal<CompanySummaryDto | null>(null);
summaryLoading = signal(false);

onTabChanged(label: string): void {
  if (label === 'Summary') {
    if (this.summaryDirty() || !this.summaryData()) {
      this.loadSummary();
    }
  }
  // Existing tab handling...
}

// After any mutation on sibling tabs (e.g., adding a note, linking a contact):
this.summaryDirty.set(true);
```

### Pattern 3: Quick Action Bar with Dialog Forms
**What:** Horizontal bar with icon buttons that open entity form dialogs. After dialog closes successfully, marks summary as dirty and reloads.
**When to use:** Summary tab top area, always visible.
**Example:**
```typescript
// Source: Existing EntityFormDialogComponent pattern + ContactDetailComponent.enrollInSequence()
onAddNote(): void {
  const dialogRef = this.dialog.open(NoteFormDialogComponent, {
    width: '600px',
    data: { entityType: this.entityType, entityId: this.entityId, entityName: this.entityName },
  });
  dialogRef.afterClosed().subscribe(result => {
    if (result) {
      this.summaryDirty.set(true);
      this.loadSummary(); // Immediate refresh per user decision
    }
  });
}
```

### Pattern 4: CSS-Only Donut Chart for Deal Pipeline
**What:** Conic gradient CSS for a donut chart showing deals by stage.
**When to use:** Company and Contact summary tabs (deal pipeline mini-chart card).
**Example:**
```scss
// CSS-only donut chart using conic-gradient
.donut-chart {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: conic-gradient(
    var(--stage-1-color) 0deg var(--stage-1-deg),
    var(--stage-2-color) var(--stage-1-deg) var(--stage-2-deg),
    /* ... more stages ... */
  );
  mask: radial-gradient(circle at center, transparent 40px, black 40px);
  -webkit-mask: radial-gradient(circle at center, transparent 40px, black 40px);
}
```

### Pattern 5: Tab Insertion at Index 0
**What:** Prepend Summary tab to each entity's tab constant array and shift all ng-template content indices.
**When to use:** All 6 entity detail pages.
**Example:**
```typescript
// Before (company):
export const COMPANY_TABS: EntityTab[] = [
  { label: 'Details', icon: 'info', enabled: true },
  { label: 'Contacts', icon: 'people', enabled: true },
  // ...
];

// After:
export const COMPANY_TABS: EntityTab[] = [
  { label: 'Summary', icon: 'dashboard', enabled: true },  // NEW at index 0
  { label: 'Details', icon: 'info', enabled: true },
  { label: 'Contacts', icon: 'people', enabled: true },
  // ...
];

// The detail HTML adds one new <ng-template> at the top for summary content
// All existing templates shift by +1 but label-based tab switching means
// onTabChanged() still works without index changes (labels don't change)
```

### Anti-Patterns to Avoid
- **N+1 API calls from the summary tab:** Never call 6-8 separate endpoints from the frontend for one summary load. Use the single batched backend endpoint.
- **Loading summary data on page load when another tab is active:** Summary tab should lazy-load only when it's the active tab (it's the default, so it loads on page open, but not on subsequent visits unless dirty).
- **Putting summary state in a Signal Store:** The summary data is page-scoped and ephemeral. Simple signals in the detail component suffice -- no need for a separate store.
- **Breaking existing tab indices:** Phase 22 moved to label-based tab switching. Never use `onTabSelected(index)` for the summary tab. Use `onTabChanged(label)` consistently.
- **Eagerly importing all form dialogs:** Use lazy `import()` for dialog components (same pattern as `LeadConvertDialogComponent` in lead-detail).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Pipeline stage visualization | Custom SVG pipeline | Reuse `MiniStageBarComponent` (already built for Deal/Lead preview) | Already handles stage coloring, current stage highlighting, tooltip |
| Activity timeline rendering | Custom timeline HTML | Reuse/adapt `MiniTimelineComponent` (from preview sidebar) | Already handles relative time formatting, activity type coloring |
| Association chip display | Custom badge layout | Reuse `AssociationChipsComponent` (from preview sidebar) or adapt its pattern | Already handles entity type icons, count vs named chips |
| Quick action dialogs | Custom inline forms | Use `MatDialog` with existing form components (`EntityFormDialogComponent` pattern) | Consistent UX, error handling, and "Create & Close" / "Create & View" flow |
| Donut chart | Chart.js | CSS conic-gradient | Zero new packages constraint; simple 5-7 segment chart doesn't need a library |

**Key insight:** Phase 22 built reusable preview components (`MiniStageBarComponent`, `MiniTimelineComponent`, `AssociationChipsComponent`) that can be directly reused or minimally adapted for the summary tab cards.

## Common Pitfalls

### Pitfall 1: Tab Index Shift Breaking Existing Template Content
**What goes wrong:** Adding Summary at index 0 shifts all existing `<ng-template>` content by +1, but if any code uses hardcoded index numbers for tab selection or lazy loading, it breaks.
**Why it happens:** Quote and Request detail pages still use `onTabSelected(index: number)` instead of label-based switching.
**How to avoid:** Convert Quote and Request detail pages to use `RelatedEntityTabsComponent` with label-based `onTabChanged(label)` before inserting the Summary tab. Or at minimum update their index-based handlers.
**Warning signs:** Notes or attachments not loading on tab click; wrong content appearing in wrong tabs.

### Pitfall 2: Summary Tab Not Refreshing After Mutations
**What goes wrong:** User adds a note from the summary quick action bar, closes the dialog, but the summary still shows the old data.
**Why it happens:** Dialog close handler doesn't trigger a summary reload, or the dirty flag is set but reload is deferred until tab re-entry.
**How to avoid:** Per the locked decision, summary data auto-refreshes immediately after a quick action completes. Call `loadSummary()` directly in the dialog `afterClosed()` handler, don't just set a dirty flag.
**Warning signs:** Stale counts after adding notes, activities, or attachments.

### Pitfall 3: N+1 Queries in the Backend Summary Endpoint
**What goes wrong:** Backend fetches each sub-query sequentially instead of in parallel, resulting in 200-500ms response times.
**Why it happens:** Using sequential `await` instead of `Task.WhenAll()`.
**How to avoid:** Gather all independent queries as tasks, then `await Task.WhenAll(...)`. This is safe because each query is a read-only `IQueryable` that doesn't depend on other results.
**Warning signs:** Summary tab load time exceeds 300ms for well-indexed data.

### Pitfall 4: Quote and Request Not Using RelatedEntityTabsComponent
**What goes wrong:** Quote and Request detail pages use raw `mat-tab-group` directly in their templates (not `RelatedEntityTabsComponent`). Inserting a Summary tab requires different code paths for these two entities.
**Why it happens:** These were built with simpler tab needs and never migrated to the shared component.
**How to avoid:** Either (a) refactor Quote and Request detail pages to use `RelatedEntityTabsComponent` first, or (b) add the Summary tab content directly inside their existing `mat-tab-group`. Option (b) is simpler and doesn't change existing behavior.
**Warning signs:** Summary tab not appearing on Quote/Request detail pages, or tab switching broken.

### Pitfall 5: Company/Contact Deal Pipeline Chart with Zero Deals
**What goes wrong:** The deal pipeline mini-chart card renders an empty or broken donut chart when the entity has no associated deals.
**Why it happens:** Conic-gradient with 0 segments produces no visual output.
**How to avoid:** Check if `dealsByStage` array is empty and show an "empty state" message (e.g., "No deals yet") instead of the chart.
**Warning signs:** Blank card area, broken chart rendering, or CSS rendering artifacts.

### Pitfall 6: Email Engagement Card on Contact with No Email Account
**What goes wrong:** Contact email engagement card shows errors or broken state when the tenant has no connected email account or the contact has no emails.
**Why it happens:** Query returns nulls for last sent/received timestamps.
**How to avoid:** Return null/empty for email engagement when no emails exist; frontend renders "No email activity" placeholder.
**Warning signs:** Null reference errors, "undefined" displayed in email timestamps.

## Code Examples

### Backend: Company Summary DTO Shape
```csharp
// Source: Designed based on existing EntityPreviewDto + CONTEXT.md decisions
public record CompanySummaryDto
{
    // Key properties (4-8 fields)
    public string Name { get; init; } = string.Empty;
    public string? Industry { get; init; }
    public string? Phone { get; init; }
    public string? Email { get; init; }
    public string? Website { get; init; }
    public string? OwnerName { get; init; }
    public string? City { get; init; }
    public string? Size { get; init; }

    // Associations (reuse AssociationChipDto)
    public List<AssociationChipDto> Associations { get; init; } = new();

    // Activities
    public List<SummaryActivityDto> RecentActivities { get; init; } = new();
    public List<SummaryActivityDto> UpcomingActivities { get; init; } = new();

    // Notes preview
    public List<SummaryNoteDto> RecentNotes { get; init; } = new();

    // Attachments count
    public int AttachmentCount { get; init; }

    // Last contacted
    public DateTimeOffset? LastContactedAt { get; init; }

    // Company-specific: Deal pipeline summary
    public DealPipelineSummaryDto? DealPipeline { get; init; }
}

public record SummaryActivityDto
{
    public Guid Id { get; init; }
    public string Subject { get; init; } = string.Empty;
    public string Type { get; init; } = string.Empty;
    public string Status { get; init; } = string.Empty;
    public DateTimeOffset? DueDate { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
}

public record SummaryNoteDto
{
    public Guid Id { get; init; }
    public string Title { get; init; } = string.Empty;
    public string? Preview { get; init; } // Truncated to ~100 chars
    public string? AuthorName { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
}

public record DealPipelineSummaryDto
{
    public decimal TotalValue { get; init; }
    public int TotalDeals { get; init; }
    public decimal WinRate { get; init; } // 0.0 to 1.0
    public List<DealStageSummaryDto> DealsByStage { get; init; } = new();
}

public record DealStageSummaryDto
{
    public string StageName { get; init; } = string.Empty;
    public string Color { get; init; } = string.Empty;
    public int Count { get; init; }
    public decimal Value { get; init; }
}

// Contact-specific addition:
public record EmailEngagementDto
{
    public int TotalEmails { get; init; }
    public int SentCount { get; init; }
    public int ReceivedCount { get; init; }
    public DateTimeOffset? LastSentAt { get; init; }
    public DateTimeOffset? LastReceivedAt { get; init; }
    public bool IsEnrolledInSequence { get; init; }
    public string? SequenceName { get; init; }
}
```

### Frontend: Summary Tab Service
```typescript
// Source: Based on existing service patterns (CompanyService, EmailService)
@Injectable({ providedIn: 'root' })
export class SummaryService {
  private readonly api = inject(ApiService);

  getCompanySummary(id: string): Observable<CompanySummaryDto> {
    return this.api.get<CompanySummaryDto>(`/api/companies/${id}/summary`);
  }

  getContactSummary(id: string): Observable<ContactSummaryDto> {
    return this.api.get<ContactSummaryDto>(`/api/contacts/${id}/summary`);
  }

  getDealSummary(id: string): Observable<DealSummaryDto> {
    return this.api.get<DealSummaryDto>(`/api/deals/${id}/summary`);
  }

  getLeadSummary(id: string): Observable<LeadSummaryDto> {
    return this.api.get<LeadSummaryDto>(`/api/leads/${id}/summary`);
  }

  getQuoteSummary(id: string): Observable<QuoteSummaryDto> {
    return this.api.get<QuoteSummaryDto>(`/api/quotes/${id}/summary`);
  }

  getRequestSummary(id: string): Observable<RequestSummaryDto> {
    return this.api.get<RequestSummaryDto>(`/api/requests/${id}/summary`);
  }
}
```

### Frontend: QuickActionBarComponent
```typescript
// Source: Based on existing EntityFormDialogComponent usage pattern
@Component({
  selector: 'app-quick-action-bar',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, HasPermissionDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="quick-action-bar">
      <button mat-stroked-button (click)="addNote.emit()" *appHasPermission="'Note:Create'">
        <mat-icon>note_add</mat-icon> Add Note
      </button>
      <button mat-stroked-button (click)="logActivity.emit()" *appHasPermission="'Activity:Create'">
        <mat-icon>add_task</mat-icon> Log Activity
      </button>
      @if (showSendEmail()) {
        <button mat-stroked-button (click)="sendEmail.emit()" *appHasPermission="'Email:Create'">
          <mat-icon>email</mat-icon> Send Email
        </button>
      }
    </div>
  `,
})
export class QuickActionBarComponent {
  readonly showSendEmail = input(false);
  readonly addNote = output<void>();
  readonly logActivity = output<void>();
  readonly sendEmail = output<void>();
}
```

### Frontend: Dirty-Flag Summary Reload
```typescript
// Source: Angular signals pattern in existing detail components
// In company-detail.component.ts:

summaryData = signal<CompanySummaryDto | null>(null);
summaryLoading = signal(false);
summaryDirty = signal(false);

onTabChanged(label: string): void {
  if (label === 'Summary') {
    if (!this.summaryData() || this.summaryDirty()) {
      this.loadSummary();
    }
  }
  // ... existing tab handlers ...
}

private loadSummary(): void {
  this.summaryLoading.set(true);
  this.summaryDirty.set(false);
  this.summaryService.getCompanySummary(this.companyId).subscribe({
    next: (data) => {
      this.summaryData.set(data);
      this.summaryLoading.set(false);
    },
    error: () => {
      this.summaryLoading.set(false);
    },
  });
}

// Called after quick action dialog closes OR after mutations on sibling tabs:
markSummaryDirty(): void {
  this.summaryDirty.set(true);
}
```

## Discretion Recommendations

### Key Properties per Entity Type
Based on examining the existing detail DTOs, preview Fields, and typical CRM usage:

| Entity | Recommended Key Properties (4-8 fields) |
|--------|----------------------------------------|
| **Company** | Name, Industry, Phone, Email, Website, Owner, City + Country, Size |
| **Contact** | Full Name, Email, Phone, Job Title, Company Name, Owner, Department |
| **Deal** | Title, Value (formatted currency), Probability, Expected Close Date, Pipeline + Stage, Company, Owner |
| **Lead** | Full Name, Email, Phone, Company Name, Source, Temperature, Owner |
| **Quote** | Quote Number, Title, Status, Grand Total, Contact, Company, Issue Date, Expiry Date |
| **Request** | Subject, Status, Priority, Category, Contact, Company, Owner, Assigned To |

### Association Count Presentation: Chips
Use Material chips (matching `AssociationChipsComponent` pattern from Phase 22 preview sidebar). Clicking a chip switches to the corresponding tab (e.g., clicking "5 Contacts" switches to the Contacts tab). This uses the existing `tabChanged` output and doesn't need navigation.

### Activities Card Structure: Combined with Two Sections
Use a single Activities card with two visually separated sections:
- **Recent** (top): Last 3-5 completed/in-progress activities, sorted by most recent first
- **Upcoming** (bottom, with accent border): Activities with status != Done and DueDate >= today, sorted by nearest due date first

This avoids two nearly-identical cards side by side and gives a unified "what's happening" view.

### Quick Action Set per Entity Type

| Entity | Quick Actions |
|--------|--------------|
| **Company** | Add Note, Log Activity |
| **Contact** | Add Note, Log Activity, Send Email |
| **Deal** | Add Note, Log Activity |
| **Lead** | Add Note, Log Activity, Send Email |
| **Quote** | Add Note, Log Activity |
| **Request** | Add Note, Log Activity |

Send Email only on Contact and Lead (entities with direct email addresses). Company/Deal/Quote/Request don't have direct email targets.

### Shared Template vs Per-Entity Layouts: Shared with @switch
Use a single `EntitySummaryTabComponent` with a common card grid layout. Entity-specific sections use `@switch (entityType())` blocks within the template:
- Common cards (all 6): Key Properties, Activities, Notes Preview, Attachments Count, Last Contacted, Associations
- Company/Contact only: Deal Pipeline Mini-Chart card
- Deal/Lead only: Stage Progress Bar card (embedded in Key Properties card or as a dedicated card at the top)
- Contact only: Email Engagement card

This gives ~70% shared template with ~30% entity-specific branching, which is cleaner than 6 separate components.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Index-based tab switching | Label-based tab switching (Phase 22) | Phase 22 | Summary tab insertion at index 0 is safe; no index-based code breaks |
| Per-entity separate preview components | Shared preview component with entity-specific sections | Phase 22 | Same pattern applies to summary tab |
| N+1 frontend API calls for tab data | Single batched endpoint | Phase 23 design | One API call per summary load |
| index-based `onTabSelected(index)` in Quote/Request | Label-based `onTabChanged(label)` | Needs migration in Phase 23 | Quote/Request need to adopt RelatedEntityTabsComponent or adapt |

**Note on Quote and Request detail pages:** These two pages use raw `mat-tab-group` directly instead of `RelatedEntityTabsComponent`. The simplest approach for Phase 23 is to add the Summary tab directly to their existing `mat-tab-group` with an `@if` block checking for the Summary tab index. This avoids a risky refactoring of these pages mid-phase. A future phase could migrate them to `RelatedEntityTabsComponent` if desired.

## Open Questions

1. **Note Quick Action Dialog: Existing vs New**
   - What we know: Notes are currently created via navigation to `/notes/new?entityType=Company&entityId=...&entityName=...`. There is no `NoteFormDialogComponent` equivalent to `EntityFormDialogComponent`.
   - What's unclear: Should we create a lightweight note creation dialog or reuse the navigation pattern in a dialog wrapper?
   - Recommendation: Create a simple `NoteQuickAddDialogComponent` with just title + body fields and the entity context pre-filled. This is simpler than wrapping the full note form page.

2. **Summary Load Timing for Default Tab**
   - What we know: Summary is the default tab (index 0), so it loads immediately on page open. The detail component also loads entity detail data on init.
   - What's unclear: Should the summary endpoint include the entity's key properties (reducing to a single API call), or should the summary tab read from the existing entity detail signal?
   - Recommendation: The summary endpoint returns key properties as part of its response. This makes the Summary tab self-contained and avoids a race condition where the entity detail data hasn't loaded yet when Summary renders. The entity detail data still loads for use by other tabs.

3. **Activity Log Quick Action**
   - What we know: `EntityFormDialogComponent` supports Activity creation via `ActivityFormComponent` with `dialogMode` input.
   - What's unclear: Should the activity be auto-linked to the current entity, or should the user manually link it?
   - Recommendation: Pre-fill the entity link in the activity form data when opening from the summary quick action. This requires adding link context to the dialog data and the form component handling it.

## Sources

### Primary (HIGH confidence)
- **Codebase examination** -- All findings verified by reading source files:
  - `related-entity-tabs.component.ts` -- Tab constants, label-based switching, EntityTab interface
  - `EntityPreviewController.cs` -- Association queries, activity queries, pipeline stage queries, RBAC scope patterns
  - `DashboardsController.cs` -- Batched widget data endpoint pattern
  - `DashboardAggregationService.cs` -- Server-side metric computation with scope filtering
  - 6 entity detail components (.ts, .html, .scss) -- Current tab structure, data loading patterns, signals
  - 6 entity model files (.models.ts) -- All DTO field names and types
  - `entity-type-registry.ts` -- Entity config map
  - Preview sidebar components -- `MiniStageBarComponent`, `MiniTimelineComponent`, `AssociationChipsComponent`
  - Domain entities -- `Attachment.cs`, `Note.cs`, `EmailMessage.cs` (query schema)
  - `EntityFormDialogComponent` -- Dialog-based entity creation pattern

### Secondary (MEDIUM confidence)
- **CSS conic-gradient donut chart** -- Well-documented CSS technique, verified as supported in all modern browsers (Chrome 69+, Firefox 83+, Safari 12.1+)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- Everything already in the project, zero new packages
- Architecture: HIGH -- All patterns verified against existing codebase (preview, dashboard, tab system)
- Pitfalls: HIGH -- Identified from actual code examination (Quote/Request tab differences, N+1 patterns, dirty-flag needs)
- Code examples: HIGH -- Based on actual existing code patterns in the codebase

**Research date:** 2026-02-20
**Valid until:** 2026-03-20 (stable -- no external dependencies involved)

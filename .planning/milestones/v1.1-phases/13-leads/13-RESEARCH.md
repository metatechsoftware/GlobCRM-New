# Phase 13: Leads - Research

**Researched:** 2026-02-18
**Domain:** Full-stack CRM lead management entity with pipeline stages, Kanban view, and lead-to-contact/company/deal conversion
**Confidence:** HIGH

## Summary

Phase 13 adds a Lead entity following the well-established v1.0 entity patterns (Contact, Company, Deal). The Lead entity is a hybrid of Contact (person-like fields) and Deal (pipeline stage progression), with a unique conversion workflow that creates Contact + optionally Company + Deal records from lead data. The codebase has deeply consistent patterns across all 12 existing entity types, making this phase highly predictable from a technical standpoint.

The primary complexity lives in three areas: (1) the lead pipeline stages system, which can reuse the existing Pipeline/PipelineStage entities with a `PipelineType` discriminator or use a simpler dedicated `LeadStage` entity; (2) the conversion workflow, which is a transactional multi-entity create operation with duplicate detection; and (3) the Kanban board, which can closely follow the existing `DealKanbanComponent` pattern using Angular CDK drag-drop.

**Primary recommendation:** Follow existing entity patterns exactly (entity, configuration, repository, controller, service, store, routes), reusing the existing Pipeline/PipelineStage infrastructure with a `PipelineType` enum discriminator to distinguish deal pipelines from lead pipelines. This maximizes code reuse for the Kanban board and stage management admin UI.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Kanban board view AND standard dynamic table -- users can switch between views (same pattern as deals pipeline)
- Stages are configurable per tenant -- admin can add/rename/reorder stages, similar to deal pipeline customization
- Default stages seeded: New, Contacted, Qualified, Lost, Converted
- Two terminal stages: **Converted** (success) and **Lost** (failure) -- leads exit the active pipeline either way
- Forward-only stage progression by default, with an explicit "reopen" action to move backward
- Contact is always created during conversion; company and deal are optional toggles in the conversion dialog
- Editable preview dialog -- lead data pre-fills the new record fields, user can review and edit before confirming
- If lead's company name matches an existing company, show a match warning: "Company 'X' already exists -- link to existing or create new?" -- user decides
- Same duplicate-aware suggestion for contact email matches
- Lead sources are configurable per tenant -- admin manages the source list (seeded defaults: Website, Referral, LinkedIn, Cold Call, Trade Show, Email Campaign, Other)
- Simple hot/warm/cold temperature indicator on each lead -- visual badge in table and Kanban, selectable on create/edit
- Horizontal stepper progress bar across the top showing all pipeline stages -- current stage highlighted, clickable to advance (forward-only unless reopened)
- Prominent "Convert Lead" button in the header area -- always visible when lead is in a convertible stage (not shown on Lost/Converted leads)
- Standard entity tabs (Activities, Notes, Attachments, Timeline) plus a "Conversion" tab showing conversion details and linked records after conversion
- Conversion tab only appears after lead has been converted
- Kanban board should follow the same component pattern as the deals pipeline Kanban
- Temperature indicator should be a colored badge (e.g., red=hot, orange=warm, blue=cold) -- visible at a glance in both table and Kanban
- Conversion dialog is a multi-step or sectioned form: Contact fields (required) -> Company fields (optional toggle) -> Deal fields (optional toggle)
- Stage stepper on detail page should be interactive -- click a future stage to advance, with confirmation

### Claude's Discretion
- Post-conversion lead behavior (mark as Converted + read-only vs soft-delete -- pick whichever is most consistent with CRM patterns)
- Web form capture API endpoint -- assess scope and decide if it fits this phase or should be deferred
- Lead assignment (AssignedTo user field) -- pick based on CRM best practices and existing entity patterns
- Detail page header layout -- balance stage/temperature prominence with contact info based on existing detail page patterns
- Loading skeletons, error states, empty states for all views

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| LEAD-01 | User can create, view, edit, and delete leads with standard CRM fields (name, email, phone, company, source, status) | Follow Contact/Deal entity CRUD pattern: Entity, Repository interface, Repository impl, EF Configuration, Controller with DTOs + validators, Service, Store, Form component. See Architecture Patterns section. |
| LEAD-02 | User can view leads in a dynamic table with configurable columns, sorting, filtering, and saved Views | Exact same pattern as all v1.0 entities: EntityQueryParams, PagedResult, DynamicTableComponent, FilterPanelComponent, SavedView entity (already supports any entityType string). See Code Examples section. |
| LEAD-03 | User can track lead source and status through configurable stages (New, Contacted, Qualified, Unqualified, Converted) | Reuse Pipeline/PipelineStage entities with PipelineType discriminator. LeadStage uses IsConverted/IsLost instead of IsWon/IsLost. Stage history via LeadStageHistory entity. See Architecture Patterns: Lead Pipeline Design. |
| LEAD-04 | User can convert a qualified lead into a contact + company + deal in one action | New conversion endpoint POST /api/leads/{id}/convert. Transactional multi-entity create. Duplicate check for email/company name. See Architecture Patterns: Conversion Workflow. |
| LEAD-05 | Leads support custom fields (same JSONB system as other entities) | Identical to all other entities: Dictionary<string, object?> CustomFields property, JSONB column with GIN index, CustomFieldValidator for create/update. EntityType = "Lead" in CustomFieldDefinition. |
| LEAD-06 | Lead activities and notes appear in an entity timeline | Polymorphic linking via EntityType="Lead" + EntityId on Note, Attachment, Activity. Timeline endpoint GET /api/leads/{id}/timeline follows Deal timeline pattern. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| .NET 10 | 10.x | Backend framework | Project standard |
| EF Core | 10.x | ORM with PostgreSQL | Project standard, Npgsql provider |
| FluentValidation | 11.x | Request validation | Used by all existing controllers |
| Angular | 19.x | Frontend framework | Project standard |
| @ngrx/signals | 19.x | Signal Store state management | Used by all feature stores |
| Angular Material | 19.x | UI component library (M3 theme) | Project standard |
| @angular/cdk/drag-drop | 19.x | Kanban drag-drop | Already used by DealKanbanComponent |
| Angular Material Stepper | 19.x (MatStepperModule) | Detail page stage stepper | Built into Angular Material, fits the horizontal stage progression UI |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Tailwind CSS | 3.x | Utility styling | Used alongside Angular Material per project convention |
| NpgsqlTsVector | (EF Core) | Full-text search | HasGeneratedTsVectorColumn on Lead entity |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Reusing Pipeline/PipelineStage with PipelineType | Separate LeadStage entity | Separate entity avoids modifying existing Pipeline, but duplicates admin UI, Kanban patterns, and migration complexity. Reuse is better. |
| MatStepper for stage progression | Custom stepper component | MatStepper has built-in accessibility, animations, and styling. Custom stepper offers more control but more code. Recommend MatStepper. |
| Soft-delete on conversion | Hard-delete with audit | CRM standard practice is to keep the lead record as read-only with Converted status for audit trail and reporting. Recommend soft-mark as Converted + read-only. |

**Installation:**
No new packages needed. All required libraries are already in the project.

## Architecture Patterns

### Recommended Project Structure

**Backend:**
```
src/GlobCRM.Domain/
  Entities/
    Lead.cs                    # Lead entity (new)
    LeadStageHistory.cs        # Stage transition audit (new)
    LeadSource.cs              # Configurable source list (new)
    LeadConversion.cs          # Conversion record linking lead -> contact/company/deal (new)
  Enums/
    EntityType.cs              # Add Lead value (modify)
    LeadTemperature.cs         # Hot/Warm/Cold enum (new)
  Interfaces/
    ILeadRepository.cs         # Repository interface (new)

src/GlobCRM.Infrastructure/
  Persistence/
    Configurations/
      LeadConfiguration.cs          # EF type config (new)
      LeadStageHistoryConfiguration.cs  # (new)
      LeadSourceConfiguration.cs    # (new)
      LeadConversionConfiguration.cs # (new)
    Repositories/
      LeadRepository.cs             # Repository implementation (new)
    ApplicationDbContext.cs         # Add DbSets + query filters (modify)
  CrmEntities/
    CrmEntityServiceExtensions.cs   # Register ILeadRepository (modify)
  MultiTenancy/
    TenantSeeder.cs                 # Add lead seed data (modify)

src/GlobCRM.Api/
  Controllers/
    LeadsController.cs              # Full CRUD + stage + convert + kanban + timeline (new)
    LeadSourcesController.cs        # Admin source management (new)
```

**Frontend:**
```
globcrm-web/src/app/features/leads/
  lead.models.ts                   # All DTOs and request interfaces
  lead.service.ts                  # API service
  lead.store.ts                    # Signal Store
  leads.routes.ts                  # Feature routes
  lead-list/
    lead-list.component.ts         # Dynamic table list page
    lead-list.component.html
    lead-list.component.scss       # Uses _entity-list.scss
  lead-kanban/
    lead-kanban.component.ts       # Kanban board (follows deal-kanban pattern)
    lead-kanban.component.html
    lead-kanban.component.scss
  lead-detail/
    lead-detail.component.ts       # Detail page with stepper + tabs
    lead-detail.component.html
    lead-detail.component.scss
  lead-form/
    lead-form.component.ts         # Create/Edit form
  lead-convert/
    lead-convert-dialog.component.ts  # Conversion dialog (multi-section)
    lead-convert-dialog.component.html
```

### Pattern 1: Lead Pipeline Design (Reuse Pipeline Infrastructure)

**What:** Add a `PipelineType` enum (`Deal`, `Lead`) to the Pipeline entity. Lead pipelines use `IsConverted`/`IsLost` terminal flags instead of `IsWon`/`IsLost` (or simply reuse `IsWon` as `IsConverted`). The existing PipelinesController and admin UI can serve both types with minimal modification.

**When to use:** When implementing lead stage configuration. This is the recommended approach because:
1. The existing Pipeline/PipelineStage/PipelineRepository already handle admin CRUD, stage ordering, and validation
2. The DealKanbanComponent pattern translates directly to LeadKanbanComponent
3. The DealStageHistory pattern translates directly to LeadStageHistory

**Implementation detail:** Rather than adding PipelineType to the existing Pipeline entity (which would require modifying existing deal pipelines), create a parallel but simpler structure:

```csharp
// Domain/Entities/LeadStage.cs - tenant-scoped, simpler than PipelineStage
public class LeadStage
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public string Name { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public string Color { get; set; } = "#1976d2";
    public bool IsConverted { get; set; }  // Terminal: success
    public bool IsLost { get; set; }       // Terminal: failure
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
```

**Rationale for separate LeadStage entity (instead of reusing Pipeline):**
- Lead stages are simpler -- no probability, no required fields, no team scoping, no multiple pipelines per tenant
- Avoids modifying Pipeline entity which deal functionality depends on
- A single configurable stage list per tenant is the user decision ("stages are configurable per tenant")
- The Kanban pattern code is duplicated but adapted (leads show temperature, company name, source -- not deal value)

### Pattern 2: Lead Entity Design

**What:** The Lead entity combines person-like contact fields with pipeline stage tracking.

```csharp
// Source: Codebase analysis of Contact.cs + Deal.cs
public class Lead
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }

    // Person fields (like Contact)
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string? MobilePhone { get; set; }
    public string? JobTitle { get; set; }

    // Company info (string, not FK -- leads may reference non-existent companies)
    public string? CompanyName { get; set; }

    // Pipeline tracking (like Deal)
    public Guid LeadStageId { get; set; }
    public LeadStage Stage { get; set; } = null!;

    // Lead-specific
    public Guid? LeadSourceId { get; set; }
    public LeadSource? Source { get; set; }
    public LeadTemperature Temperature { get; set; } = LeadTemperature.Warm;

    // Ownership
    public Guid? OwnerId { get; set; }
    public ApplicationUser? Owner { get; set; }

    // Conversion tracking
    public bool IsConverted { get; set; }
    public DateTimeOffset? ConvertedAt { get; set; }
    public Guid? ConvertedByUserId { get; set; }
    public Guid? ConvertedContactId { get; set; }
    public Guid? ConvertedCompanyId { get; set; }
    public Guid? ConvertedDealId { get; set; }

    // Standard CRM fields
    public Dictionary<string, object?> CustomFields { get; set; } = new();
    public string? Description { get; set; }
    public NpgsqlTsVector SearchVector { get; set; } = null!;
    public bool IsSeedData { get; set; } = false;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public string FullName => $"{FirstName} {LastName}".Trim();
}
```

### Pattern 3: Conversion Workflow

**What:** A dedicated endpoint that atomically creates Contact (required) + Company (optional) + Deal (optional) from lead data, marks the lead as Converted, and records the conversion details.

**When to use:** POST /api/leads/{id}/convert endpoint.

**Flow:**
1. Validate lead exists and is not already Converted or Lost
2. Check for duplicate contact (by email) -- return matches if found, let user decide
3. Check for duplicate company (by name) -- return matches if found, let user decide
4. In a single transaction:
   a. Create Contact from lead fields (user can edit in preview)
   b. Optionally create or link Company
   c. Optionally create Deal with first stage of default pipeline
   d. Mark lead as Converted: `IsConverted = true`, `ConvertedAt = now`, set ConvertedContactId/CompanyId/DealId
   e. Move lead to Converted stage
   f. Create LeadStageHistory entry
   g. Dispatch feed event + notifications
5. Return conversion result with IDs of created entities

```csharp
// Controller endpoint pattern
[HttpPost("{id:guid}/convert")]
[Authorize(Policy = "Permission:Lead:Update")]
public async Task<IActionResult> Convert(Guid id, [FromBody] ConvertLeadRequest request)
{
    // ... validation, duplicate check, transactional creation ...
}

public record ConvertLeadRequest
{
    // Contact fields (required, pre-filled from lead)
    public string FirstName { get; init; } = string.Empty;
    public string LastName { get; init; } = string.Empty;
    public string? Email { get; init; }
    public string? Phone { get; init; }
    public string? JobTitle { get; init; }
    public Guid? CompanyId { get; init; }  // Link to existing

    // Company (optional)
    public bool CreateCompany { get; init; }
    public string? NewCompanyName { get; init; }
    public string? NewCompanyWebsite { get; init; }
    public string? NewCompanyPhone { get; init; }

    // Deal (optional)
    public bool CreateDeal { get; init; }
    public string? DealTitle { get; init; }
    public decimal? DealValue { get; init; }
    public Guid? DealPipelineId { get; init; }
}

public record ConvertLeadResult
{
    public Guid ContactId { get; init; }
    public Guid? CompanyId { get; init; }
    public Guid? DealId { get; init; }
}
```

### Pattern 4: Duplicate Detection During Conversion

**What:** Before converting, check for existing contacts/companies that match.

**Approach:** Simple name/email matching (not fuzzy -- Phase 16 adds full fuzzy matching later).

```csharp
// Check for existing contact by email
[HttpGet("{id:guid}/convert/check-duplicates")]
public async Task<IActionResult> CheckDuplicates(Guid id)
{
    var lead = await _leadRepository.GetByIdAsync(id);
    // Query contacts by email match, companies by name match
    // Return potential matches for user to review
}
```

### Pattern 5: Stage Stepper on Detail Page

**What:** A horizontal stepper showing all pipeline stages with the current stage highlighted.

**Angular Material MatStepper** can be used in linear mode for forward-only progression. Clicking a future step triggers a stage change with confirmation dialog.

```typescript
// Lead detail component
import { MatStepperModule } from '@angular/material/stepper';

// In template: use mat-stepper with each step representing a pipeline stage
// The completed/active state maps to the lead's current stage
```

**Alternative:** A custom CSS stepper (simpler, more control over visual design) using a row of connected circles/labels. This is more common in CRM UIs and avoids MatStepper's form-centric assumptions.

**Recommendation:** Use a custom stepper component since MatStepper is designed for form wizards, not status progression. A custom stepper gives full control over:
- Clickable future stages with confirmation
- Visual terminal states (green for Converted, red for Lost)
- Non-interactive past stages (forward-only)
- "Reopen" action for backward movement

### Anti-Patterns to Avoid
- **Sharing Pipeline entity between Deals and Leads without a discriminator:** This creates coupling where pipeline admin changes affect both entities. Keep them separate.
- **Soft-deleting leads on conversion:** This hides data. Instead, mark as Converted + read-only. The lead record serves as audit trail and shows conversion details.
- **Building duplicate detection in this phase:** Keep it simple -- exact email match and exact company name match. Phase 16 (Duplicate Detection) adds full fuzzy matching with pg_trgm + FuzzySharp.
- **Storing lead source as a string field:** Make it a configurable entity (LeadSource) so admins can manage the list, and it can be used for filtering/reporting.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Drag-and-drop Kanban | Custom drag handlers | `@angular/cdk/drag-drop` (CdkDrag, CdkDropList, CdkDropListGroup) | Already used by DealKanbanComponent; handles accessibility, touch, animations |
| Form validation | Manual field checks | FluentValidation (backend), Angular reactive forms (frontend) | Consistent with all existing entity forms |
| Custom field storage | Custom schema per field | JSONB column + CustomFieldValidator | Existing infrastructure handles validation, GIN indexing, filtering |
| Permission enforcement | Inline permission checks | `[Authorize(Policy = "Permission:Lead:View")]` + IPermissionService | Existing RBAC system already supports dynamic entity permission policies |
| Paged list queries | Custom pagination | EntityQueryParams + PagedResult<T> pattern | All repositories follow this exact pattern |
| Full-text search | LIKE queries | HasGeneratedTsVectorColumn with GIN index | Project standard; performs orders of magnitude better at scale |

**Key insight:** This phase is ~95% pattern replication from existing entities. The only genuinely new logic is the conversion workflow and the temperature/source lead-specific fields.

## Common Pitfalls

### Pitfall 1: Forgetting Multi-Tenancy Layers
**What goes wrong:** Lead data leaks across tenants.
**Why it happens:** Missing one of the three isolation layers.
**How to avoid:**
1. Entity has `TenantId` property
2. `ApplicationDbContext.OnModelCreating` adds global query filter for Lead
3. `scripts/rls-setup.sql` updated with RLS policy for `leads` table
4. LeadStage, LeadSource also need tenant query filters (they have TenantId)
5. LeadStageHistory, LeadConversion inherit isolation via parent Lead FK
**Warning signs:** Tests that work without tenant context set.

### Pitfall 2: Conversion Transaction Atomicity
**What goes wrong:** Partial conversion -- Contact created but Deal creation fails, leaving inconsistent state.
**Why it happens:** Multiple SaveChangesAsync calls without wrapping in a transaction.
**How to avoid:** Use a single `SaveChangesAsync()` call that includes all entity additions (Contact, Company, Deal, Lead status update, LeadStageHistory). EF Core tracks all changes and commits them atomically.
**Warning signs:** Multiple `await _db.SaveChangesAsync()` calls in the conversion method.

### Pitfall 3: EntityType Enum Not Updated
**What goes wrong:** Lead doesn't appear in permission configuration UI, custom fields can't target Lead entity.
**Why it happens:** Forgetting to add `Lead` to the `EntityType` enum.
**How to avoid:** Add `Lead` to `EntityType.cs`. Also verify that the permission policy provider handles "Lead" entity dynamically (it should -- existing `PermissionPolicyProvider` uses string-based policy names like "Permission:Lead:View").
**Warning signs:** Permission policies not being created for Lead operations.

### Pitfall 4: Forward-Only Stage Logic Not Enforced on Backend
**What goes wrong:** Users can drag leads backward in Kanban, bypassing the forward-only rule.
**Why it happens:** Only enforcing forward-only in the frontend; backend accepts any stage change.
**How to avoid:** In the stage update endpoint, compare `newStage.SortOrder > currentStage.SortOrder` (or allow terminal stages). Provide a separate "reopen" endpoint that explicitly allows backward movement.
**Warning signs:** Backend stage PATCH accepts any stageId without order validation.

### Pitfall 5: Missing Navigation and Route Registration
**What goes wrong:** Leads page not accessible despite all components being built.
**Why it happens:** Forgetting to update `app.routes.ts`, `navbar.component.ts`, and permission guard.
**How to avoid:** Checklist:
1. Add `leads` route to `app.routes.ts` with `authGuard` and `permissionGuard('Lead', 'View')`
2. Add `{ route: '/leads', icon: 'person_search', label: 'Leads' }` to navbar CRM group
3. Create `leads.routes.ts` with list/kanban/new/:id/:id/edit routes

### Pitfall 6: Seed Data Incomplete
**What goes wrong:** Demo environment has no leads to showcase.
**Why it happens:** TenantSeeder not updated with lead data.
**How to avoid:** Add lead seed data including:
- LeadStages (default 5: New, Contacted, Qualified, Lost, Converted)
- LeadSources (default 7: Website, Referral, LinkedIn, Cold Call, Trade Show, Email Campaign, Other)
- Sample Lead records with varying stages and temperatures
- At least one converted lead with conversion tracking data

## Code Examples

Verified patterns from the existing codebase:

### Entity with Standard CRM Fields (Contact.cs pattern)
```csharp
// Source: src/GlobCRM.Domain/Entities/Contact.cs
public class Lead
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    // ... fields ...
    public Dictionary<string, object?> CustomFields { get; set; } = new();
    public NpgsqlTsVector SearchVector { get; set; } = null!;
    public bool IsSeedData { get; set; } = false;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    public string FullName => $"{FirstName} {LastName}".Trim();
}
```

### EF Configuration with JSONB + Full-Text Search (DealConfiguration.cs pattern)
```csharp
// Source: src/GlobCRM.Infrastructure/Persistence/Configurations/DealConfiguration.cs
builder.ToTable("leads");
builder.Property(l => l.CustomFields)
    .HasColumnName("custom_fields")
    .HasColumnType("jsonb")
    .HasDefaultValueSql("'{}'::jsonb");
builder.HasIndex(l => l.CustomFields)
    .HasMethod("gin")
    .HasDatabaseName("idx_leads_custom_fields_gin");
builder.HasGeneratedTsVectorColumn(
    l => l.SearchVector, "english",
    l => new { l.FirstName, l.LastName, l.Email, l.CompanyName });
builder.Property(l => l.SearchVector).HasColumnName("search_vector");
builder.HasIndex(l => l.SearchVector)
    .HasMethod("GIN")
    .HasDatabaseName("idx_leads_search_vector");
```

### Controller with Permission Policies (DealsController.cs pattern)
```csharp
// Source: src/GlobCRM.Api/Controllers/DealsController.cs
[ApiController]
[Route("api/leads")]
[Authorize]
public class LeadsController : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = "Permission:Lead:View")]
    public async Task<IActionResult> GetList([FromQuery] EntityQueryParams queryParams) { ... }

    [HttpPost]
    [Authorize(Policy = "Permission:Lead:Create")]
    public async Task<IActionResult> Create([FromBody] CreateLeadRequest request) { ... }
}
```

### Signal Store Pattern (DealStore pattern)
```typescript
// Source: globcrm-web/src/app/features/deals/deal.store.ts
export const LeadStore = signalStore(
  withState(initialState),
  withMethods((store) => {
    const leadService = inject(LeadService);
    return {
      loadPage(): void {
        patchState(store, { isLoading: true });
        const params = { /* from store signals */ };
        leadService.getList(params).subscribe({
          next: (result) => patchState(store, { items: result.items, totalCount: result.totalCount, isLoading: false }),
          error: () => patchState(store, { isLoading: false }),
        });
      },
      // ... setSort, setFilters, setSearch, setPage, loadDetail, clearDetail
    };
  }),
);
```

### Kanban CDK Drag-Drop (DealKanbanComponent pattern)
```typescript
// Source: globcrm-web/src/app/features/deals/deal-kanban/deal-kanban.component.ts
onDrop(event: CdkDragDrop<LeadKanbanCardDto[]>, targetStageId: string): void {
  if (event.previousContainer === event.container) {
    moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    return;
  }
  const lead = event.previousContainer.data[event.previousIndex];
  // Optimistic update
  transferArrayItem(event.previousContainer.data, event.container.data,
    event.previousIndex, event.currentIndex);
  // API call with rollback on error
  this.leadService.updateStage(lead.id, targetStageId).subscribe({
    error: () => {
      transferArrayItem(event.container.data, event.previousContainer.data,
        event.currentIndex, event.previousIndex);
      this.snackBar.open('Failed to update lead stage', 'Dismiss', { duration: 3000 });
    },
  });
}
```

### Route Registration Pattern
```typescript
// Source: globcrm-web/src/app/app.routes.ts
{
  path: 'leads',
  canActivate: [authGuard, permissionGuard('Lead', 'View')],
  loadChildren: () =>
    import('./features/leads/leads.routes').then(m => m.LEAD_ROUTES),
},
```

### DI Registration Pattern
```csharp
// Source: src/GlobCRM.Infrastructure/CrmEntities/CrmEntityServiceExtensions.cs
services.AddScoped<ILeadRepository, LeadRepository>();
```

## Discretion Recommendations

### Post-Conversion Lead Behavior
**Recommendation:** Mark as Converted + read-only. Do NOT soft-delete.

**Rationale:** This is standard CRM practice (Salesforce, HubSpot, Pipedrive all keep converted leads visible). The lead record serves as:
1. Audit trail showing the conversion path
2. Source for conversion metrics/reporting
3. Reference for the Conversion tab on the detail page

**Implementation:** Set `IsConverted = true` on the Lead entity. The detail page checks this flag and disables edit actions (hide edit button, show "Converted" banner). The list page can filter by stage to show/hide converted leads.

### Web Form Capture API
**Recommendation:** Defer to Phase LEAD-F02 (already in future requirements).

**Rationale:** Web form capture requires: public unauthenticated endpoint, CAPTCHA/rate limiting, field mapping configuration, and a form builder UI. This is significant scope beyond the core lead CRUD + conversion workflow. The REQUIREMENTS.md already has `LEAD-F02: Web form integration for lead capture` in Future Requirements.

### Lead Assignment (AssignedTo)
**Recommendation:** Use `OwnerId` with nullable `Guid?` FK to `ApplicationUser`, identical to the existing pattern on Contact, Company, and Deal.

**Rationale:** All existing CRM entities use `OwnerId` for the same purpose. The RBAC permission system's ownership scope (Own, Team, All) already filters by `OwnerId`. Using the same field name and pattern ensures:
1. Permission scope filtering works out of the box
2. Existing `IsWithinScope()` helper method works unchanged
3. Consistent terminology across all entities

### Detail Page Header Layout
**Recommendation:** Follow the Deal detail pattern with these additions:
1. Top bar: Lead name + temperature badge + source tag
2. Below: Horizontal stage stepper (full width)
3. Right-aligned: "Convert Lead" button (primary CTA, orange) -- hidden for Converted/Lost leads
4. Below stepper: Standard entity tabs

### Loading Skeletons, Error States, Empty States
**Recommendation:** Follow existing entity patterns:
- **Loading:** `MatProgressSpinnerModule` centered (already used by all detail pages)
- **Error:** Snackbar notifications via `MatSnackBar` (already used everywhere)
- **Empty list:** Text message with icon in the table area (e.g., "No leads found. Create your first lead to get started.")
- **Empty Kanban:** Show empty stage columns with "No leads in this stage" placeholder text

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| NgModules for feature areas | Standalone components | Angular 15+ | All lead components must be standalone |
| @Input/@Output decorators | input()/output() functions | Angular 17+ | Lead components use signal-based inputs |
| BehaviorSubject stores | @ngrx/signals SignalStore | Angular 17+ | LeadStore uses signalStore() |
| ViewChild decorator | viewChild() function | Angular 17+ | Signal-based view queries |

**Deprecated/outdated:**
- Do NOT use NgModules for the leads feature
- Do NOT use `@Input()` decorator -- use `input()` function
- Do NOT use `subscribe()` in templates -- use `toSignal()` or signal-based patterns

## Open Questions

1. **Lead stage forward-only enforcement granularity**
   - What we know: User decision says "forward-only by default with explicit reopen action"
   - What's unclear: Should the reopen action require Admin role, or can any user with Lead:Update permission reopen?
   - Recommendation: Allow any user with Lead:Update permission to reopen, but log it as a distinct timeline event ("Lead reopened from {stage} to {stage}"). Admin-only restriction would be overly restrictive for typical CRM usage.

2. **Conversion dialog duplicate matching threshold**
   - What we know: User wants "match warning" for company name and contact email
   - What's unclear: Should matching be exact only, or case-insensitive? What about partial email matches?
   - Recommendation: Case-insensitive exact match for email, case-insensitive contains for company name. This catches "Acme Corp" vs "acme corp" without requiring Phase 16's fuzzy matching infrastructure.

3. **Lead Kanban card content**
   - What we know: Show temperature badge, but what other fields on the Kanban card?
   - What's unclear: Exact card layout (which fields are most important for at-a-glance Kanban view)
   - Recommendation: Show: Lead name, company name, source, temperature badge, owner avatar/initials, days in current stage. This gives a complete picture without cluttering the card.

## Sources

### Primary (HIGH confidence)
- **Codebase analysis** - Direct examination of 20+ source files across Domain, Infrastructure, Api, and Angular projects
  - Entity patterns: Contact.cs, Company.cs, Deal.cs, Pipeline.cs, PipelineStage.cs, DealStageHistory.cs
  - Controller patterns: DealsController.cs, ContactsController.cs, PipelinesController.cs (full CRUD + DTOs + validators)
  - Repository patterns: IDealRepository.cs, IContactRepository.cs, DealRepository.cs (filtering, sorting, pagination, scope)
  - EF Configuration: DealConfiguration.cs, ContactConfiguration.cs, CompanyConfiguration.cs (JSONB, FTS, indexes)
  - DbContext: ApplicationDbContext.cs (DbSets, query filters)
  - DI: CrmEntityServiceExtensions.cs, DependencyInjection.cs
  - Frontend: deal.models.ts, deal.service.ts, deal.store.ts, deals.routes.ts
  - Kanban: deal-kanban.component.ts (CDK drag-drop, pipeline switching, optimistic updates)
  - Detail: deal-detail.component.ts (tabs, linking, timeline)
  - Navigation: navbar.component.ts (navGroups), app.routes.ts (permission guards)
  - Shared: related-entity-tabs.component.ts (tab constants), query.models.ts (PagedResult, EntityQueryParams)

### Secondary (MEDIUM confidence)
- **CRM industry patterns** - Lead management lifecycle patterns from established CRM platforms (Salesforce, HubSpot, Pipedrive) inform the conversion workflow design, stage progression rules, and post-conversion behavior

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new libraries needed; all patterns are established in the codebase
- Architecture: HIGH - Direct extrapolation from existing Deal + Contact + Pipeline patterns with extensive code examples
- Pitfalls: HIGH - Identified from analysis of existing multi-tenancy, conversion atomicity, and registration patterns
- Conversion workflow: MEDIUM - Novel feature for this codebase, but follows well-established CRM patterns

**Research date:** 2026-02-18
**Valid until:** 2026-03-18 (stable -- no external dependencies or fast-moving libraries)

# Phase 3: Core CRM Entities - Research

**Researched:** 2026-02-16
**Domain:** CRM entity CRUD (Company, Contact, Product), relational navigation, entity timeline, server-side filtering/sorting/pagination
**Confidence:** HIGH

## Summary

Phase 3 builds the first user-facing CRM entities -- Companies, Contacts, and Products -- on top of the extensive infrastructure from Phases 1 and 2. The key challenge is NOT building new infrastructure (the dynamic table, custom fields, views, permissions, and RBAC are all built), but rather correctly wiring three complete entity lifecycles (domain entities, EF Core config, migrations, repositories, controllers, Angular services, stores, list pages, detail pages, forms) that integrate with ALL existing systems simultaneously: tenant isolation (triple-layer), permission authorization, custom field validation, dynamic tables, saved views, and field-level access control.

The secondary challenge is the entity timeline component (COMP-04, CONT-05) and the relational navigation pattern (COMP-03, CONT-04). These require a generic timeline/activity feed that aggregates related entities. Since Activities, Notes, Emails, and Deals do NOT exist yet (Phases 4-7), the timeline and navigation tabs should be built as extensible shells -- rendering what exists now (companies <-> contacts links) with placeholder tabs for future entity types. This prevents rework when those entities arrive.

The product entity is simpler (no timeline, no relational navigation beyond "selectable in quotes") but establishes the pattern for entities without complex relationships.

**Primary recommendation:** Build a generic entity CRUD pattern (BaseEntity -> repository -> controller -> Angular service/store -> list page -> detail page -> form) and replicate it three times for Company, Contact, Product. Use server-side filtering/sorting/pagination from the start (not client-side). Build the entity timeline as a shared component that accepts a polymorphic list of timeline entries. Wire all Phase 2 infrastructure (permissions, custom fields, views) into each entity from day one.

## Standard Stack

### Core (Already in Project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Angular | 19.2.x | Frontend framework | Already installed |
| Angular Material | 19.2.x | UI components (mat-table, mat-tabs, mat-form-field) | Already installed |
| Angular CDK | 19.2.x | Drag-drop for column reorder | Already installed |
| @ngrx/signals | 19.2.x | Signal-based stores per entity | Already installed, used for AuthStore/PermissionStore |
| ASP.NET Core | 10.0.3 | Backend framework | Already installed |
| EF Core + Npgsql | 10.0.x | ORM with JSONB support | Already installed, EnableDynamicJson configured |
| FluentValidation | 12.x | Request validation | Already installed |
| Finbuckle.MultiTenant | 10.0.3 | Tenant isolation | Already installed |

### No New Dependencies Required

Phase 3 requires zero new NuGet packages or npm packages. Everything needed is already in the project from Phases 1-2. This is by design -- the infrastructure phase front-loaded all dependencies.

## Architecture Patterns

### Recommended Project Structure

**Backend additions:**
```
src/GlobCRM.Domain/
├── Entities/
│   ├── Company.cs                   # NEW: Company CRM entity
│   ├── Contact.cs                   # NEW: Contact CRM entity
│   └── Product.cs                   # NEW: Product entity
│
├── Interfaces/
│   ├── ICompanyRepository.cs        # NEW: Company CRUD + query
│   ├── IContactRepository.cs        # NEW: Contact CRUD + query
│   └── IProductRepository.cs        # NEW: Product CRUD + query

src/GlobCRM.Infrastructure/
├── Persistence/
│   ├── Configurations/
│   │   ├── CompanyConfiguration.cs          # NEW: EF Core config
│   │   ├── ContactConfiguration.cs          # NEW: EF Core config
│   │   └── ProductConfiguration.cs          # NEW: EF Core config
│   ├── Repositories/
│   │   ├── CompanyRepository.cs             # NEW
│   │   ├── ContactRepository.cs             # NEW
│   │   └── ProductRepository.cs             # NEW
│   └── Migrations/App/
│       └── YYYYMMDDHHMMSS_AddCrmEntities.cs # NEW: Single migration

src/GlobCRM.Api/
├── Controllers/
│   ├── CompaniesController.cs               # NEW: CRUD + query endpoints
│   ├── ContactsController.cs                # NEW: CRUD + query endpoints
│   └── ProductsController.cs                # NEW: CRUD + query endpoints
```

**Frontend additions:**
```
globcrm-web/src/app/
├── features/
│   ├── companies/
│   │   ├── companies.routes.ts              # NEW: List + detail routes
│   │   ├── company-list/
│   │   │   └── company-list.component.ts    # NEW: Dynamic table + views
│   │   ├── company-detail/
│   │   │   └── company-detail.component.ts  # NEW: Detail + tabs + timeline
│   │   ├── company-form/
│   │   │   └── company-form.component.ts    # NEW: Create/edit form + custom fields
│   │   ├── company.models.ts                # NEW: DTOs
│   │   ├── company.service.ts               # NEW: API service
│   │   └── company.store.ts                 # NEW: Signal store
│   │
│   ├── contacts/
│   │   ├── contacts.routes.ts               # NEW
│   │   ├── contact-list/
│   │   │   └── contact-list.component.ts    # NEW
│   │   ├── contact-detail/
│   │   │   └── contact-detail.component.ts  # NEW
│   │   ├── contact-form/
│   │   │   └── contact-form.component.ts    # NEW
│   │   ├── contact.models.ts                # NEW
│   │   ├── contact.service.ts               # NEW
│   │   └── contact.store.ts                 # NEW
│   │
│   └── products/
│       ├── products.routes.ts               # NEW
│       ├── product-list/
│       │   └── product-list.component.ts    # NEW
│       ├── product-detail/
│       │   └── product-detail.component.ts  # NEW (simpler, no timeline)
│       ├── product-form/
│       │   └── product-form.component.ts    # NEW
│       ├── product.models.ts                # NEW
│       ├── product.service.ts               # NEW
│       └── product.store.ts                 # NEW
│
├── shared/
│   └── components/
│       ├── entity-timeline/
│       │   └── entity-timeline.component.ts # NEW: Reusable timeline component
│       ├── custom-field-form/
│       │   └── custom-field-form.component.ts # NEW: Renders custom field inputs per field definitions
│       └── related-entity-tabs/
│           └── related-entity-tabs.component.ts # NEW: Tab-based relational navigation shell
```

### Pattern 1: CRM Entity with Tenant Isolation + Custom Fields + Ownership

**What:** The standard pattern for every CRM entity. All three entities (Company, Contact, Product) follow this exact pattern.

**Entity structure:**
```csharp
public class Company
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }

    // Core fields (indexed, queryable)
    public string Name { get; set; } = string.Empty;
    public string? Industry { get; set; }
    public string? Website { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? Address { get; set; }
    public string? City { get; set; }
    public string? State { get; set; }
    public string? Country { get; set; }
    public string? PostalCode { get; set; }
    public string? Size { get; set; }       // "1-10", "11-50", etc.
    public string? Description { get; set; }

    // Ownership (for permission scope filtering: Own, Team, All)
    public Guid? OwnerId { get; set; }
    public ApplicationUser? Owner { get; set; }

    // Custom fields as JSONB
    public Dictionary<string, object?> CustomFields { get; set; } = new();

    // Seed data marker (for TenantSeeder bulk deletion)
    public bool IsSeedData { get; set; } = false;

    // Audit timestamps
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    // Navigation properties
    public Organization Organization { get; set; } = null!;
    public ICollection<Contact> Contacts { get; set; } = new List<Contact>();
}
```

**Key design decisions:**
- `OwnerId` is nullable (company might not have an assigned owner)
- `CustomFields` is `Dictionary<string, object?>` mapped as JSONB via `HasColumnType("jsonb")`
- `IsSeedData` flag enables bulk deletion of demo data
- Navigation properties for relational queries
- TenantId + global query filter + RLS = triple-layer isolation

### Pattern 2: Server-Side Filtering, Sorting, and Pagination

**What:** All list endpoints accept filter/sort/page parameters and apply them server-side. This is critical for performance -- never load all records client-side.

**When to use:** Every entity list endpoint.

**Backend query builder:**
```csharp
// Generic query parameter model
public class EntityQueryParams
{
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 25;
    public string? SortField { get; set; }
    public string SortDirection { get; set; } = "asc";
    public string? Search { get; set; }
    public List<FilterParam>? Filters { get; set; }
}

public class FilterParam
{
    public string FieldId { get; set; } = string.Empty;
    public string Operator { get; set; } = "equals";
    public string? Value { get; set; }
}

// Paginated response wrapper
public class PagedResult<T>
{
    public List<T> Items { get; set; } = new();
    public int TotalCount { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalPages => (int)Math.Ceiling((double)TotalCount / PageSize);
}
```

**Repository pattern:**
```csharp
public interface ICompanyRepository
{
    Task<PagedResult<Company>> GetPagedAsync(EntityQueryParams queryParams);
    Task<Company?> GetByIdAsync(Guid id);
    Task<Company> CreateAsync(Company company);
    Task UpdateAsync(Company company);
    Task DeleteAsync(Guid id);
}
```

**Server-side filter application:**
```csharp
// In repository implementation
private IQueryable<Company> ApplyFilters(IQueryable<Company> query, List<FilterParam>? filters)
{
    if (filters == null || filters.Count == 0) return query;

    foreach (var filter in filters)
    {
        query = filter.FieldId switch
        {
            // Core fields -- direct column filtering (uses index)
            "name" => ApplyStringFilter(query, c => c.Name, filter),
            "industry" => ApplyStringFilter(query, c => c.Industry, filter),
            "city" => ApplyStringFilter(query, c => c.City, filter),
            // ... other core fields

            // Custom fields -- JSONB containment query (uses GIN index)
            _ when filter.FieldId.Length == 36 => ApplyCustomFieldFilter(query, filter),

            _ => query
        };
    }

    return query;
}
```

### Pattern 3: Ownership Scope Filtering

**What:** The PermissionScope (None/Own/Team/All) must filter entity results based on the user's effective permission.

**When to use:** Every entity list and detail endpoint.

**Implementation:**
```csharp
// In controller or repository
private IQueryable<Company> ApplyOwnershipScope(
    IQueryable<Company> query,
    PermissionScope scope,
    Guid userId,
    List<Guid> teamMemberIds)
{
    return scope switch
    {
        PermissionScope.All => query,  // No additional filter
        PermissionScope.Team => query.Where(c =>
            c.OwnerId == userId || teamMemberIds.Contains(c.OwnerId!.Value)),
        PermissionScope.Own => query.Where(c => c.OwnerId == userId),
        _ => query.Where(_ => false)  // None = no records
    };
}
```

**Key insight:** The user's team member IDs should be cached alongside permissions to avoid repeated queries. Load them once at permission resolution time.

### Pattern 4: Entity Detail Page with Tabs and Timeline

**What:** Entity detail pages follow a consistent layout: header with key info, tabbed navigation for related entities, and a timeline sidebar.

**Structure:**
```
┌─────────────────────────────────────────────────────────────────────────┐
│  < Back to Companies                                    [Edit] [Delete] │
│                                                                         │
│  Company Name                                                           │
│  Industry: Technology  |  Phone: +1 555-0123  |  Owner: Sarah Chen     │
├─────────────────────────────────────────────────────────────────────────┤
│  [Details]  [Contacts]  [Deals]  [Quotes]  [Activities]  [Notes]       │
│                                                                         │
│  ┌─── Details Tab ───┐  ┌────── Timeline ──────┐                       │
│  │ Core Fields       │  │ Feb 16 - Created     │                       │
│  │ Custom Fields     │  │ Feb 17 - Updated     │                       │
│  │ (grouped by       │  │ Feb 18 - Contact     │                       │
│  │  section)          │  │         added        │                       │
│  └───────────────────┘  └──────────────────────┘                       │
└─────────────────────────────────────────────────────────────────────────┘
```

**Angular implementation approach:**
```typescript
@Component({
  selector: 'app-company-detail',
  template: `
    <div class="entity-detail">
      <div class="entity-header">...</div>
      <mat-tab-group>
        <mat-tab label="Details">
          <!-- Core fields + custom fields grouped by section -->
          <app-custom-field-form
            [entityType]="'Company'"
            [customFields]="company()?.customFields"
            [readonly]="true" />
        </mat-tab>
        <mat-tab label="Contacts">
          <!-- Related contacts list -->
        </mat-tab>
        <mat-tab label="Deals" disabled>
          <ng-template matTabLabel>Deals (coming soon)</ng-template>
        </mat-tab>
        <!-- ... more tabs -->
      </mat-tab-group>

      <!-- Timeline sidebar -->
      <app-entity-timeline
        [entityType]="'Company'"
        [entityId]="companyId()" />
    </div>
  `
})
```

**Tabs strategy for Phase 3:**
- **Details** tab: Active, shows core + custom fields
- **Contacts** tab (on Company): Active, shows related contacts mini-list
- **Company** tab (on Contact): Active, shows linked company info
- **Deals** tab: Disabled with "coming soon" label (Phase 4)
- **Quotes** tab: Disabled with "coming soon" label (Phase 6)
- **Activities** tab: Disabled with "coming soon" label (Phase 5)
- **Notes** tab: Disabled with "coming soon" label (Phase 11)

### Pattern 5: Custom Field Form Component (Shared)

**What:** A reusable component that renders form inputs for custom fields based on their field definitions. Used on both create/edit forms and the detail page details tab.

**When to use:** Every entity form and detail page.

```typescript
@Component({
  selector: 'app-custom-field-form',
  standalone: true,
  template: `
    @for (section of groupedFields(); track section.id) {
      <h3>{{ section.name }}</h3>
      @for (field of section.fields; track field.id) {
        @switch (field.fieldType) {
          @case ('Text') {
            <mat-form-field>
              <mat-label>{{ field.label }}</mat-label>
              <input matInput [formControl]="getControl(field.id)"
                     [readonly]="readonly() || getFieldAccess(field.id) === 'readonly'">
            </mat-form-field>
          }
          @case ('Number') { /* number input */ }
          @case ('Date') { /* date picker */ }
          @case ('Dropdown') { /* mat-select with options */ }
          @case ('Checkbox') { /* mat-checkbox */ }
          @case ('MultiSelect') { /* mat-select multiple */ }
          @case ('Currency') { /* number input with currency prefix */ }
          @case ('Relation') { /* autocomplete for related entity */ }
        }
      }
    }
  `
})
export class CustomFieldFormComponent {
  entityType = input.required<string>();
  customFields = input<Record<string, any>>();
  readonly = input<boolean>(false);
  customFieldValues = output<Record<string, any>>();
}
```

### Pattern 6: Entity Timeline Component (Shared)

**What:** A reusable vertical timeline component showing chronological events for an entity.

**When to use:** Company detail, Contact detail (and later Deal detail, etc.)

**Data model:**
```typescript
export interface TimelineEntry {
  id: string;
  type: 'created' | 'updated' | 'contact_linked' | 'deal_created' | 'activity' | 'note' | 'email';
  title: string;
  description: string | null;
  timestamp: string;  // ISO 8601
  userId: string | null;
  userName: string | null;
}
```

**Phase 3 timeline sources:**
- Entity creation event (from `createdAt`)
- Entity update events (from `updatedAt` -- or audit log if implemented)
- Contact linked/unlinked from company
- Future phases add: deal stage changes, activities, notes, emails

**Backend approach:** A simple `/api/companies/{id}/timeline` endpoint that queries the entity's created/updated timestamps and linked contacts. In future phases, this endpoint will aggregate from more sources.

### Pattern 7: Entity Signal Store with Server-Side Paging

**What:** Per-entity NgRx Signal Store that manages list state (data, pagination, filters, sorts) and detail state.

```typescript
interface CompanyState {
  items: CompanyDto[];
  totalCount: number;
  page: number;
  pageSize: number;
  sortField: string | null;
  sortDirection: 'asc' | 'desc';
  filters: ViewFilter[];
  search: string;
  isLoading: boolean;
  selectedCompany: CompanyDetailDto | null;
}

export const CompanyStore = signalStore(
  // Component-provided so each page gets its own instance (matches ViewStore pattern)
  withState<CompanyState>({ /* initial */ }),
  withMethods((store) => {
    const api = inject(ApiService);
    return {
      loadPage(): void {
        // Build query params from state, call API, update items + totalCount
      },
      setSort(field: string, direction: 'asc' | 'desc'): void { /* ... */ },
      setFilters(filters: ViewFilter[]): void { /* ... */ },
      setSearch(search: string): void { /* ... */ },
      loadDetail(id: string): void { /* ... */ },
    };
  })
);
```

### Anti-Patterns to Avoid

- **Client-side filtering/sorting:** Never load all records and filter in the browser. Always pass filter/sort/page params to the API and apply server-side. The dynamic table component already expects `data` and `totalCount` as inputs -- do not pass all records.
- **Skipping permission checks on detail endpoints:** The list endpoint filters by scope, but the detail endpoint (`GET /api/companies/{id}`) must ALSO verify that the user has View permission and that the record is within their scope (own/team/all). Do not assume "if they have the ID, they can see it."
- **Loading custom field definitions on every request:** Custom field definitions should be loaded once per entity type and cached. Use the existing `CustomFieldService.getFieldsByEntityType()` on the frontend, and cache definitions in the entity store or a shared cache.
- **Hardcoding entity types as strings:** Use the existing `EntityType` enum (which already includes Contact, Company, Deal, Activity, Quote, Request, Product) for consistency. String comparisons should match enum names exactly.
- **Building entity forms without custom field integration:** Forms must render both core fields AND custom fields from day one. Do not build "core fields only" forms and add custom fields later -- the custom field infrastructure is ready.
- **Timeline that queries multiple tables with N+1:** Build the timeline endpoint to use a single query (or UNION) that collects timeline entries from the entity itself. Do not make separate queries for "creation event", "update event", "linked contacts", etc.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dynamic table columns | Custom table component | Existing `DynamicTableComponent` | Already built in Phase 2 with column picker, drag-drop reorder, resize, pagination |
| Saved views management | Custom view persistence | Existing `ViewStore` + `ViewsController` | Already built in Phase 2, component-provided for per-page instances |
| Permission checks | Custom if/else logic | `[Authorize(Policy = "Permission:Company:View")]` | PermissionPolicyProvider + PermissionAuthorizationHandler already wired |
| Custom field validation | Manual validation code | Existing `CustomFieldValidator` | Already validates all 9 field types with regex, min/max, required, options |
| Field-level access | Custom hide/show logic | Existing `*appFieldAccess` directive | Already built, reads from PermissionStore |
| Permission-based UI toggle | Manual DOM manipulation | Existing `*appHasPermission` directive | Already built, reactive via signals |
| Filter operators | Custom filter logic | Existing `FilterPanelComponent` | Already built with type-aware operators (text, number, date, select) |
| Column resize | Custom mouse events | Existing `ColumnResizeDirective` | Already built with native DOM events |
| JSONB custom field storage | Separate value table | `Dictionary<string, object?>` + `HasColumnType("jsonb")` | Pattern established, NpgsqlDataSourceBuilder with EnableDynamicJson already configured |
| Tenant isolation | Manual WHERE clauses | Global query filters + RLS | Triple-layer defense already configured |
| Avatar display | Custom image component | Existing `AvatarComponent` | Already renders avatar or initials fallback |
| Quick search | Custom search input | `DynamicTableComponent` toolbar search | Already has a search input in toolbar |
| API error handling | Custom error interceptor | Existing `ApiService` with `handleError` | Already maps HttpErrorResponse to ApiError |

**Key insight:** Phase 3 is a CONSUMER of Phase 2 infrastructure, not a builder of new infrastructure. The primary work is creating entities, wiring them into existing systems, and building the entity-specific UI (detail pages, forms). Nearly every shared component needed already exists.

## Common Pitfalls

### Pitfall 1: Forgetting Triple-Layer Tenant Isolation on New Entities

**What goes wrong:** New Company/Contact/Product entities are created without all three isolation layers, causing cross-tenant data leaks.
**Why it happens:** Developers add the entity and EF config but forget one or more of: (a) TenantId property, (b) global query filter in ApplicationDbContext, (c) RLS policy in rls-setup.sql.
**How to avoid:** Checklist for every new entity: (1) `TenantId` property on entity, (2) `HasQueryFilter(e => ... e.TenantId == ...)` in ApplicationDbContext, (3) RLS policy in rls-setup.sql, (4) DbSet declaration in ApplicationDbContext.
**Warning signs:** Users see data from other organizations.

### Pitfall 2: ExcludeFromMigrations for Cross-Context References

**What goes wrong:** Company entity has `OwnerId` FK to `ApplicationUser`, which is already in ApplicationDbContext. But if Company references Organization (for TenantId FK), and Organization is owned by TenantDbContext, the migration will try to create the organizations table.
**Why it happens:** Same issue from Phase 1-2: Organization is in TenantDbContext, but ApplicationDbContext references it.
**How to avoid:** Organization already has `ExcludeFromMigrations()` in ApplicationDbContext. New entities should NOT declare an FK to Organization -- instead, use `TenantId` as a raw Guid property with query filter only (no navigation property to Organization). The RLS policy provides the actual FK enforcement at the database level.
**Warning signs:** Migration tries to create `organizations` table or throws FK constraint errors.

### Pitfall 3: Ownership Scope Not Applied to GET-by-ID

**What goes wrong:** The list endpoint correctly filters by ownership scope, but `GET /api/companies/{id}` returns any record within the tenant regardless of scope.
**Why it happens:** Developers assume the global query filter (which only filters by TenantId) is sufficient. But ownership scope (Own/Team/All) is a permission concern, not a tenant concern.
**How to avoid:** Every detail endpoint must: (1) Resolve the user's effective permission scope, (2) Check that the record's OwnerId is within scope, (3) Return 403 if out of scope.
**Warning signs:** A Sales Rep (Own scope) can view records owned by other users.

### Pitfall 4: Custom Field GIN Index Not Used for Filtering

**What goes wrong:** Custom field filters do full table scans instead of using the GIN index.
**Why it happens:** Per Phase 2 research pitfall #4: GIN indexes only accelerate containment operators (`@>`), not equality on extracted values (`->>`). EF Core LINQ `.Where(x => x.CustomFields["key"] == value)` translates to `->>` which does NOT use GIN.
**How to avoid:** For custom field filtering, use raw SQL with `@>` containment operator: `WHERE custom_fields @> '{"fieldId": "value"}'::jsonb`. Or add expression indexes for frequently filtered custom field paths. For Phase 3, use `EF.Functions.JsonContains()` if available in Npgsql 10.x, or raw SQL.
**Warning signs:** Slow custom field filter queries on tables with >1K rows.

### Pitfall 5: Contact-Company Link as Separate Table vs. FK

**What goes wrong:** Creating a separate `contact_company` join table when a simple FK on Contact suffices.
**Why it happens:** Over-engineering for many-to-many when the requirement is many-to-one (a contact belongs to one company).
**How to avoid:** CONT-03 says "link contacts to companies" -- this is a simple nullable FK: `Contact.CompanyId -> Company.Id`. A contact can belong to zero or one company. Do NOT create a join table.
**Warning signs:** Unnecessary complexity, extra queries for a simple relationship.

### Pitfall 6: Products Not Ready for Quote Line Items

**What goes wrong:** Product entity doesn't have the fields that the Quote line item system (Phase 6) needs.
**Why it happens:** Building Product with minimal fields and not considering downstream usage.
**How to avoid:** PROD-05 says "products are selectable as line items in quotes." Product needs: `Name`, `Description`, `UnitPrice` (decimal), `SKU` (string, unique per tenant), `Category` (string), `IsActive` (bool for hiding without deleting). The unit price on the product is the DEFAULT price -- quotes can override it per line item.
**Warning signs:** Phase 6 requires schema changes to Product.

### Pitfall 7: Forgetting to Add Entity Type to Permission Seeder

**What goes wrong:** New entities (Company, Contact, Product) don't have permissions seeded for template roles.
**Why it happens:** The `EntityType` enum already includes these values, and the `RoleTemplateSeeder` iterates over `Enum.GetNames<EntityType>()`. So this should work automatically. BUT if the seeder has already run (tenants exist), existing tenants won't get permissions for the new entity types.
**How to avoid:** After adding new entities, run a migration or startup seeder that adds missing permissions to existing template roles. The `RoleTemplateSeeder.SeedTemplateRolesAsync()` is idempotent for role creation but does NOT update existing roles with new entity types. Build a separate `UpdateRolePermissionsForNewEntities()` method.
**Warning signs:** Existing users get 403 on new entity endpoints despite having the Admin role.

### Pitfall 8: Server-Side Sort on Custom Fields

**What goes wrong:** Sort by custom field values throws an error or falls back to client-side sorting.
**Why it happens:** EF Core cannot sort by JSONB dictionary values using standard LINQ. `OrderBy(c => c.CustomFields["fieldId"])` doesn't translate to SQL.
**How to avoid:** For custom field sorting, use raw SQL: `ORDER BY custom_fields->>'fieldId'`. Wrap this in a helper method in the repository. For core field sorting, use dynamic LINQ (switch on field name) or a library like `System.Linq.Dynamic.Core`.
**Warning signs:** Sort on custom fields throws exception or returns unsorted results.

## Code Examples

### Entity Definition Pattern

```csharp
// Company.cs
public class Company
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }

    // Core fields
    public string Name { get; set; } = string.Empty;
    public string? Industry { get; set; }
    public string? Website { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? Address { get; set; }
    public string? City { get; set; }
    public string? State { get; set; }
    public string? Country { get; set; }
    public string? PostalCode { get; set; }
    public string? Size { get; set; }
    public string? Description { get; set; }

    // Ownership (for scope-based permission filtering)
    public Guid? OwnerId { get; set; }
    public ApplicationUser? Owner { get; set; }

    // Custom fields stored as JSONB
    public Dictionary<string, object?> CustomFields { get; set; } = new();

    // Seed data marker
    public bool IsSeedData { get; set; } = false;

    // Audit
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    // Navigation
    public ICollection<Contact> Contacts { get; set; } = new List<Contact>();
}
```

```csharp
// Contact.cs
public class Contact
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }

    // Core fields
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string? MobilePhone { get; set; }
    public string? JobTitle { get; set; }
    public string? Department { get; set; }
    public string? Address { get; set; }
    public string? City { get; set; }
    public string? State { get; set; }
    public string? Country { get; set; }
    public string? PostalCode { get; set; }
    public string? Description { get; set; }

    // Company link (CONT-03: nullable FK, many-to-one)
    public Guid? CompanyId { get; set; }
    public Company? Company { get; set; }

    // Ownership
    public Guid? OwnerId { get; set; }
    public ApplicationUser? Owner { get; set; }

    // Custom fields
    public Dictionary<string, object?> CustomFields { get; set; } = new();

    // Seed data marker
    public bool IsSeedData { get; set; } = false;

    // Audit
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    // Computed
    public string FullName => $"{FirstName} {LastName}".Trim();
}
```

```csharp
// Product.cs
public class Product
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }

    // Core fields (PROD-03)
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public decimal UnitPrice { get; set; }
    public string? SKU { get; set; }
    public string? Category { get; set; }

    // Active status (for hiding without deleting)
    public bool IsActive { get; set; } = true;

    // Custom fields
    public Dictionary<string, object?> CustomFields { get; set; } = new();

    // Seed data marker
    public bool IsSeedData { get; set; } = false;

    // Audit
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
```

### EF Core Configuration Pattern

```csharp
// CompanyConfiguration.cs
public class CompanyConfiguration : IEntityTypeConfiguration<Company>
{
    public void Configure(EntityTypeBuilder<Company> builder)
    {
        builder.ToTable("companies");

        builder.HasKey(c => c.Id);

        builder.Property(c => c.Id)
            .HasColumnName("id");

        builder.Property(c => c.TenantId)
            .HasColumnName("tenant_id")
            .IsRequired();

        builder.Property(c => c.Name)
            .HasColumnName("name")
            .HasMaxLength(200)
            .IsRequired();

        // ... other core field mappings

        builder.Property(c => c.OwnerId)
            .HasColumnName("owner_id");

        builder.Property(c => c.CustomFields)
            .HasColumnName("custom_fields")
            .HasColumnType("jsonb")
            .HasDefaultValueSql("'{}'::jsonb");

        builder.Property(c => c.IsSeedData)
            .HasColumnName("is_seed_data")
            .HasDefaultValue(false);

        builder.Property(c => c.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired();

        builder.Property(c => c.UpdatedAt)
            .HasColumnName("updated_at")
            .IsRequired();

        // Relationships
        builder.HasOne(c => c.Owner)
            .WithMany()
            .HasForeignKey(c => c.OwnerId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasMany(c => c.Contacts)
            .WithOne(ct => ct.Company)
            .HasForeignKey(ct => ct.CompanyId)
            .OnDelete(DeleteBehavior.SetNull);

        // Indexes
        builder.HasIndex(c => c.TenantId)
            .HasDatabaseName("idx_companies_tenant");

        builder.HasIndex(c => new { c.TenantId, c.Name })
            .HasDatabaseName("idx_companies_tenant_name");

        builder.HasIndex(c => c.CustomFields)
            .HasMethod("gin")
            .HasDatabaseName("idx_companies_custom_fields_gin");

        builder.HasIndex(c => c.OwnerId)
            .HasDatabaseName("idx_companies_owner");
    }
}
```

### Controller Pattern with Permission Enforcement

```csharp
[ApiController]
[Route("api/companies")]
[Authorize]
public class CompaniesController : ControllerBase
{
    private readonly ICompanyRepository _repository;
    private readonly IPermissionService _permissionService;
    private readonly ICustomFieldRepository _customFieldRepository;
    private readonly CustomFieldValidator _customFieldValidator;
    private readonly ITenantProvider _tenantProvider;

    // GET /api/companies?page=1&pageSize=25&sortField=name&...
    [Authorize(Policy = "Permission:Company:View")]
    [HttpGet]
    public async Task<IActionResult> GetList([FromQuery] EntityQueryParams queryParams)
    {
        var userId = GetCurrentUserId();
        var scope = await _permissionService.GetEffectivePermissionAsync(
            userId, "Company", "View");

        // Apply ownership scope to query
        var result = await _repository.GetPagedAsync(queryParams, scope.Scope, userId);
        return Ok(result);
    }

    // GET /api/companies/{id}
    [Authorize(Policy = "Permission:Company:View")]
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var company = await _repository.GetByIdAsync(id);
        if (company is null) return NotFound();

        // Verify ownership scope
        var userId = GetCurrentUserId();
        var scope = await _permissionService.GetEffectivePermissionAsync(
            userId, "Company", "View");
        if (!IsWithinScope(company.OwnerId, scope.Scope, userId))
            return Forbid();

        return Ok(CompanyDetailDto.FromEntity(company));
    }

    // POST /api/companies
    [Authorize(Policy = "Permission:Company:Create")]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateCompanyRequest request)
    {
        // Validate custom fields
        if (request.CustomFields?.Count > 0)
        {
            var errors = await _customFieldValidator.ValidateAsync(
                "Company", request.CustomFields);
            if (errors.Count > 0)
                return BadRequest(new { errors });
        }

        var company = new Company
        {
            TenantId = _tenantProvider.GetTenantId()!.Value,
            Name = request.Name,
            // ... map fields
            OwnerId = GetCurrentUserId(),
            CustomFields = request.CustomFields ?? new()
        };

        var created = await _repository.CreateAsync(company);
        return CreatedAtAction(nameof(GetById), new { id = created.Id },
            CompanyDto.FromEntity(created));
    }
}
```

### Angular Entity List Page Pattern

```typescript
@Component({
  selector: 'app-company-list',
  standalone: true,
  imports: [
    DynamicTableComponent,
    FilterPanelComponent,
    FilterChipsComponent,
    ViewSidebarComponent,
    MatButtonModule,
    MatIconModule,
    HasPermissionDirective,
    RouterLink,
  ],
  providers: [ViewStore, CompanyStore],  // Component-provided (not root)
  template: `
    <div class="entity-list-layout">
      <app-view-sidebar
        [entityType]="'Company'"
        (viewSelected)="onViewSelected($event)" />

      <div class="entity-list-content">
        <div class="list-header">
          <h1>Companies</h1>
          <button mat-raised-button color="primary"
                  *appHasPermission="'Company:Create'"
                  routerLink="new">
            <mat-icon>add</mat-icon> New Company
          </button>
        </div>

        <app-filter-chips ... />
        <app-filter-panel ... />

        <app-dynamic-table
          entityType="Company"
          [data]="companyStore.items()"
          [columns]="activeViewColumns()"
          [columnDefinitions]="columnDefs()"
          [totalCount]="companyStore.totalCount()"
          [pageSize]="companyStore.pageSize()"
          [loading]="companyStore.isLoading()"
          (sortChanged)="onSortChanged($event)"
          (pageChanged)="onPageChanged($event)"
          (rowEditClicked)="onRowEdit($event)" />
      </div>
    </div>
  `
})
export class CompanyListComponent implements OnInit {
  viewStore = inject(ViewStore);
  companyStore = inject(CompanyStore);
  customFieldService = inject(CustomFieldService);
  permissionStore = inject(PermissionStore);

  ngOnInit() {
    this.viewStore.loadViews('Company');
    // Load custom field definitions to build column definitions
    this.customFieldService.getFieldsByEntityType('Company').subscribe(fields => {
      // Merge core field definitions + custom field definitions
    });
  }
}
```

### RLS Policy for New Entities

```sql
-- companies
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_companies ON companies
    USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

-- contacts
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_contacts ON contacts
    USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

-- products
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE products FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_products ON products
    USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);
```

### TenantSeeder Update for Phase 3

```csharp
// TenantSeeder.SeedOrganizationDataAsync should now create actual entities
// using the seed manifest that was already defined in Phase 1

public async Task SeedOrganizationDataAsync(Guid organizationId)
{
    var seedManifest = CreateSeedManifest();

    // Create companies
    var companies = new Dictionary<string, Company>();
    foreach (var cs in seedManifest.Companies)
    {
        var company = new Company
        {
            TenantId = organizationId,
            Name = cs.Name,
            Industry = cs.Industry,
            Website = cs.Website,
            Size = cs.Size,
            IsSeedData = true,
        };
        _db.Companies.Add(company);
        companies[cs.Name] = company;
    }

    // Create contacts with company links
    foreach (var cs in seedManifest.Contacts)
    {
        var contact = new Contact
        {
            TenantId = organizationId,
            FirstName = cs.FirstName,
            LastName = cs.LastName,
            Email = cs.Email,
            JobTitle = cs.Title,
            CompanyId = companies.GetValueOrDefault(cs.CompanyRef)?.Id,
            IsSeedData = true,
        };
        _db.Contacts.Add(contact);
    }

    await _db.SaveChangesAsync();
}
```

### Permission Seeder Update for Existing Tenants

```csharp
// After adding new entity types, ensure existing template roles get permissions
// for the new entities. This is needed because RoleTemplateSeeder is idempotent
// at the role level but doesn't update existing roles with new entity types.

public static async Task EnsurePermissionsForAllEntityTypes(
    ApplicationDbContext db, Guid tenantId)
{
    var entityTypes = Enum.GetNames<EntityType>();
    var operations = new[] { "View", "Create", "Edit", "Delete" };

    var templateRoles = await db.Roles
        .IgnoreQueryFilters()
        .Where(r => r.TenantId == tenantId && r.IsTemplate)
        .Include(r => r.Permissions)
        .ToListAsync();

    foreach (var role in templateRoles)
    {
        foreach (var entityType in entityTypes)
        {
            foreach (var operation in operations)
            {
                if (!role.Permissions.Any(p =>
                    p.EntityType == entityType && p.Operation == operation))
                {
                    // Determine scope based on role name
                    var scope = role.Name switch
                    {
                        "Admin" => PermissionScope.All,
                        "Manager" => PermissionScope.Team,
                        "Sales Rep" => operation == "View"
                            ? PermissionScope.Team : PermissionScope.Own,
                        "Viewer" => operation == "View"
                            ? PermissionScope.All : PermissionScope.None,
                        _ => PermissionScope.None
                    };

                    role.Permissions.Add(new RolePermission
                    {
                        RoleId = role.Id,
                        EntityType = entityType,
                        Operation = operation,
                        Scope = scope
                    });
                }
            }
        }
    }

    await db.SaveChangesAsync();
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Client-side filtering | Server-side OFFSET/LIMIT with filter params | Standard practice | Required for tables with >100 rows |
| Separate custom field value table | JSONB column on entity with GIN index | PostgreSQL 9.4+ (mature) | Simpler schema, fewer joins, native JSON operators |
| Template-driven entity forms | Signal-based reactive forms with computed sections | Angular 19 signals | Better performance, less boilerplate |
| REST with manual query strings | Structured `EntityQueryParams` model binding | ASP.NET Core model binding | Type-safe query parameters |

## Open Questions

1. **Dynamic LINQ for sorting on core fields**
   - What we know: Sorting on core fields requires dynamic LINQ (`OrderBy("Name")` instead of `OrderBy(c => c.Name)`).
   - What's unclear: Whether to use `System.Linq.Dynamic.Core` package or build a switch-based field mapper.
   - Recommendation: Use a switch-based field mapper (no new dependency). There are only ~10 core fields per entity -- a switch statement is simpler and more maintainable than a dynamic LINQ library. Save dynamic LINQ for Phase 10 (import/export) if needed.

2. **Custom field sorting via raw SQL**
   - What we know: EF Core cannot ORDER BY on JSONB dictionary values via LINQ.
   - What's unclear: Whether `EF.Functions.JsonContains()` or raw interpolated SQL is the right approach for Npgsql 10.x.
   - Recommendation: Use `FromSqlInterpolated()` or `OrderBy(c => EF.Property<string>(c, "custom_fields"))` with raw SQL fallback for custom field sorts. Test with actual Npgsql 10.x to confirm which approach works.

3. **Timeline data source for Phase 3**
   - What we know: Only entity creation/update and contact-company links exist as timeline events.
   - What's unclear: Whether to store timeline events in a separate `timeline_events` table or derive them from entity timestamps.
   - Recommendation: For Phase 3, derive timeline events from entity data (createdAt, updatedAt, contact links). In Phase 5 (Activities), introduce a proper `audit_log` or `timeline_events` table when activities, notes, and emails need to be aggregated. This avoids premature complexity.

4. **Navbar navigation to entity list pages**
   - What we know: The existing navbar has links to Dashboard, Settings, Profile.
   - What's unclear: Where to put Companies, Contacts, Products links.
   - Recommendation: Add a primary navigation section in the navbar (or sidebar) with CRM entity links. Order: Dashboard, Companies, Contacts, Products (then Deals, Activities, etc. in later phases).

## Sources

### Primary (HIGH confidence)
- Existing codebase examination: All patterns derived from actual Phase 1-2 code in the repository
- `src/GlobCRM.Infrastructure/Persistence/ApplicationDbContext.cs` - Global query filter pattern
- `src/GlobCRM.Infrastructure/Authorization/PermissionService.cs` - Permission resolution with caching
- `src/GlobCRM.Infrastructure/Authorization/RoleTemplateSeeder.cs` - Role seeding with EntityType enum
- `src/GlobCRM.Infrastructure/CustomFields/CustomFieldValidator.cs` - Custom field validation pattern
- `src/GlobCRM.Infrastructure/MultiTenancy/TenantSeeder.cs` - Seed manifest pattern
- `globcrm-web/src/app/shared/components/dynamic-table/` - Dynamic table component
- `globcrm-web/src/app/shared/components/saved-views/view.store.ts` - View store pattern
- `globcrm-web/src/app/core/permissions/permission.store.ts` - Permission store pattern
- `scripts/rls-setup.sql` - RLS policy pattern

### Secondary (MEDIUM confidence)
- Phase 2 research (`02-RESEARCH.md`) - JSONB patterns, GIN indexing, AG Grid vs mat-table decision
- `.planning/research/ARCHITECTURE.md` - Overall system architecture
- `.planning/REQUIREMENTS.md` - Full requirements traceability

### Tertiary (LOW confidence)
- Dynamic LINQ sorting on JSONB - needs validation with actual Npgsql 10.x runtime
- Custom field GIN query performance - needs benchmarking with real data

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Zero new dependencies, all libraries already installed and verified
- Architecture (Entity patterns): HIGH - Direct extrapolation from existing entity patterns (Organization, Invitation, Role, etc.)
- Architecture (Server-side querying): HIGH - Standard OFFSET/LIMIT pagination with EF Core is well-documented
- Architecture (Permission integration): HIGH - PermissionPolicyProvider and PermissionService already wired and working
- Architecture (Custom field integration): HIGH - CustomFieldValidator, JSONB mapping, and GIN indexes already built
- Architecture (Entity timeline): MEDIUM - Timeline is new; derived-from-entity-data approach is simple but may need refactoring in Phase 5
- Architecture (Angular entity pages): HIGH - Follows established patterns (settings pages, profile pages)
- Pitfalls: HIGH - Most pitfalls are direct observations from Phase 1-2 experience

**Research date:** 2026-02-16
**Valid until:** 2026-03-16 (30 days -- stable technologies, no external dependency changes)

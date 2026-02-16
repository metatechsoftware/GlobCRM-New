# Phase 2: Core Infrastructure - Research

**Researched:** 2026-02-16
**Domain:** RBAC permissions, custom fields (JSONB), dynamic tables, user profiles
**Confidence:** HIGH

## Summary

Phase 2 builds the permission system (RBAC), custom fields architecture, dynamic table foundation, and user profile/preferences on top of the Phase 1 foundation (.NET 10 + Angular 19 + PostgreSQL 17 + Finbuckle multi-tenancy). The codebase already has ASP.NET Core Identity with simple Admin/Member roles (a `UserRole` enum), JWT authentication, two DbContexts (ApplicationDbContext + TenantDbContext), global query filters for tenant isolation, and an Angular frontend using @ngrx/signals for state management and Angular Material for UI.

The RBAC system requires a custom permission model stored in the database (not Identity roles), using ASP.NET Core's `IAuthorizationHandler` and `IAuthorizationPolicyProvider` for dynamic policy evaluation. Custom fields use PostgreSQL JSONB with GIN indexes, mapped via Npgsql EF Core's `HasColumnType("jsonb")`. The dynamic table should use Angular Material's `mat-table` (already in the project) with CDK drag-drop for column reordering and custom resize directives. Saved Views are persisted server-side. User profile extends the existing `ApplicationUser` entity with additional fields and a JSONB preferences column.

**Primary recommendation:** Build a custom permission engine using ASP.NET Core's authorization infrastructure (IAuthorizationHandler + IAuthorizationPolicyProvider) backed by database-stored role/permission entities. Use Angular Material mat-table with CDK drag-drop for dynamic tables rather than introducing AG Grid. Store custom field values in a JSONB column with GIN indexing. Use SkiaSharp (free) for server-side avatar processing.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Permission model & roles
- Predefined role templates (Admin, Manager, Sales Rep, Viewer) that admins can clone and customize
- Full granularity: CRUD per entity + ownership scope (own/team/all records) + field-level access (hidden/read-only/editable)
- Teams inherit a default role; users in the team get that role's permissions
- User can also have directly assigned roles
- Conflict resolution: most permissive wins (union of all permissions from direct + team-inherited roles)

#### Custom field creation
- Dual creation path: Settings page for bulk management + inline "Add Field" on entity pages for quick creation
- Advanced validation: required, min/max length/value, regex patterns, unique constraints, conditional required
- Soft delete: deleted fields are hidden from UI but data preserved in JSONB; admin can restore
- Supported types: text, number, date, dropdown, checkbox, multi-select, currency, file, relation

#### Table interaction & Views
- Filtering: quick search bar + filter chips for common fields + expandable advanced filter panel for complex queries
- No inline cell editing; quick edit icon per row opens compact edit form (row expand or side panel)
- Saved Views displayed in a left sidebar grouped by Personal / Team; click to load
- Column configuration: drag-and-drop reorder on headers, column picker dropdown to show/hide, resize by dragging column borders

#### User profile & preferences
- Rich profile: name, email, avatar, phone, job title, department, timezone, language, bio, social links, work schedule, reporting manager, skills/tags
- Avatar: upload with crop dialog; auto-generated colored circle with initials as fallback
- Configurable preferences: theme (light/dark), language, timezone, date format + email notification toggles per event type
- Team directory: all users in the organization can view each other's profiles

### Claude's Discretion
- Custom field grouping into sections on entity detail pages (flat list vs admin-defined sections)
- Permission matrix UI layout and interaction patterns
- Exact filter panel component design
- Loading states and error handling patterns
- Table pagination strategy (page-based vs infinite scroll)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

## Standard Stack

### Core (Already in Project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Angular | 19.2.x | Frontend framework | Already installed, signals-based |
| Angular Material | 19.2.x | UI component library | Already installed, mat-table for dynamic tables |
| Angular CDK | 19.2.x | Drag-drop, overlay, virtual scroll | Already installed, used for column reorder |
| @ngrx/signals | 19.2.x | Signal-based state management | Already installed, used for AuthStore |
| ASP.NET Core | 10.0.3 | Backend framework | Already installed, Identity + authorization |
| EF Core + Npgsql | 10.0.x | ORM + PostgreSQL provider | Already installed, JSONB support built-in |
| FluentValidation | 12.1.1 / 11.3.1 | Request validation | Already installed in Application + Api layers |
| Finbuckle.MultiTenant | 10.0.3 | Multi-tenancy | Already installed, tenant isolation |

### New Dependencies Required
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| SkiaSharp | 3.x | Server-side image resize/crop for avatars | Free (MIT license), cross-platform, no commercial license required unlike ImageSharp ($4999) |
| ngx-image-cropper | 9.1.x | Client-side avatar crop dialog | Angular 17.3+ compatible, standalone component, actively maintained, 1M+ weekly npm downloads |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Angular Material mat-table | AG Grid Community | AG Grid has richer built-in features (column state API, filters) but column state save/restore is Enterprise-only ($). mat-table is already installed, lighter, and column state can be managed manually with less code. AG Grid adds 300KB+ to bundle. |
| SkiaSharp | ImageSharp (SixLabors) | ImageSharp has cleaner API but requires $4999 commercial license for companies over $1M revenue. SkiaSharp is MIT-licensed and free for all use. |
| ngx-image-cropper | ngx-smart-cropper | ngx-smart-cropper is newer and signals-optimized but has smaller community (fewer downloads). ngx-image-cropper is battle-tested with larger ecosystem. |
| Custom RBAC tables | ASP.NET Identity Roles + Claims | Identity roles are flat strings; they cannot model per-entity CRUD + ownership scope + field-level access. Custom tables are necessary for the required granularity. |

### Recommendation: Use mat-table (not AG Grid)

AG Grid was considered but rejected for these reasons:
1. **Column state save/restore** (`getColumnState()` / `applyColumnState()`) is an Enterprise-only feature requiring a paid license
2. The project already has Angular Material installed -- adding AG Grid duplicates functionality and increases bundle size
3. mat-table with CDK drag-drop handles all required features (dynamic columns, reorder, show/hide)
4. Column resize requires a custom directive for mat-table, but this is ~50 lines of code versus a paid license

### Recommendation: Admin-Defined Sections for Custom Fields

For the discretion item "custom field grouping," use admin-defined sections:
- Admin creates named sections (e.g., "Contact Info", "Financial", "Custom")
- Each custom field belongs to a section (default: "Custom")
- Entity detail pages render fields grouped by section with collapsible headers
- This scales better than flat lists as field count grows and gives admins organizational control

### Recommendation: Page-Based Pagination

For the discretion item "table pagination strategy," use page-based pagination:
- Page-based is simpler to implement with server-side queries (`OFFSET`/`LIMIT`)
- Provides clear URL state (e.g., `?page=3&pageSize=25`)
- Works naturally with saved Views (page size is part of View config)
- Infinite scroll adds complexity (virtual scrolling, scroll position restoration) with minimal UX benefit for CRM data tables
- Default page size: 25 rows, configurable per View (10, 25, 50, 100)

### Recommendation: Permission Matrix UI

For the discretion item "permission matrix UI layout":
- Use a matrix/grid layout: rows = entity types, columns = CRUD operations
- Each cell contains a dropdown with scope options (None / Own / Team / All)
- Field-level permissions shown in an expandable row below each entity
- "Clone from template" button pre-fills the matrix from a template role
- This is the standard pattern used by Salesforce, HubSpot, and other CRM platforms

**Installation (backend):**
```bash
dotnet add src/GlobCRM.Infrastructure/GlobCRM.Infrastructure.csproj package SkiaSharp --version 3.*
```

**Installation (frontend):**
```bash
cd globcrm-web && npm install ngx-image-cropper@^9.1.0
```

## Architecture Patterns

### Recommended Project Structure

**Backend additions:**
```
src/GlobCRM.Domain/
├── Entities/
│   ├── Role.cs                    # Custom role entity (replaces UserRole enum for Phase 2)
│   ├── RolePermission.cs          # Per-entity CRUD + scope permissions
│   ├── RoleFieldPermission.cs     # Field-level access (hidden/read-only/editable)
│   ├── Team.cs                    # Team entity with default role
│   ├── TeamMember.cs              # User-team membership
│   ├── UserRole.cs                # KEEP existing enum for backward compat, add new UserRoleAssignment
│   ├── UserRoleAssignment.cs      # Direct user-role assignment (many-to-many)
│   ├── CustomFieldDefinition.cs   # Metadata: field name, type, entity, validations
│   ├── CustomFieldSection.cs      # Grouping for custom fields on detail pages
│   ├── SavedView.cs               # View config: columns, filters, sorts, owner
│   └── UserPreferences.cs         # JSONB preferences (theme, locale, notifications)
│
├── Enums/
│   ├── PermissionScope.cs         # None, Own, Team, All
│   ├── FieldAccessLevel.cs        # Hidden, ReadOnly, Editable
│   ├── CustomFieldType.cs         # Text, Number, Date, Dropdown, etc.
│   └── EntityType.cs              # Contact, Company, Deal, etc. (enum for permission targets)
│
└── Interfaces/
    ├── IPermissionService.cs       # Check permissions at runtime
    ├── ICustomFieldRepository.cs   # Custom field CRUD
    └── IViewRepository.cs          # Saved view CRUD

src/GlobCRM.Infrastructure/
├── Authorization/
│   ├── PermissionAuthorizationHandler.cs     # IAuthorizationHandler implementation
│   ├── PermissionPolicyProvider.cs           # IAuthorizationPolicyProvider
│   ├── PermissionRequirement.cs              # IAuthorizationRequirement
│   ├── PermissionService.cs                  # Runtime permission checks (caching)
│   └── AuthorizationServiceExtensions.cs     # DI registration
│
├── Persistence/
│   ├── Configurations/
│   │   ├── RoleConfiguration.cs
│   │   ├── RolePermissionConfiguration.cs
│   │   ├── RoleFieldPermissionConfiguration.cs
│   │   ├── TeamConfiguration.cs
│   │   ├── TeamMemberConfiguration.cs
│   │   ├── UserRoleAssignmentConfiguration.cs
│   │   ├── CustomFieldDefinitionConfiguration.cs
│   │   ├── CustomFieldSectionConfiguration.cs
│   │   ├── SavedViewConfiguration.cs
│   │   └── UserPreferencesConfiguration.cs
│   └── Repositories/
│       ├── PermissionRepository.cs
│       ├── CustomFieldRepository.cs
│       └── ViewRepository.cs
│
├── Images/
│   ├── AvatarService.cs                      # SkiaSharp resize/crop
│   └── ImageServiceExtensions.cs             # DI registration
│
└── CustomFields/
    └── CustomFieldServiceExtensions.cs       # DI registration

src/GlobCRM.Api/
├── Controllers/
│   ├── RolesController.cs
│   ├── TeamsController.cs
│   ├── CustomFieldsController.cs
│   ├── ViewsController.cs
│   ├── ProfileController.cs
│   └── TeamDirectoryController.cs
└── Filters/
    └── PermissionAuthorizationFilter.cs      # Action filter for declarative permission checks
```

**Frontend additions:**
```
globcrm-web/src/app/
├── core/
│   ├── permissions/
│   │   ├── permission.models.ts
│   │   ├── permission.service.ts          # Fetches user permissions, caches
│   │   ├── permission.store.ts            # Signal store for current user permissions
│   │   ├── has-permission.directive.ts    # *hasPermission structural directive
│   │   └── permission.guard.ts           # Route guard checking entity access
│   └── custom-fields/
│       ├── custom-field.models.ts
│       └── custom-field.service.ts
│
├── shared/
│   ├── components/
│   │   ├── dynamic-table/
│   │   │   ├── dynamic-table.component.ts     # mat-table wrapper with dynamic columns
│   │   │   ├── dynamic-table.component.html
│   │   │   ├── column-picker.component.ts     # Show/hide columns dropdown
│   │   │   ├── column-resize.directive.ts     # Drag-to-resize column borders
│   │   │   └── filter-panel.component.ts      # Expandable advanced filter panel
│   │   ├── saved-views/
│   │   │   ├── view-sidebar.component.ts      # Left sidebar with Personal/Team views
│   │   │   ├── view.models.ts
│   │   │   └── view.store.ts                  # Signal store per entity view
│   │   ├── avatar/
│   │   │   ├── avatar.component.ts            # Displays avatar or initials fallback
│   │   │   └── avatar-upload.component.ts     # Upload + crop dialog
│   │   └── filter-chips/
│   │       └── filter-chips.component.ts      # Quick filter chips bar
│   └── directives/
│       └── field-access.directive.ts          # Applies hidden/readonly based on permissions
│
├── features/
│   ├── settings/
│   │   ├── roles/                             # Role management (CRUD, permission matrix)
│   │   ├── teams/                             # Team management
│   │   ├── custom-fields/                     # Custom field settings page
│   │   └── settings.routes.ts
│   ├── profile/
│   │   ├── profile-edit/                      # Edit own profile
│   │   ├── profile-view/                      # View any profile
│   │   ├── team-directory/                    # Browse organization members
│   │   └── profile.routes.ts
│   └── ...entity pages (Phase 3)
```

### Pattern 1: Custom Permission Authorization Handler

**What:** A dynamic authorization system that checks database-stored permissions at runtime, using ASP.NET Core's built-in `IAuthorizationHandler` and `IAuthorizationPolicyProvider`.

**When to use:** Every API endpoint that requires per-entity, per-operation permission checks.

**Architecture:**

```csharp
// Source: https://learn.microsoft.com/en-us/aspnet/core/security/authorization/iauthorizationpolicyprovider

// 1. Requirement: carries the entity type + operation + optional ownership scope
public class PermissionRequirement : IAuthorizationRequirement
{
    public string EntityType { get; }     // e.g., "Contact", "Deal"
    public string Operation { get; }       // e.g., "View", "Create", "Edit", "Delete"

    public PermissionRequirement(string entityType, string operation)
    {
        EntityType = entityType;
        Operation = operation;
    }
}

// 2. Handler: checks user's effective permissions (direct + team-inherited, union/most permissive)
public class PermissionAuthorizationHandler : AuthorizationHandler<PermissionRequirement>
{
    private readonly IPermissionService _permissionService;

    public PermissionAuthorizationHandler(IPermissionService permissionService)
    {
        _permissionService = permissionService;
    }

    protected override async Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        PermissionRequirement requirement)
    {
        var userId = context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (userId == null) return;

        var effectivePermission = await _permissionService
            .GetEffectivePermissionAsync(
                Guid.Parse(userId),
                requirement.EntityType,
                requirement.Operation);

        if (effectivePermission.Scope != PermissionScope.None)
        {
            context.Succeed(requirement);
        }
    }
}

// 3. Policy Provider: dynamically creates policies from attribute parameters
public class PermissionPolicyProvider : IAuthorizationPolicyProvider
{
    private readonly DefaultAuthorizationPolicyProvider _fallback;

    public PermissionPolicyProvider(IOptions<AuthorizationOptions> options)
    {
        _fallback = new DefaultAuthorizationPolicyProvider(options);
    }

    public Task<AuthorizationPolicy?> GetPolicyAsync(string policyName)
    {
        // Policy names follow pattern: "Permission:Entity:Operation"
        if (policyName.StartsWith("Permission:"))
        {
            var parts = policyName.Split(':');
            var policy = new AuthorizationPolicyBuilder()
                .AddRequirements(new PermissionRequirement(parts[1], parts[2]))
                .Build();
            return Task.FromResult<AuthorizationPolicy?>(policy);
        }
        return _fallback.GetPolicyAsync(policyName);
    }

    public Task<AuthorizationPolicy> GetDefaultPolicyAsync() => _fallback.GetDefaultPolicyAsync();
    public Task<AuthorizationPolicy?> GetFallbackPolicyAsync() => _fallback.GetFallbackPolicyAsync();
}

// 4. Usage on controller:
[Authorize(Policy = "Permission:Contact:View")]
[HttpGet]
public async Task<IActionResult> GetContacts() { ... }
```

**DI Registration:**
```csharp
// In AuthorizationServiceExtensions.cs
services.AddSingleton<IAuthorizationPolicyProvider, PermissionPolicyProvider>();
services.AddScoped<IAuthorizationHandler, PermissionAuthorizationHandler>();
services.AddScoped<IPermissionService, PermissionService>();
```

### Pattern 2: Effective Permission Resolution (Most Permissive Wins)

**What:** Algorithm to compute a user's effective permissions from all assigned roles (direct + team-inherited), applying the "most permissive wins" conflict resolution.

**When to use:** Every permission check.

```csharp
// Source: Custom pattern based on CRM industry standard (Salesforce, HubSpot)
public class PermissionService : IPermissionService
{
    private readonly ApplicationDbContext _db;
    private readonly IMemoryCache _cache;

    public async Task<EffectivePermission> GetEffectivePermissionAsync(
        Guid userId, string entityType, string operation)
    {
        var cacheKey = $"perm:{userId}:{entityType}:{operation}";
        if (_cache.TryGetValue(cacheKey, out EffectivePermission? cached))
            return cached!;

        // Get all roles: direct assignments + team-inherited
        var directRoleIds = await _db.UserRoleAssignments
            .Where(ura => ura.UserId == userId)
            .Select(ura => ura.RoleId)
            .ToListAsync();

        var teamRoleIds = await _db.TeamMembers
            .Where(tm => tm.UserId == userId)
            .Select(tm => tm.Team.DefaultRoleId)
            .Where(rid => rid != null)
            .Select(rid => rid!.Value)
            .ToListAsync();

        var allRoleIds = directRoleIds.Union(teamRoleIds).Distinct().ToList();

        // Get all permissions for these roles on this entity+operation
        var permissions = await _db.RolePermissions
            .Where(rp => allRoleIds.Contains(rp.RoleId)
                      && rp.EntityType == entityType
                      && rp.Operation == operation)
            .ToListAsync();

        // Most permissive wins: All > Team > Own > None
        var maxScope = permissions.Any()
            ? permissions.Max(p => p.Scope)
            : PermissionScope.None;

        var result = new EffectivePermission(entityType, operation, maxScope);
        _cache.Set(cacheKey, result, TimeSpan.FromMinutes(5));
        return result;
    }

    // Invalidate cache when roles/teams change
    public void InvalidateUserPermissions(Guid userId)
    {
        // Evict all cached permissions for this user
    }
}
```

### Pattern 3: JSONB Custom Fields Storage

**What:** Store custom field values as a JSONB column on each entity, with GIN indexing for query performance.

**When to use:** Every entity that supports custom fields (Contact, Company, Deal, etc.).

```csharp
// Source: https://www.npgsql.org/efcore/mapping/json.html

// Entity with custom fields
public class Contact
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    // ... core fields

    /// <summary>
    /// Custom field values stored as JSONB.
    /// Key = CustomFieldDefinition.Id (Guid as string), Value = field value.
    /// </summary>
    public Dictionary<string, object?> CustomFields { get; set; } = new();
}

// Configuration
public class ContactConfiguration : IEntityTypeConfiguration<Contact>
{
    public void Configure(EntityTypeBuilder<Contact> builder)
    {
        builder.ToTable("contacts");

        builder.Property(c => c.CustomFields)
            .HasColumnName("custom_fields")
            .HasColumnType("jsonb")
            .HasDefaultValueSql("'{}'::jsonb");

        // GIN index for JSONB containment queries
        builder.HasIndex(c => c.CustomFields)
            .HasMethod("gin")
            .HasDatabaseName("idx_contacts_custom_fields_gin");
    }
}
```

**NpgsqlDataSource configuration (in DependencyInjection.cs):**
```csharp
// Required for Dictionary<string, object?> serialization to JSONB
var dataSourceBuilder = new NpgsqlDataSourceBuilder(connectionString);
dataSourceBuilder.EnableDynamicJson();
var dataSource = dataSourceBuilder.Build();

services.AddDbContext<ApplicationDbContext>((sp, options) =>
{
    options.UseNpgsql(dataSource);
    // ... interceptors
});
```

### Pattern 4: Custom Field Definition Entity

**What:** Metadata table that defines available custom fields per entity type per tenant.

```csharp
public class CustomFieldDefinition
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public string EntityType { get; set; } = string.Empty;  // "Contact", "Company", "Deal"
    public string Name { get; set; } = string.Empty;         // Internal name (snake_case)
    public string Label { get; set; } = string.Empty;        // Display label
    public CustomFieldType FieldType { get; set; }
    public int SortOrder { get; set; }
    public Guid? SectionId { get; set; }                     // Optional grouping section
    public CustomFieldSection? Section { get; set; }

    // Validation rules stored as JSONB
    public CustomFieldValidation Validation { get; set; } = new();

    // Dropdown/multi-select options stored as JSONB
    public List<FieldOption>? Options { get; set; }

    // Relation field: target entity type
    public string? RelationEntityType { get; set; }

    // Soft delete
    public bool IsDeleted { get; set; } = false;
    public DateTimeOffset? DeletedAt { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public class CustomFieldValidation
{
    public bool Required { get; set; }
    public int? MinLength { get; set; }
    public int? MaxLength { get; set; }
    public decimal? MinValue { get; set; }
    public decimal? MaxValue { get; set; }
    public string? RegexPattern { get; set; }
    public bool Unique { get; set; }
    public string? ConditionalRequiredField { get; set; }  // Field that triggers required
    public string? ConditionalRequiredValue { get; set; }  // Value that triggers required
}

public class FieldOption
{
    public string Value { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public string? Color { get; set; }  // For display in dropdowns/chips
    public int SortOrder { get; set; }
}
```

### Pattern 5: Saved View Entity and Column State

**What:** Server-side persistence of table column configuration, filters, sorting, and grouping.

```csharp
public class SavedView
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public string EntityType { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;

    // Owner: null = team-wide (admin-created), non-null = personal
    public Guid? OwnerId { get; set; }
    public ApplicationUser? Owner { get; set; }

    // Is this the default view for the team?
    public bool IsTeamDefault { get; set; }

    // Column configuration as JSONB
    public List<ViewColumn> Columns { get; set; } = new();

    // Filter configuration as JSONB
    public List<ViewFilter> Filters { get; set; } = new();

    // Sort configuration as JSONB
    public List<ViewSort> Sorts { get; set; } = new();

    // Pagination
    public int PageSize { get; set; } = 25;

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public class ViewColumn
{
    public string FieldId { get; set; } = string.Empty;  // Core field name or CustomFieldDefinition.Id
    public bool IsCustomField { get; set; }
    public int Width { get; set; } = 150;
    public int SortOrder { get; set; }
    public bool Visible { get; set; } = true;
}

public class ViewFilter
{
    public string FieldId { get; set; } = string.Empty;
    public string Operator { get; set; } = string.Empty;  // "equals", "contains", "gt", "lt", etc.
    public string? Value { get; set; }
}

public class ViewSort
{
    public string FieldId { get; set; } = string.Empty;
    public string Direction { get; set; } = "asc";  // "asc" or "desc"
    public int SortOrder { get; set; }
}
```

### Pattern 6: Angular Dynamic Table with mat-table

**What:** Reusable dynamic table component wrapping mat-table with runtime column configuration, CDK drag-drop column reorder, and custom resize directive.

**When to use:** Every entity list page.

```typescript
// Source: Angular Material CDK docs + community patterns
// dynamic-table.component.ts

@Component({
  selector: 'app-dynamic-table',
  standalone: true,
  imports: [
    MatTableModule, MatSortModule, MatPaginatorModule,
    CdkDragDrop, CdkDropList, CdkDrag,
    ColumnResizeDirective
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dynamic-table.component.html'
})
export class DynamicTableComponent {
  // Inputs
  entityType = input.required<string>();
  dataSource = input.required<MatTableDataSource<any>>();
  columns = input.required<ViewColumn[]>();

  // Outputs
  columnOrderChanged = output<ViewColumn[]>();
  columnResized = output<{fieldId: string, width: number}>();
  rowEditClicked = output<any>();

  // Computed displayed columns from visible columns
  displayedColumns = computed(() =>
    this.columns()
      .filter(c => c.visible)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(c => c.fieldId)
  );

  // CDK drag-drop: reorder columns
  onColumnDrop(event: CdkDragDrop<string[]>) {
    const cols = [...this.columns()];
    moveItemInArray(cols, event.previousIndex, event.currentIndex);
    cols.forEach((col, i) => col.sortOrder = i);
    this.columnOrderChanged.emit(cols);
  }
}
```

```html
<!-- dynamic-table.component.html -->
<div class="table-container">
  <table mat-table [dataSource]="dataSource()" matSort
         cdkDropListGroup>
    <!-- Dynamic columns -->
    @for (col of displayedColumns(); track col) {
      <ng-container [matColumnDef]="col">
        <th mat-header-cell *matHeaderCellDef
            mat-sort-header
            cdkDropList cdkDrag
            appColumnResize
            [style.width.px]="getColumnWidth(col)">
          {{ getColumnLabel(col) }}
        </th>
        <td mat-cell *matCellDef="let row">
          {{ getCellValue(row, col) }}
        </td>
      </ng-container>
    }

    <!-- Actions column -->
    <ng-container matColumnDef="actions">
      <th mat-header-cell *matHeaderCellDef>Actions</th>
      <td mat-cell *matCellDef="let row">
        <button mat-icon-button (click)="rowEditClicked.emit(row)">
          <mat-icon>edit</mat-icon>
        </button>
      </td>
    </ng-container>

    <tr mat-header-row *matHeaderRowDef="displayedColumns()"></tr>
    <tr mat-row *matRowDef="let row; columns: displayedColumns()"></tr>
  </table>

  <mat-paginator [pageSizeOptions]="[10, 25, 50, 100]"
                 [pageSize]="25"
                 showFirstLastButtons>
  </mat-paginator>
</div>
```

### Pattern 7: Permission-Aware Angular Directive

**What:** Structural directive that shows/hides UI elements based on the user's effective permissions.

```typescript
// has-permission.directive.ts
@Directive({
  selector: '[appHasPermission]',
  standalone: true,
})
export class HasPermissionDirective implements OnInit {
  private permissionStore = inject(PermissionStore);
  private templateRef = inject(TemplateRef<any>);
  private viewContainer = inject(ViewContainerRef);

  @Input() appHasPermission!: string;  // "Contact:Edit" format

  private hasView = false;

  ngOnInit() {
    effect(() => {
      const [entity, operation] = this.appHasPermission.split(':');
      const allowed = this.permissionStore.hasPermission(entity, operation)();

      if (allowed && !this.hasView) {
        this.viewContainer.createEmbeddedView(this.templateRef);
        this.hasView = true;
      } else if (!allowed && this.hasView) {
        this.viewContainer.clear();
        this.hasView = false;
      }
    });
  }
}

// Usage in template:
// <button *appHasPermission="'Contact:Edit'" (click)="edit()">Edit</button>
```

### Pattern 8: User Profile with JSONB Preferences

**What:** Extend ApplicationUser with profile fields and store variable preferences in JSONB.

```csharp
// Extend existing ApplicationUser entity
public class ApplicationUser : IdentityUser<Guid>
{
    // ... existing fields (OrganizationId, FirstName, LastName, IsActive, etc.)

    // New profile fields
    public string? Phone { get; set; }
    public string? JobTitle { get; set; }
    public string? Department { get; set; }
    public string? Timezone { get; set; }
    public string? Language { get; set; }
    public string? Bio { get; set; }
    public string? AvatarUrl { get; set; }          // Path to uploaded avatar
    public string? AvatarColor { get; set; }         // Hex color for initials fallback

    // Social links as JSONB
    public Dictionary<string, string>? SocialLinks { get; set; }

    // Work schedule as JSONB
    public WorkSchedule? WorkSchedule { get; set; }

    // Reporting manager
    public Guid? ReportingManagerId { get; set; }
    public ApplicationUser? ReportingManager { get; set; }

    // Skills/tags as JSONB array
    public List<string>? Skills { get; set; }

    // Preferences as JSONB (theme, notifications, date format, etc.)
    public UserPreferencesData Preferences { get; set; } = new();
}

public class UserPreferencesData
{
    public string Theme { get; set; } = "light";        // "light" or "dark"
    public string Language { get; set; } = "en";
    public string Timezone { get; set; } = "UTC";
    public string DateFormat { get; set; } = "MM/dd/yyyy";
    public Dictionary<string, bool> EmailNotifications { get; set; } = new()
    {
        ["task_assigned"] = true,
        ["deal_updated"] = true,
        ["mention"] = true,
        ["weekly_report"] = true
    };
}

public class WorkSchedule
{
    public List<string> WorkDays { get; set; } = new() { "Mon", "Tue", "Wed", "Thu", "Fri" };
    public string StartTime { get; set; } = "09:00";
    public string EndTime { get; set; } = "17:00";
}
```

### Anti-Patterns to Avoid

- **Storing permissions in JWT claims:** JWT tokens are issued at login and cannot be revoked mid-session. Permissions must be checked against the database (with caching) so changes take effect immediately, not after re-login.
- **Flat permission strings:** Using flat strings like "Contact.View" in a claim loses the ownership scope dimension. Use structured entities with an explicit Scope enum.
- **JSONB for everything:** Do not store entity core fields in JSONB. Only use JSONB for the dynamic/custom portion (custom fields, preferences, validation rules). Core fields stay as regular columns with proper indexes.
- **Loading all permissions per request:** Cache effective permissions per user with a short TTL (5 minutes). Invalidate on role/team changes.
- **Mixing custom field definition with value:** Keep field definitions (metadata) in a separate table from field values (JSONB on entities). This allows querying "what fields exist" without loading entity data.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Authorization pipeline | Custom middleware checking permissions | ASP.NET Core IAuthorizationHandler + IAuthorizationPolicyProvider | Integrates with [Authorize] attributes, handles authentication schemes, provides proper 401/403 responses |
| Image resize/crop | Manual pixel manipulation | SkiaSharp (server) + ngx-image-cropper (client) | Image format handling, EXIF rotation, memory management, color profiles are deceptively complex |
| JSONB serialization | Manual JSON string building | Npgsql + EnableDynamicJson() | Handles type mapping, null handling, nested objects, and parameterized queries correctly |
| Table drag-drop | Custom mouse event handlers | Angular CDK DragDrop module | Handles touch events, accessibility, animation, scroll during drag, drop zones |
| Form validation | Custom validators for each field type | FluentValidation (server) + Angular Reactive Forms (client) | Already in project; supports conditional validation, cross-field validation, custom error messages |
| Caching | Custom Dictionary-based cache | IMemoryCache (built-in) | Thread-safe, size limits, expiration policies, cache entry eviction callbacks |

**Key insight:** The authorization and custom field domains both have subtle complexity that compounds. Building a custom authorization middleware seems simple but misses scheme handling, policy combining, and proper HTTP semantics. Similarly, JSONB querying through raw SQL seems straightforward but loses parameterization safety and type mapping.

## Common Pitfalls

### Pitfall 1: Permission Cache Staleness
**What goes wrong:** Admin changes a user's role, but the user retains old permissions until cache expires or they re-login.
**Why it happens:** In-memory cache (IMemoryCache) is per-process. No invalidation mechanism when role assignments change.
**How to avoid:** (a) Short cache TTL (5 minutes). (b) Explicitly invalidate cache entries when roles/teams are modified via the PermissionService.InvalidateUserPermissions() method. (c) In production with multiple instances, consider a distributed cache (Redis) or SignalR-based invalidation broadcast.
**Warning signs:** "I changed the user's role but they can still access..."

### Pitfall 2: N+1 Queries in Permission Resolution
**What goes wrong:** Each permission check triggers separate DB queries for direct roles, team roles, and permissions.
**Why it happens:** Naive implementation queries per check rather than batching.
**How to avoid:** Load ALL of a user's effective permissions in a single query (JOIN across UserRoleAssignments + TeamMembers + RolePermissions) and cache the entire permission set. Check against the cached set, not the database.
**Warning signs:** Slow API responses after adding permission checks; high DB query count in logs.

### Pitfall 3: JSONB Dictionary Serialization Failures
**What goes wrong:** `Dictionary<string, object?>` fails to serialize/deserialize with Npgsql, throwing "Type requires dynamic JSON serialization" errors.
**Why it happens:** Npgsql requires explicit opt-in for `object` types in JSONB columns via `EnableDynamicJson()` on `NpgsqlDataSourceBuilder`.
**How to avoid:** Configure NpgsqlDataSourceBuilder with `.EnableDynamicJson()` BEFORE building the data source. Pass the built NpgsqlDataSource to `UseNpgsql()`.
**Warning signs:** Runtime exceptions on first entity save/load with custom fields.

### Pitfall 4: GIN Index Not Used for Queries
**What goes wrong:** JSONB queries do full table scans despite GIN index existing.
**Why it happens:** GIN indexes only accelerate containment operators (`@>`, `?`, `?|`, `?&`), not equality on extracted values (`->>` with `=`). EF Core LINQ `.Where(x => x.CustomFields["key"] == value)` translates to `->>` which does NOT use GIN.
**How to avoid:** For filtering custom fields, use `EF.Functions.JsonContains()` which translates to `@>` (uses GIN index). For specific field lookups, consider expression indexes on frequently queried custom field paths.
**Warning signs:** Slow custom field filter queries on tables with >10K rows.

### Pitfall 5: Dual DbContext Migration Ordering
**What goes wrong:** New tables in ApplicationDbContext reference entities in TenantDbContext (e.g., Role references Organization), causing FK failures during migration.
**Why it happens:** Same issue as Phase 1 -- shared entities between contexts must be excluded from migrations in the non-owning context.
**How to avoid:** All new entities (Role, Team, CustomFieldDefinition, SavedView, UserRoleAssignment, etc.) go into ApplicationDbContext since they are tenant-scoped. Apply `ExcludeFromMigrations()` for Organization references. Run TenantDbContext migrations FIRST.
**Warning signs:** FK constraint errors during `dotnet ef database update`.

### Pitfall 6: Custom Field Validation Bypass
**What goes wrong:** Custom field validation rules are defined but not enforced on the server, allowing invalid data via API.
**Why it happens:** Client-side validation applied but server-side validation forgotten or incomplete.
**How to avoid:** Build a `CustomFieldValidator` service that loads field definitions and validates incoming JSONB data against the rules. Call it in the API layer before saving. Do NOT rely solely on client-side validation.
**Warning signs:** Invalid data in JSONB columns that doesn't match field type or validation rules.

### Pitfall 7: Angular Template Performance with Permission Checks
**What goes wrong:** *hasPermission directives trigger permission service calls on every change detection cycle, causing slowness.
**Why it happens:** Using method calls or service calls in templates without memoization.
**How to avoid:** Use signals/computed values for permission state. The `PermissionStore` should compute and cache permission maps, and the directive should read from the signal store (reactive, not polling).
**Warning signs:** Slow UI rendering, excessive API calls to permission endpoints.

### Pitfall 8: Tenant Isolation on New Entities
**What goes wrong:** New entities (Role, Team, CustomFieldDefinition, SavedView) are visible across tenants.
**Why it happens:** Forgetting to add TenantId + global query filter to new entities.
**How to avoid:** Every new tenant-scoped entity MUST have: (1) `TenantId` property, (2) Global query filter in ApplicationDbContext, (3) FK to Organization, (4) RLS policy in PostgreSQL.
**Warning signs:** Users seeing data from other organizations.

## Code Examples

### Database Schema for Permission System

```sql
-- Source: Custom schema design for this project

-- Custom roles (replaces simple Admin/Member for Phase 2)
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES organizations(id),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_system BOOLEAN NOT NULL DEFAULT false,  -- true for template roles
    is_template BOOLEAN NOT NULL DEFAULT false, -- true for clonable templates
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, name)
);

-- Per-entity CRUD permissions with scope
CREATE TABLE role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL,      -- 'Contact', 'Company', 'Deal', etc.
    operation VARCHAR(20) NOT NULL,         -- 'View', 'Create', 'Edit', 'Delete'
    scope SMALLINT NOT NULL DEFAULT 0,      -- 0=None, 1=Own, 2=Team, 3=All
    UNIQUE(role_id, entity_type, operation)
);

-- Field-level access per role
CREATE TABLE role_field_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL,
    field_name VARCHAR(100) NOT NULL,       -- Core field name or custom field ID
    access_level SMALLINT NOT NULL DEFAULT 2, -- 0=Hidden, 1=ReadOnly, 2=Editable
    UNIQUE(role_id, entity_type, field_name)
);

-- Teams
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES organizations(id),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    default_role_id UUID REFERENCES roles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, name)
);

-- Team membership
CREATE TABLE team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES "AspNetUsers"("Id") ON DELETE CASCADE,
    UNIQUE(team_id, user_id)
);

-- Direct role assignments
CREATE TABLE user_role_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES "AspNetUsers"("Id") ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    UNIQUE(user_id, role_id)
);

-- Custom field definitions
CREATE TABLE custom_field_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES organizations(id),
    entity_type VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    label VARCHAR(200) NOT NULL,
    field_type SMALLINT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    section_id UUID REFERENCES custom_field_sections(id),
    validation JSONB NOT NULL DEFAULT '{}',
    options JSONB,                           -- For dropdown/multi-select
    relation_entity_type VARCHAR(50),        -- For relation fields
    is_deleted BOOLEAN NOT NULL DEFAULT false,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, entity_type, name)
);

-- Custom field sections (grouping)
CREATE TABLE custom_field_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES organizations(id),
    entity_type VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    is_collapsed_by_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, entity_type, name)
);

-- Saved views
CREATE TABLE saved_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES organizations(id),
    entity_type VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    owner_id UUID REFERENCES "AspNetUsers"("Id"), -- NULL = team-wide
    is_team_default BOOLEAN NOT NULL DEFAULT false,
    columns JSONB NOT NULL DEFAULT '[]',
    filters JSONB NOT NULL DEFAULT '[]',
    sorts JSONB NOT NULL DEFAULT '[]',
    page_size INT NOT NULL DEFAULT 25,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_roles_tenant ON roles(tenant_id);
CREATE INDEX idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX idx_role_field_permissions_role ON role_field_permissions(role_id);
CREATE INDEX idx_teams_tenant ON teams(tenant_id);
CREATE INDEX idx_team_members_user ON team_members(user_id);
CREATE INDEX idx_user_role_assignments_user ON user_role_assignments(user_id);
CREATE INDEX idx_custom_field_definitions_tenant_entity ON custom_field_definitions(tenant_id, entity_type) WHERE NOT is_deleted;
CREATE INDEX idx_saved_views_tenant_entity ON saved_views(tenant_id, entity_type);
CREATE INDEX idx_saved_views_owner ON saved_views(owner_id);
```

### Seeding Default Role Templates

```csharp
// Source: Custom pattern for this project
public static class RoleTemplateSeeder
{
    public static async Task SeedTemplateRoles(ApplicationDbContext db, Guid tenantId)
    {
        var entityTypes = new[] { "Contact", "Company", "Deal", "Activity" };

        var templates = new[]
        {
            new { Name = "Admin", Description = "Full access to all records and settings",
                  Scope = PermissionScope.All },
            new { Name = "Manager", Description = "Full access to team records",
                  Scope = PermissionScope.Team },
            new { Name = "Sales Rep", Description = "Access to own records, view team records",
                  ViewScope = PermissionScope.Team, EditScope = PermissionScope.Own },
            new { Name = "Viewer", Description = "Read-only access to all records",
                  ViewScope = PermissionScope.All, EditScope = PermissionScope.None },
        };

        foreach (var template in templates)
        {
            var role = new Role
            {
                TenantId = tenantId,
                Name = template.Name,
                Description = template.Description,
                IsSystem = true,
                IsTemplate = true,
            };
            db.Roles.Add(role);

            foreach (var entityType in entityTypes)
            {
                foreach (var op in new[] { "View", "Create", "Edit", "Delete" })
                {
                    // Determine scope based on template and operation
                    var scope = DetermineScope(template, op);
                    db.RolePermissions.Add(new RolePermission
                    {
                        RoleId = role.Id,
                        EntityType = entityType,
                        Operation = op,
                        Scope = scope,
                    });
                }
            }
        }

        await db.SaveChangesAsync();
    }
}
```

### Angular Permission Store

```typescript
// Source: @ngrx/signals pattern (already used in project for AuthStore)
// permission.store.ts

interface PermissionState {
  permissions: EffectivePermission[];
  isLoaded: boolean;
  isLoading: boolean;
}

interface EffectivePermission {
  entityType: string;
  operation: string;
  scope: 'none' | 'own' | 'team' | 'all';
}

export const PermissionStore = signalStore(
  { providedIn: 'root' },
  withState<PermissionState>({
    permissions: [],
    isLoaded: false,
    isLoading: false,
  }),
  withComputed((store) => ({
    permissionMap: computed(() => {
      const map = new Map<string, string>();
      for (const p of store.permissions()) {
        map.set(`${p.entityType}:${p.operation}`, p.scope);
      }
      return map;
    }),
  })),
  withMethods((store) => ({
    hasPermission(entityType: string, operation: string): Signal<boolean> {
      return computed(() => {
        const scope = store.permissionMap().get(`${entityType}:${operation}`);
        return scope !== undefined && scope !== 'none';
      });
    },
    getScope(entityType: string, operation: string): Signal<string> {
      return computed(() => {
        return store.permissionMap().get(`${entityType}:${operation}`) ?? 'none';
      });
    },
    setPermissions(permissions: EffectivePermission[]): void {
      patchState(store, { permissions, isLoaded: true, isLoading: false });
    },
    setLoading(): void {
      patchState(store, { isLoading: true });
    },
  }))
);
```

### Avatar Upload with Crop (Angular)

```typescript
// avatar-upload.component.ts
@Component({
  selector: 'app-avatar-upload',
  standalone: true,
  imports: [ImageCropperComponent, MatDialogModule, MatButtonModule],
  template: `
    <input type="file" #fileInput (change)="fileChangeEvent($event)"
           accept="image/png,image/jpeg,image/webp" hidden>
    <button mat-raised-button (click)="fileInput.click()">Upload Photo</button>

    @if (imageChangedEvent) {
      <image-cropper
        [imageChangedEvent]="imageChangedEvent"
        [maintainAspectRatio]="true"
        [aspectRatio]="1"
        [resizeToWidth]="256"
        format="webp"
        (imageCropped)="imageCropped($event)"
        (imageLoaded)="imageLoaded()"
        (loadImageFailed)="loadImageFailed()"
      />
      <button mat-raised-button color="primary" (click)="save()">Save</button>
    }
  `
})
export class AvatarUploadComponent {
  imageChangedEvent: Event | null = null;
  croppedImage: Blob | null = null;

  fileChangeEvent(event: Event): void {
    this.imageChangedEvent = event;
  }

  imageCropped(event: ImageCroppedEvent): void {
    this.croppedImage = event.blob ?? null;
  }

  save(): void {
    if (!this.croppedImage) return;
    const formData = new FormData();
    formData.append('avatar', this.croppedImage, 'avatar.webp');
    // Upload to /api/profile/avatar
  }
}
```

### Server-Side Avatar Processing (SkiaSharp)

```csharp
// AvatarService.cs
public class AvatarService
{
    private const int MaxSize = 256;
    private const int ThumbnailSize = 64;

    public async Task<(byte[] full, byte[] thumb)> ProcessAvatarAsync(
        Stream imageStream, CancellationToken ct = default)
    {
        using var original = SKBitmap.Decode(imageStream);
        if (original == null)
            throw new InvalidOperationException("Invalid image format");

        var full = ResizeAndEncode(original, MaxSize);
        var thumb = ResizeAndEncode(original, ThumbnailSize);

        return (full, thumb);
    }

    private static byte[] ResizeAndEncode(SKBitmap source, int maxDimension)
    {
        var scale = Math.Min(
            (float)maxDimension / source.Width,
            (float)maxDimension / source.Height);

        var resized = source.Resize(
            new SKImageInfo((int)(source.Width * scale), (int)(source.Height * scale)),
            SKFilterQuality.High);

        using var image = SKImage.FromBitmap(resized);
        using var data = image.Encode(SKEncodedImageFormat.Webp, 85);
        return data.ToArray();
    }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| EF Core owned entities for JSON | EF Core 10 complex types with `ToJson()` | EF Core 10 (2025) | Cleaner mapping, better query support for structured JSONB |
| `Dictionary<string, object>` + manual serialization | Npgsql `EnableDynamicJson()` + native mapping | Npgsql 8.x+ | Automatic serialization of dynamic types to JSONB |
| NgRx Store (actions, reducers, selectors) | @ngrx/signals (signal store, withState, withMethods) | @ngrx/signals 17+ | 80% less boilerplate, signals-native, no action/reducer ceremony |
| ASP.NET Core role-based auth (string roles) | IAuthorizationPolicyProvider + custom handlers | Available since ASP.NET Core 2.0, recommended for complex RBAC | Dynamic policies, resource-based authorization, fine-grained control |
| ImageSharp (Apache 2.0) | ImageSharp requires $4999 commercial license (v3+) | 2022 license change | SkiaSharp (MIT) is the free alternative for .NET image processing |

**Deprecated/outdated:**
- `UserRole` enum (Phase 1): Will be superseded by database-stored Role entities. Keep the enum for backward compatibility during migration but new code should use the Role entity.
- ASP.NET Core Identity simple roles: Still used for basic "is authenticated" checks, but complex permission checks go through the custom PermissionService.

## Open Questions

1. **File storage for avatars and file-type custom fields**
   - What we know: Avatars and file-type custom fields need binary storage.
   - What's unclear: Local filesystem vs. cloud storage (S3/Azure Blob) for Phase 2. The decision affects the upload endpoint and file serving approach.
   - Recommendation: Use local filesystem for Phase 2 (simple, no external dependencies). Add a `IFileStorageService` abstraction so cloud storage can be swapped in later. Store files in a tenant-partitioned directory structure: `uploads/{tenantId}/avatars/` and `uploads/{tenantId}/files/`.

2. **Permission enforcement on JSONB custom field queries**
   - What we know: Field-level permissions control which custom fields a user can see. Custom field values are stored in a single JSONB column.
   - What's unclear: Should hidden fields be stripped from the JSONB response at the API level (projection), or should the entire JSONB be returned and the frontend hides fields?
   - Recommendation: Strip hidden fields server-side in the API response DTO mapping. Never send hidden field data to the client -- this is a security concern, not just UX.

3. **Migration strategy from Phase 1 Admin/Member roles to Phase 2 custom roles**
   - What we know: Phase 1 uses Identity roles ("Admin", "Member") with the UserRole enum.
   - What's unclear: How to migrate existing users to the new custom role system without breaking authentication.
   - Recommendation: Create a data migration that: (1) Creates default role templates, (2) Maps existing "Admin" users to the Admin template role, (3) Maps existing "Member" users to the Sales Rep or Viewer template role, (4) Keep Identity roles for basic "is authenticated" checks but permission checks use the new system.

## Sources

### Primary (HIGH confidence)
- [ASP.NET Core IAuthorizationPolicyProvider (Official Docs, aspnetcore-10.0)](https://learn.microsoft.com/en-us/aspnet/core/security/authorization/iauthorizationpolicyprovider?view=aspnetcore-10.0) - Custom policy provider pattern with code examples
- [ASP.NET Core Resource-Based Authorization (Official Docs, aspnetcore-10.0)](https://learn.microsoft.com/en-us/aspnet/core/security/authorization/resourcebased?view=aspnetcore-10.0) - OperationAuthorizationRequirement pattern, IAuthorizationService usage
- [ASP.NET Core Policy-Based Authorization (Official Docs)](https://learn.microsoft.com/en-us/aspnet/core/security/authorization/policies?view=aspnetcore-10.0) - Requirements, handlers, policy registration
- [Npgsql EF Core JSON Mapping (Official Docs)](https://www.npgsql.org/efcore/mapping/json.html) - ToJson(), JSONB column mapping, LINQ query translation
- [Npgsql EF Core Indexes (Official Docs)](https://www.npgsql.org/efcore/modeling/indexes.html) - HasMethod("gin"), HasOperators() for JSONB indexes
- [PostgreSQL GIN Index Documentation](https://www.postgresql.org/docs/current/gin.html) - jsonb_ops vs jsonb_path_ops operator classes
- [Angular CDK Drag and Drop (Official Docs)](https://angular.dev/guide/drag-drop) - CdkDragDrop, CdkDropList, CdkDrag directives
- [Angular Material CDK Table (Official Docs)](https://material.angular.dev/cdk/table) - Dynamic columns, column definitions
- [AG Grid Column State API](https://www.ag-grid.com/angular-data-grid/column-state/) - getColumnState/applyColumnState (Enterprise feature)
- [AG Grid Community vs Enterprise](https://www.ag-grid.com/angular-data-grid/licensing/) - Feature comparison, licensing

### Secondary (MEDIUM confidence)
- [EF Core 10 JSONB Hybrid DB (Trailhead Technology)](https://trailheadtechnology.com/ef-core-10-turns-postgresql-into-a-hybrid-relational-document-db/) - ExecuteUpdateAsync for JSONB
- [Permission-based Authorization (codewithmukesh)](https://codewithmukesh.com/blog/permission-based-authorization-in-aspnet-core/) - Real-world implementation pattern
- [Dynamic Policy Provider (Joao Grassi)](https://blog.joaograssi.com/posts/2021/asp-net-core-protecting-api-endpoints-with-dynamic-policies/) - Middleware-based permission approach
- [JSONB GIN Indexing Best Practices (Crunchy Data)](https://www.crunchydata.com/blog/indexing-jsonb-in-postgres) - Expression indexes, operator class selection
- [JSONB GIN Index Performance (pganalyze)](https://pganalyze.com/blog/gin-index) - Write overhead, bloat management
- [Angular State Management 2025 (Nx Blog)](https://nx.dev/blog/angular-state-management-2025) - NgRx Signals as recommended approach
- [ngx-image-cropper npm](https://www.npmjs.com/package/ngx-image-cropper) - v9.1.6, Angular 17.3+ support
- [ImageSharp License ($4999)](https://sixlabors.com/pricing/) - Commercial license requirements
- [mat-table Column Resize Issue #11377](https://github.com/angular/components/issues/11377) - No built-in resize, custom directive needed

### Tertiary (LOW confidence)
- [Npgsql EnableDynamicJson issue #2134](https://github.com/npgsql/efcore.pg/issues/2134) - Dictionary<string, object> mapping (community issue, needs validation with current Npgsql 10.x)
- [EF Core HasIndex on JSON properties issue #2568](https://github.com/npgsql/efcore.pg/issues/2568) - GIN index on ToJson() mapped properties may require raw migration SQL

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All core libraries already installed and verified in Phase 1. New additions (SkiaSharp, ngx-image-cropper) are well-established.
- Architecture (RBAC): HIGH - ASP.NET Core IAuthorizationHandler/IAuthorizationPolicyProvider is the official pattern, documented with code examples for aspnetcore-10.0.
- Architecture (Custom Fields JSONB): HIGH - Npgsql JSONB support is mature and well-documented. GIN indexing is standard PostgreSQL.
- Architecture (Dynamic Tables): MEDIUM - mat-table dynamic columns are well-documented, but column resize requires a custom directive (~50 LOC). CDK drag-drop for column reorder is documented but less commonly used on table headers specifically.
- Architecture (User Profile): HIGH - Straightforward entity extension with JSONB preferences. SkiaSharp for image processing is proven.
- Pitfalls: HIGH - Based on Phase 1 experience with dual DbContexts and verified PostgreSQL JSONB patterns.

**Research date:** 2026-02-16
**Valid until:** 2026-03-16 (30 days -- stable technologies)

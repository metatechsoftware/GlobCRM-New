# Phase 20: Advanced Reporting Builder - Research

**Researched:** 2026-02-19
**Domain:** Dynamic report builder with entity source selection, field/filter/grouping configuration, chart visualization, drill-down, save/share, and CSV export
**Confidence:** HIGH

## Summary

Phase 20 builds a full-featured report builder on top of existing infrastructure. The backend already has all CRM entity repositories with server-side filtering, sorting, and pagination (ContactRepository pattern), a DashboardAggregationService for metric computation, a FormulaEvaluationService for computed fields, and Hangfire with PostgreSQL storage for background jobs. The frontend already has chart.js 4.5.1 + ng2-charts 8.0.0 installed and working (ChartWidgetComponent pattern), the Signal Store pattern for component-provided state, and card grid layouts (WorkflowCardComponent pattern).

The reporting feature needs: (1) new Report/ReportDefinition domain entities storing configuration as JSONB, (2) a ReportExecutionService that dynamically queries any CRM entity table with flexible field selection, filtering (AND/OR groups), grouping, and aggregation using EF Core dynamic LINQ expressions, (3) a ReportsController with endpoints for CRUD, execution, field metadata, and CSV export, (4) a frontend report builder page with sidebar configuration panels and chart/table preview, and (5) a report gallery with card grid, categories, and seed starter reports.

The main technical challenge is the dynamic query engine -- the backend must build EF Core queries at runtime from a JSON report definition, selecting arbitrary fields (including related entity fields one level deep and formula fields), applying nested filter groups, and performing grouping with aggregations. This is the most complex backend service in v1.1 but follows patterns already established by the existing filter/sort infrastructure in repositories and the DashboardAggregationService.

**Primary recommendation:** Build a new `ReportQueryEngine` service in Infrastructure that uses EF Core `IQueryable` with dynamic `Expression<>` trees for filtering and `System.Linq.Dynamic.Core` for dynamic GroupBy/Select. Use the existing chart.js/ng2-charts stack for visualization (Bar, Line, Pie) plus `chartjs-chart-funnel` v4.x for the Funnel chart type. CSV export via a Hangfire background job using the existing TenantScope/TenantJobFilter pattern.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Single-page builder layout: all configuration panels visible at once (collapsible sections) with entity/fields/filters/grouping in a left sidebar and results preview on the right
- Manual "Run Report" button to execute -- no auto-preview on config changes
- Filter conditions use AND/OR group builder with nestable condition groups (Notion/Airtable-style)
- Chart types: Bar, Line, Pie, and Funnel (funnel for pipeline/conversion reporting)
- Chart style: Rich & polished -- subtle gradients, smooth animations, hover tooltips with detail (Mixpanel/HubSpot feel)
- View mode: Chart on top, data table below -- both visible simultaneously
- Organization: Folders or categories for grouping reports (e.g., "Sales Reports", "Pipeline Analysis")
- Starter reports: Seed 4-6 prebuilt reports (e.g., "Deals by Stage", "Contacts by Source", "Revenue by Month", "Activities This Week") -- users can clone and customize
- Gallery style: Card grid with mini chart thumbnails, title, entity type badge, and last-run date (consistent with workflow/template card grids)
- Large dataset handling: Server-side pagination (e.g., 50 rows per page)
- CSV export: Full dataset export via background Hangfire job -- download link when ready
- Row click: Navigate to entity detail page (contact, deal, etc.)

### Claude's Discretion
- Field selection UI pattern (checkbox list vs drag-drop)
- Drill-down interaction (inline table filter vs dialog)
- Sharing model granularity (fits existing RBAC)
- Aggregation display format (footer row vs summary cards)
- Chart library choice
- Related entity field picker UX
- Exact sidebar panel layout and collapse behavior

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| RPT-01 | User can select an entity source and choose fields/columns for a report | FieldRegistryService provides system fields per entity type; CustomFieldRepository provides custom/formula fields; new ReportFieldMetadataService combines both + related entity fields |
| RPT-02 | User can add filters with multiple conditions (AND/OR) to narrow report data | ReportQueryEngine builds dynamic Expression trees from nested FilterGroup JSON; extends existing FilterParam/ApplyFilters patterns |
| RPT-03 | User can group results and apply aggregations (count, sum, average, min, max) | ReportQueryEngine uses System.Linq.Dynamic.Core for runtime GroupBy + aggregate Select; follows DashboardAggregationService pattern |
| RPT-04 | User can visualize report results as charts (bar, line, pie) or tables | Existing chart.js 4.5.1 + ng2-charts 8.0.0 + ChartWidgetComponent pattern; plus chartjs-chart-funnel for Funnel type |
| RPT-05 | User can save reports and share them with team members | Report entity with OwnerId + IsShared flag; sharing via existing RBAC (Permission:Report:View); follows Dashboard personal/team-wide pattern |
| RPT-06 | User can export report results to CSV | Hangfire background job (ReportCsvExportJob) with TenantScope; generates CSV, stores via IFileStorageService, returns download URL |
| RPT-07 | User can include related entity fields in reports (one level, e.g., Contact's Company name) | ReportQueryEngine includes related entities via EF Core .Include() + dynamic field selection from navigation properties |
| RPT-08 | User can drill down from a chart data point to view the underlying records | Chart click handler re-runs report with additional filter (clicked group value); filtered data table shows below chart |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| chart.js | ^4.5.1 | Canvas-based charting for Bar/Line/Pie | Already installed, proven in dashboard ChartWidgetComponent |
| ng2-charts | ^8.0.0 | Angular directive for Chart.js | Already installed, supports standalone components, used by dashboard + sequence analytics |
| chartjs-chart-funnel | ^4.2.5 | Chart.js plugin for Funnel chart type | Only maintained Chart.js 4.x funnel plugin; registers FunnelController + TrapezoidElement |
| System.Linq.Dynamic.Core | latest | Dynamic LINQ for runtime GroupBy/Select expressions | Standard .NET library for building LINQ at runtime from strings; avoids massive expression tree boilerplate |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Hangfire | (already installed) | Background CSV export jobs | Full dataset export for large reports; follows existing TenantScope/TenantJobFilter pattern |
| @angular/material | ^19.2.19 | Form controls, expansion panels, tooltips | Builder sidebar uses mat-expansion-panel, mat-checkbox, mat-select, mat-button-toggle |
| @ngrx/signals | ^19.2.1 | Component-provided Signal Store | ReportStore following WorkflowStore pattern |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| chartjs-chart-funnel | Custom horizontal bar simulation | Sequence analytics already simulates funnel with horizontal bars, but dedicated plugin gives proper trapezoid shapes for richer CRM feel |
| System.Linq.Dynamic.Core | Hand-rolled Expression trees | Expression trees work but require massive boilerplate for GroupBy + aggregate Select; Dynamic.Core is battle-tested for this exact use case |
| Checkbox field picker | Drag-drop field picker | Checkbox list is simpler, consistent with SavedView column picker, works well with search/filter; drag-drop adds complexity without clear UX benefit for field selection |

**Installation:**
```bash
# Frontend (one new package)
cd globcrm-web && npm install chartjs-chart-funnel

# Backend (one new NuGet package)
cd src/GlobCRM.Api && dotnet add package System.Linq.Dynamic.Core
```

## Architecture Patterns

### Recommended Project Structure
```
# Backend
src/GlobCRM.Domain/
  Entities/
    Report.cs                    # Report entity (tenant-scoped, JSONB definition)
    ReportCategory.cs            # Category entity for organizing reports
  Enums/
    ReportChartType.cs           # Bar, Line, Pie, Funnel, Table
    AggregationType.cs           # Count, Sum, Average, Min, Max
    FilterLogic.cs               # And, Or
  Interfaces/
    IReportRepository.cs         # CRUD + query by category

src/GlobCRM.Infrastructure/
  Reporting/
    ReportQueryEngine.cs         # Dynamic query builder (core complexity)
    ReportFieldMetadataService.cs # Field discovery per entity type
    ReportCsvExportJob.cs        # Hangfire job for CSV generation
    ReportingServiceExtensions.cs # DI registration
  Persistence/
    Configurations/
      ReportConfiguration.cs
      ReportCategoryConfiguration.cs
    Repositories/
      ReportRepository.cs

src/GlobCRM.Api/
  Controllers/
    ReportsController.cs         # CRUD + execute + export + field metadata

# Frontend
globcrm-web/src/app/features/reports/
  reports.routes.ts              # Lazy-loaded routes
  report.models.ts               # TypeScript interfaces
  report.service.ts              # API calls
  report.store.ts                # Component-provided Signal Store
  report-gallery/                # Card grid list with categories
    report-gallery.component.ts
    report-card.component.ts
  report-builder/                # Single-page builder
    report-builder.component.ts
    entity-source-panel.component.ts
    field-selector-panel.component.ts
    filter-builder-panel.component.ts
    grouping-panel.component.ts
    chart-config-panel.component.ts
  report-viewer/                 # Chart + data table display
    report-chart.component.ts
    report-data-table.component.ts
```

### Pattern 1: Report Domain Entity with JSONB Definition
**What:** Store report configuration as a JSONB column (ReportDefinition) on the Report entity, similar to how WorkflowDefinition stores workflow config as JSONB.
**When to use:** When configuration is complex and variable but doesn't need relational querying.
**Example:**
```csharp
// Report entity following Workflow pattern
public class Report
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }

    // Category for gallery organization
    public Guid? CategoryId { get; set; }
    public ReportCategory? Category { get; set; }

    // Entity source (Contact, Deal, Company, etc.)
    public string EntityType { get; set; } = string.Empty;

    // Full report configuration stored as JSONB
    public ReportDefinition Definition { get; set; } = new();

    // Sharing model (follows Dashboard pattern)
    public Guid? OwnerId { get; set; }
    public ApplicationUser? Owner { get; set; }
    public bool IsShared { get; set; } = false;

    // Seed data for starter reports
    public bool IsSeedData { get; set; } = false;

    // Chart type for gallery thumbnail
    public ReportChartType ChartType { get; set; } = ReportChartType.Table;

    // Cached last execution data for gallery thumbnails
    public DateTimeOffset? LastRunAt { get; set; }
    public int? LastRunRowCount { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

// Owned JSONB entity (EF Core ToJson())
public class ReportDefinition
{
    public List<ReportField> Fields { get; set; } = new();
    public ReportFilterGroup? FilterGroup { get; set; }
    public List<ReportGrouping> Groupings { get; set; } = new();
    public ReportChartConfig? ChartConfig { get; set; }
}
```

### Pattern 2: Dynamic Query Engine with Expression Trees
**What:** Build EF Core IQueryable dynamically from report definition, supporting any entity type, field selection, nested filters, and groupings.
**When to use:** When queries must be constructed at runtime from user-defined configuration.
**Example:**
```csharp
// Core pattern: switch on entity type, build IQueryable
public async Task<ReportExecutionResult> ExecuteReportAsync(
    Report report, int page, int pageSize,
    Guid userId, PermissionScope scope, List<Guid>? teamMemberIds)
{
    return report.Definition.EntityType switch
    {
        "Contact" => await ExecuteForEntity<Contact>(
            _db.Contacts, report.Definition, page, pageSize,
            c => c.OwnerId, userId, scope, teamMemberIds),
        "Deal" => await ExecuteForEntity<Deal>(
            _db.Deals.Include(d => d.Stage).Include(d => d.Company),
            report.Definition, page, pageSize,
            d => d.OwnerId, userId, scope, teamMemberIds),
        // ... other entity types
    };
}

// Generic execution: filter -> group -> aggregate -> paginate
private async Task<ReportExecutionResult> ExecuteForEntity<T>(
    IQueryable<T> baseQuery,
    ReportDefinition definition,
    ...) where T : class
{
    // 1. Apply ownership scope (reuses existing pattern)
    var query = ApplyScope(baseQuery, ownerSelector, userId, scope, teamMemberIds);

    // 2. Apply nested filter groups (AND/OR)
    query = ApplyFilterGroup(query, definition.FilterGroup);

    // 3. If grouping, use System.Linq.Dynamic.Core
    if (definition.Groupings.Count > 0)
        return await ExecuteGroupedQuery(query, definition);

    // 4. Otherwise, flat field selection with pagination
    return await ExecuteFlatQuery(query, definition, page, pageSize);
}
```

### Pattern 3: Nested AND/OR Filter Groups
**What:** Recursive filter model where each group has a logic operator (AND/OR) and contains conditions and/or child groups.
**When to use:** When users need Notion/Airtable-style nestable filter conditions.
**Example:**
```csharp
// Recursive filter model stored in JSONB
public class ReportFilterGroup
{
    public FilterLogic Logic { get; set; } = FilterLogic.And;
    public List<ReportFilterCondition> Conditions { get; set; } = new();
    public List<ReportFilterGroup> Groups { get; set; } = new();
}

public class ReportFilterCondition
{
    public string FieldId { get; set; } = string.Empty;
    public string Operator { get; set; } = "equals";
    public string? Value { get; set; }
    public string? ValueTo { get; set; } // For "between" operator
}

// Recursive expression builder
private Expression<Func<T, bool>> BuildFilterGroupExpression<T>(
    ReportFilterGroup group, ParameterExpression param)
{
    var expressions = new List<Expression>();

    foreach (var condition in group.Conditions)
        expressions.Add(BuildConditionExpression<T>(condition, param));

    foreach (var childGroup in group.Groups)
        expressions.Add(BuildFilterGroupExpression<T>(childGroup, param).Body);

    if (expressions.Count == 0)
        return _ => true;

    var combined = group.Logic == FilterLogic.And
        ? expressions.Aggregate(Expression.AndAlso)
        : expressions.Aggregate(Expression.OrElse);

    return Expression.Lambda<Func<T, bool>>(combined, param);
}
```

### Pattern 4: Related Entity Field Access (One Level Deep)
**What:** Report fields can reference navigation properties one level deep (e.g., Contact.Company.Name, Deal.Stage.Name).
**When to use:** When users need to include related entity data in reports.
**Example:**
```csharp
// Related entity relationships (one level deep)
// Contact -> Company (Name, Industry, Website, Phone)
// Contact -> Owner (FirstName, LastName, Email)
// Deal -> Company (Name, Industry)
// Deal -> Stage (Name, Probability)
// Deal -> Owner (FirstName, LastName, Email)
// Quote -> Contact (FirstName, LastName, Email)
// Quote -> Company (Name)
// Quote -> Deal (Title, Value)
// Request -> Contact (FirstName, LastName)
// Request -> Company (Name)
// Lead -> Stage (Name)
// Lead -> Source (Name)
// Activity -> Owner (FirstName, LastName)
// Activity -> AssignedTo (FirstName, LastName)

// Field naming convention: "related.EntityType.FieldName"
// e.g., "related.Company.name", "related.Stage.name"
// Backend includes navigation via .Include() and projects in Select
```

### Pattern 5: Report Gallery with Card Grid (Workflow Card Pattern)
**What:** Gallery page using card grid consistent with existing workflow list page, with mini chart thumbnails, entity type badges, and category filtering.
**When to use:** The gallery/list page for saved reports.
**Example:**
```typescript
// ReportCardComponent following WorkflowCardComponent pattern
@Component({
  selector: 'app-report-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="report-card" (click)="viewReport.emit()">
      <!-- Mini chart thumbnail (canvas or SVG placeholder) -->
      <div class="report-card__thumbnail">
        <!-- Render small chart.js canvas or SVG icon based on chartType -->
      </div>
      <div class="report-card__info">
        <h3 class="report-card__name">{{ report().name }}</h3>
        <div class="report-card__meta">
          <span class="report-card__entity-chip">{{ report().entityType }}</span>
          <span class="report-card__chart-type">{{ report().chartType }}</span>
        </div>
        <span class="report-card__last-run">{{ lastRunText() }}</span>
      </div>
    </div>
  `
})
```

### Pattern 6: CSV Export via Hangfire Background Job
**What:** Full dataset CSV export runs as a Hangfire background job, stores the file, and provides a download URL.
**When to use:** When exports could be large and should not block the HTTP request.
**Example:**
```csharp
// ReportCsvExportJob following existing Hangfire job patterns
public class ReportCsvExportJob
{
    private readonly ApplicationDbContext _db;
    private readonly ReportQueryEngine _queryEngine;
    private readonly IFileStorageService _fileStorage;

    [Queue("default")]
    public async Task ExecuteAsync(Guid reportId, Guid userId, Guid tenantId)
    {
        TenantScope.SetCurrentTenant(tenantId);
        try
        {
            var report = await _db.Reports.FindAsync(reportId);
            // Execute full query (no pagination)
            var result = await _queryEngine.ExecuteReportAsync(report, 1, int.MaxValue, ...);
            // Write CSV to stream
            var csv = BuildCsv(result);
            // Store via file storage service
            var url = await _fileStorage.UploadAsync($"exports/{reportId}.csv", csv);
            // Notify user via SignalR or notification
        }
        finally
        {
            TenantScope.ClearCurrentTenant();
        }
    }
}
```

### Anti-Patterns to Avoid
- **Loading full entities for aggregation queries:** Always project to anonymous types/DTOs. Never load full entity graphs when computing counts/sums.
- **Client-side filtering/grouping for large datasets:** All filtering, grouping, and aggregation must happen server-side. The frontend only renders results.
- **Storing report results:** Don't persist execution results. Reports always query live data. Only cache thumbnails for gallery display.
- **Hardcoded entity field lists:** Use FieldRegistryService + CustomFieldRepository to dynamically discover available fields. Don't duplicate field lists.
- **Single massive controller method:** Separate the query engine (Infrastructure) from the controller (Api). Controller delegates to service.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dynamic GroupBy/Select at runtime | Custom expression tree builder for grouping | System.Linq.Dynamic.Core | GroupBy("FieldName") with aggregate Select is exactly what this library does; hand-rolling expression trees for grouping is hundreds of lines |
| Funnel chart visualization | Custom SVG/canvas trapezoid drawing | chartjs-chart-funnel | Dedicated Chart.js plugin handles trapezoid rendering, animation, tooltips; manual implementation is fragile |
| CSV generation | Manual string building with commas/escaping | StringBuilder with proper RFC 4180 escaping OR CsvHelper NuGet | CSV escaping has edge cases (quotes, commas, newlines in values); a helper ensures correctness |
| Nested filter group UI | Custom recursive component from scratch | Recursive Angular component with mat-expansion-panel | The filter group UI is inherently recursive; use Angular's ability to self-reference components |

**Key insight:** The report query engine is the most complex piece. System.Linq.Dynamic.Core eliminates 80% of the expression tree boilerplate for grouping/aggregation while keeping full EF Core IQueryable composability.

## Common Pitfalls

### Pitfall 1: EF Core Query Translation Failures with Dynamic Expressions
**What goes wrong:** Dynamically built expressions may not translate to SQL, causing client-side evaluation or runtime exceptions.
**Why it happens:** EF Core's query translator has limits on which expressions it can convert to SQL. Complex string manipulations, custom functions, and certain LINQ patterns fail.
**How to avoid:** Test all dynamic query paths against PostgreSQL. Prefer simple property access expressions. For JSONB custom field access, use EF.Functions methods. Add try-catch around query execution with meaningful error messages.
**Warning signs:** `InvalidOperationException` with "could not be translated" messages; unexpectedly slow queries (client-side evaluation).

### Pitfall 2: N+1 Queries with Related Entity Fields
**What goes wrong:** Including related entity fields without proper .Include() causes N+1 query patterns.
**Why it happens:** EF Core lazy loading is disabled (no virtual navigation properties), so missing .Include() returns null rather than triggering lazy loads, but GroupJoin patterns can cause multiple queries.
**How to avoid:** Pre-analyze which related entities the report definition references. Build .Include() chain before query execution. Use `.AsSplitQuery()` if multiple collection includes cause cartesian explosion.
**Warning signs:** Many small queries in EF Core logs instead of one join query.

### Pitfall 3: Aggregation on JSONB Custom Fields
**What goes wrong:** Cannot do SQL-level SUM/AVG on JSONB custom field values because they're stored as JSON strings, not typed columns.
**Why it happens:** Custom fields are `Dictionary<string, object?>` stored as JSONB. PostgreSQL can extract values but EF Core doesn't translate JSONB numeric extraction to SQL easily.
**How to avoid:** For aggregation on custom fields: (1) extract values in a subquery/CTE using raw SQL with `CAST(custom_fields->>'fieldName' AS numeric)`, or (2) load data and aggregate in-memory for reasonable dataset sizes (< 10K rows after filtering), or (3) only support aggregation on system fields + formula fields (computed server-side). Recommend option (2) with a row count guard.
**Warning signs:** Very slow aggregation queries on custom fields; type cast errors.

### Pitfall 4: Formula Fields in Reports
**What goes wrong:** Formula fields are computed on-read by FormulaEvaluationService, not stored in the database. They can't be used in SQL WHERE/GROUP BY.
**Why it happens:** Formula fields are evaluated in .NET after entity loading, not in SQL.
**How to avoid:** For display: include formula field values by running FormulaEvaluationService on result rows. For filtering/grouping by formula fields: load the filtered dataset first, compute formulas, then do client-side grouping/filtering on formula values. Flag this limitation in the UI. Alternatively, limit formula fields to display-only columns (no filter/group).
**Warning signs:** Users trying to filter/group by formula fields getting unexpected results.

### Pitfall 5: Chart.js Funnel Controller Registration
**What goes wrong:** Funnel chart type not recognized, throws "funnel is not a registered controller" error.
**Why it happens:** chartjs-chart-funnel requires explicit registration of FunnelController and TrapezoidElement.
**How to avoid:** Register in app.config.ts or in the report chart component: `Chart.register(FunnelController, TrapezoidElement)`. Must happen before any chart creation.
**Warning signs:** Console error about unknown chart type "funnel".

### Pitfall 6: Large CSV Export Memory Pressure
**What goes wrong:** Exporting 100K+ rows loads all data into memory, causing OutOfMemoryException.
**Why it happens:** Naive approach loads all entities into a List, then writes CSV.
**How to avoid:** Use streaming: query with `AsAsyncEnumerable()` and write CSV row-by-row to a stream. Paginate internally (query 1000 rows at a time). Set a hard row limit (e.g., 100K rows) with user notification.
**Warning signs:** Hangfire job crashes on large exports; memory spikes.

## Code Examples

### Chart.js Funnel Chart Registration and Usage
```typescript
// In report-chart.component.ts
import { Chart } from 'chart.js';
import { FunnelController, TrapezoidElement } from 'chartjs-chart-funnel';

// Register once (idempotent)
Chart.register(FunnelController, TrapezoidElement);

// Funnel chart data format
const funnelData: ChartData = {
  labels: ['Prospects', 'Qualified', 'Proposal', 'Negotiation', 'Won'],
  datasets: [{
    data: [200, 150, 80, 40, 20],
    backgroundColor: [
      '#F97316', '#FB923C', '#FDBA74', '#FED7AA', '#FFEDD5'
    ],
  }]
};

// Funnel chart options for polished feel
const funnelOptions: ChartOptions = {
  indexAxis: 'y',
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    tooltip: {
      callbacks: {
        label: (ctx) => `${ctx.label}: ${ctx.raw} records`
      }
    },
    legend: { display: false }
  }
};
```

### Existing Chart Widget Color Palette (Reuse)
```typescript
// From ChartWidgetComponent - reuse for consistent look
const CHART_COLORS = [
  '#F97316', // primary (orange)
  '#8B5CF6', // secondary (violet)
  '#14B8A6', // accent (teal)
  '#3B82F6', // info (blue)
  '#22C55E', // success (green)
  '#F59E0B', // warning (amber)
  '#EF4444', // danger (red)
  '#9CA3AF', // neutral (muted)
];
```

### Report Store Pattern (Component-Provided)
```typescript
// Following WorkflowStore / SequenceStore pattern
export const ReportStore = signalStore(
  withState({
    reports: [] as ReportListItem[],
    categories: [] as ReportCategory[],
    selectedReport: null as Report | null,
    executionResult: null as ReportExecutionResult | null,
    loading: false,
    executing: false,
    exporting: false,
    error: null as string | null,
    totalCount: 0,
    currentPage: 1,
  }),
  withMethods((store) => {
    const service = inject(ReportService);
    return {
      loadReports(params?: { category?: string }): void { ... },
      loadReport(id: string): void { ... },
      executeReport(id: string, page?: number): void { ... },
      exportCsv(id: string): void { ... },
      ...
    };
  })
);
```

### Backend Field Metadata Endpoint Pattern
```csharp
// GET /api/reports/fields/{entityType}
// Returns available fields including system, custom, formula, and related entity fields
[HttpGet("fields/{entityType}")]
public async Task<IActionResult> GetFieldMetadata(string entityType)
{
    var customFields = await _customFieldRepository.GetFieldsByEntityTypeAsync(entityType);
    var systemFields = _fieldRegistry.GetAvailableFields(entityType, customFields);

    // Add related entity fields (one level deep)
    var relatedFields = GetRelatedEntityFields(entityType);

    return Ok(new {
        systemFields = systemFields.Where(f => f.Category == "System"),
        customFields = systemFields.Where(f => f.Category == "Custom"),
        formulaFields = systemFields.Where(f => f.Category == "Formula"),
        relatedFields
    });
}
```

### Report RBAC Sharing Pattern (Dashboard Model)
```csharp
// Sharing follows Dashboard entity ownership pattern:
// - OwnerId set + IsShared false = personal (only owner sees it)
// - OwnerId set + IsShared true = shared (all team members can view)
// - IsSeedData = true -> visible to all, cloneable, not editable

// Permission check pattern:
private bool CanAccessReport(Report report, Guid userId)
{
    if (report.IsSeedData) return true;           // Seed reports visible to all
    if (report.OwnerId == userId) return true;     // Owner always has access
    if (report.IsShared) return true;              // Shared reports visible to all in tenant
    return User.IsInRole("Admin");                 // Admin override
}
```

## Discretion Recommendations

### Field Selection UI: Checkbox List with Search
**Recommendation:** Checkbox list with search/filter, grouped by category (System Fields, Custom Fields, Formula Fields, Related Fields). Each checkbox shows field label and type badge.
**Rationale:** Consistent with the existing SavedView column picker (ColumnPickerComponent). Simpler than drag-drop. Users can quickly search and check/uncheck fields. Reorder via simple drag within selected list or arrow buttons.

### Drill-Down Interaction: Inline Table Filter
**Recommendation:** Click on a chart segment/bar/slice adds a filter to the data table below and scrolls to it. A "Clear drill-down" button removes the filter. No dialog needed.
**Rationale:** Keeps the user in context. Dialogs break flow. The data table already supports filtering; drill-down is just programmatically adding a filter value matching the clicked group.

### Aggregation Display: Summary Cards Above Data Table
**Recommendation:** When grouping is active, show summary KPI cards (Count, Sum, Avg, etc.) above the data table in a horizontal card row, similar to the sequence analytics metric cards.
**Rationale:** Footer totals are easy to miss in large tables. Summary cards are more visible and consistent with the existing sequence analytics layout (SequenceAnalyticsComponent metric cards pattern).

### Related Entity Field Picker UX: Expandable Group in Field Selector
**Recommendation:** In the field selector panel, after the main entity's fields, show expandable "Related: Company", "Related: Owner" sections that the user can expand to see related entity fields. Each related field shows as "Company > Name", "Owner > Full Name".
**Rationale:** Keeps the field picker flat and scannable. Expandable groups prevent overwhelming the user with too many fields at once. The ">" separator clearly communicates the relationship.

### Sidebar Panel Layout and Collapse
**Recommendation:** Left sidebar (320px wide) with 5 collapsible mat-expansion-panels: (1) Entity Source, (2) Fields, (3) Filters, (4) Grouping & Aggregation, (5) Chart Type. All start expanded except Filters and Chart Type. "Run Report" button fixed at sidebar bottom.
**Rationale:** Mat-expansion-panel is already used by FilterPanelComponent. 5 sections covers all configuration without overcrowding. Fixed "Run Report" button is always accessible regardless of scroll position.

## Entity Relationship Map (One Level Deep)

Essential for RPT-07 implementation. These are the FK-based relationships available for related entity field access:

| Source Entity | Related Entity | FK Property | Available Fields |
|--------------|----------------|-------------|-----------------|
| Contact | Company | CompanyId | Name, Industry, Website, Phone, City, Country |
| Contact | Owner (User) | OwnerId | FirstName, LastName, Email |
| Deal | Company | CompanyId | Name, Industry |
| Deal | Stage | PipelineStageId | Name (stage name) |
| Deal | Pipeline | PipelineId | Name (pipeline name) |
| Deal | Owner (User) | OwnerId | FirstName, LastName, Email |
| Lead | Stage | LeadStageId | Name |
| Lead | Source | LeadSourceId | Name |
| Lead | Owner (User) | OwnerId | FirstName, LastName, Email |
| Activity | Owner (User) | OwnerId | FirstName, LastName, Email |
| Activity | AssignedTo (User) | AssignedToId | FirstName, LastName, Email |
| Quote | Contact | ContactId | FirstName, LastName, Email |
| Quote | Company | CompanyId | Name |
| Quote | Deal | DealId | Title, Value |
| Quote | Owner (User) | OwnerId | FirstName, LastName, Email |
| Request | Contact | ContactId | FirstName, LastName, Email |
| Request | Company | CompanyId | Name |
| Request | Owner (User) | OwnerId | FirstName, LastName, Email |
| Request | AssignedTo (User) | AssignedToId | FirstName, LastName, Email |
| Product | (none) | - | No related entities |

## Seed Starter Reports

6 prebuilt reports demonstrating range of capabilities:

| Name | Entity | Chart | Grouping | Why |
|------|--------|-------|----------|-----|
| Deals by Stage | Deal | Funnel | Stage name | Core CRM pipeline funnel -- showcases Funnel chart |
| Revenue by Month | Deal | Bar | CreatedAt (month) | Time-series grouping with Sum(value) aggregation |
| Contacts by Source | Contact | Pie | Related: Company.Industry | Related entity field grouping |
| Activities This Week | Activity | Bar | Status | Date-filtered with status breakdown |
| Quotes by Status | Quote | Pie | Status | Simple enum grouping with count |
| Top Deal Owners | Deal | Bar | Related: Owner.LastName | Owner-based aggregation with Sum(value) |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Chart.js 2.x/3.x | Chart.js 4.x with tree-shakeable ESM | Chart.js 4.0 (2023) | Smaller bundles, better TypeScript support |
| Manual Chart.js in Angular | ng2-charts provideCharts() | ng2-charts 6.0+ | Standalone-first, no NgModules needed |
| Expression<> trees for dynamic LINQ | System.Linq.Dynamic.Core | Stable since .NET 6 | Write GroupBy("field") instead of building trees manually |
| Deprecated chartjs-plugin-funnel | chartjs-chart-funnel by sgratzl | 2024 | Chart.js 4.x compatible, ESM, tree-shakeable |

**Deprecated/outdated:**
- `chartjs-plugin-funnel` (YetiForce): Only supports Chart.js 2.7.x, abandoned
- `Chart.BarFunnel.js`: Old Chart.js extension, not Chart.js 4 compatible
- Manual `Expression.Lambda` for GroupBy: Works but far more code than System.Linq.Dynamic.Core

## Open Questions

1. **Custom field aggregation performance**
   - What we know: Custom fields are JSONB. PostgreSQL can extract with `->>'key'` and cast. EF Core doesn't translate JSONB numeric extraction well.
   - What's unclear: Performance at scale (10K+ rows) for in-memory aggregation of custom field values after JSONB extraction.
   - Recommendation: Support aggregation on system fields and formula fields only for v1. Flag custom field numeric aggregation as "beta" with in-memory fallback. Test with realistic data volumes during implementation.

2. **System.Linq.Dynamic.Core EF Core PostgreSQL compatibility**
   - What we know: Library is widely used with EF Core and supports GroupBy/Select/OrderBy as strings. PostgreSQL (Npgsql) provider works with standard LINQ translations.
   - What's unclear: Whether all Dynamic.Core-generated expressions translate to PostgreSQL-specific SQL correctly (e.g., date truncation for month grouping).
   - Recommendation: Test the exact GroupBy patterns needed (field grouping, date truncation) during implementation. Fallback: raw SQL for date truncation grouping if EF Core translation fails.

3. **Mini chart thumbnails in gallery**
   - What we know: The gallery should show mini chart thumbnails per report card. WorkflowCardComponent uses inline SVG thumbnails.
   - What's unclear: Whether to render actual chart.js mini-canvases (resource-heavy for 20+ cards) or SVG schematic thumbnails (like workflow cards).
   - Recommendation: Use SVG schematic thumbnails (colored bars/circles based on chart type) for the gallery. Only render real chart.js when viewing the report. This follows the workflow card thumbnail pattern and avoids canvas rendering overhead in the gallery.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: All entity models, controllers, repositories, stores, and components examined directly
- Existing chart.js integration: `globcrm-web/src/app/app.config.ts` (provideCharts), `chart-widget.component.ts` (ChartWidgetComponent), `sequence-analytics.component.ts` (funnel simulation)
- Existing Hangfire setup: `src/GlobCRM.Infrastructure/BackgroundJobs/` (HangfireServiceExtensions, TenantScope, TenantJobFilter)
- Existing FieldRegistryService: `src/GlobCRM.Infrastructure/FormulaFields/FieldRegistryService.cs` (field metadata per entity type)
- Existing card grid pattern: `globcrm-web/src/app/features/workflows/workflow-list/workflow-card.component.ts`

### Secondary (MEDIUM confidence)
- chartjs-chart-funnel v4.2.5: GitHub repository (https://github.com/sgratzl/chartjs-chart-funnel) -- verified via web search + GitHub README, Chart.js 4.x compatible
- System.Linq.Dynamic.Core: Well-established NuGet package for dynamic LINQ expressions, standard in .NET ecosystem

### Tertiary (LOW confidence)
- chartjs-chart-funnel exact API for ng2-charts integration: May need manual Chart.register() outside ng2-charts provideCharts() setup. Needs validation during implementation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - chart.js/ng2-charts already installed and proven; chartjs-chart-funnel is the only maintained funnel plugin
- Architecture: HIGH - follows established patterns (Workflow JSONB definition, Dashboard aggregation, Repository filter/sort, Card grid)
- Pitfalls: HIGH - pitfalls identified from direct codebase analysis (JSONB limitations, EF Core translation, formula field constraints)
- Dynamic query engine: MEDIUM - System.Linq.Dynamic.Core is well-known but needs PostgreSQL translation validation

**Research date:** 2026-02-19
**Valid until:** 2026-03-19 (30 days - stable domain, no fast-moving dependencies)

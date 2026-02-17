# Phase 9: Dashboards & Reporting - Research

**Researched:** 2026-02-17
**Domain:** Configurable dashboards with charts, KPIs, targets, drag-and-drop widgets, and drill-down
**Confidence:** HIGH

## Summary

Phase 9 transforms the existing static dashboard (greeting + stat cards + quick actions) into a fully configurable dashboard system where users create personal dashboards and admins create team-wide dashboards. The implementation requires three major additions: (1) a charting library for bar, line, and pie charts, (2) a grid layout library for drag-and-drop widget positioning and resizing, and (3) backend aggregation APIs that compute KPIs, counts, sums, and grouped data across all CRM entities.

The existing codebase already has the foundational patterns: SavedView entity demonstrates personal-vs-team-wide ownership (OwnerId null = team, non-null = personal), CDK drag-drop is already imported for deals Kanban, the signal store pattern is well-established, and the DI extension + EF Core configuration patterns are consistent across all 8 completed phases. The dashboard feature adds new domain entities (Dashboard, DashboardWidget, Target) with JSONB-stored widget configuration, plus a DashboardsController with aggregation endpoints.

**Primary recommendation:** Use ng2-charts v8.0.0 (Chart.js 4.x wrapper) for charting and angular-gridster2 v19.0.0 for the dashboard grid layout. Both are the most popular Angular-specific solutions in their category, both support Angular 19, and both are lightweight enough not to bloat the bundle.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| ng2-charts | 8.0.0 | Angular directive wrapping Chart.js for bar/line/pie/doughnut charts | Most popular Angular chart wrapper, 2.4k+ GitHub stars, supports standalone components, one directive for all chart types |
| chart.js | ^4.5.1 | Underlying canvas-based charting engine | 65k+ GitHub stars, 11KB gzipped, responsive, accessible, excellent docs |
| angular-gridster2 | 19.0.0 | Drag-and-drop grid layout for dashboard widgets | Purpose-built for Angular dashboards, supports drag/resize/reposition, 800+ GitHub stars, v19 aligns with Angular 19 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @angular/cdk/drag-drop | ^19.2.19 | Already installed, used for Kanban boards | NOT for dashboard grid (angular-gridster2 handles this) -- only reuse for any drag-drop-to-add-widget toolbar |
| @angular/material | ^19.2.19 | Already installed, used for form controls, icons, date pickers | Date range picker for dashboard filters, mat-select for widget config, mat-menu for widget actions |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| ng2-charts / Chart.js | ngx-charts (D3-based) | ngx-charts is Angular-native SVG but larger bundle, steeper learning curve, less community support. Chart.js is simpler, canvas-based, sufficient for CRM dashboards |
| ng2-charts / Chart.js | Apache ECharts / ngx-echarts | ECharts is more powerful for huge datasets but overkill for CRM dashboards. Larger bundle (200KB+) vs Chart.js (60KB) |
| angular-gridster2 | gridstack.js | Gridstack is framework-agnostic with Angular wrapper, but angular-gridster2 is purpose-built for Angular with tighter integration and simpler API. Gridstack adds complexity for no benefit in this case |
| angular-gridster2 | CDK drag-drop (custom grid) | CDK is great for lists but not for free-form 2D grid layouts. Building a custom grid from CDK would be hand-rolling a solved problem |

**Installation:**
```bash
cd globcrm-web && npm install ng2-charts chart.js angular-gridster2@19.0.0
```

## Architecture Patterns

### Recommended Project Structure
```
# Backend
src/GlobCRM.Domain/
  Entities/
    Dashboard.cs              # Dashboard entity (tenant-scoped, personal/team-wide)
    DashboardWidget.cs        # Widget entity (FK to Dashboard, JSONB config)
    Target.cs                 # KPI target entity (metric, period, target value)
  Enums/
    WidgetType.cs             # KpiCard, BarChart, LineChart, PieChart, Leaderboard, Table
    TargetPeriod.cs           # Daily, Weekly, Monthly, Quarterly, Yearly
    MetricType.cs             # DealCount, DealValue, ActivityCount, QuoteTotal, etc.
  Interfaces/
    IDashboardRepository.cs
    ITargetRepository.cs

src/GlobCRM.Infrastructure/
  Persistence/
    Configurations/
      DashboardConfiguration.cs
      DashboardWidgetConfiguration.cs
      TargetConfiguration.cs
    Repositories/
      DashboardRepository.cs
  Dashboards/
    DashboardServiceExtensions.cs
    DashboardAggregationService.cs  # Central service for metric computation

src/GlobCRM.Api/
  Controllers/
    DashboardsController.cs         # CRUD + aggregation endpoints

# Frontend
globcrm-web/src/app/features/dashboard/
  dashboard.routes.ts                # Updated routes
  models/
    dashboard.models.ts              # Dashboard, Widget, Target TypeScript interfaces
  services/
    dashboard-api.service.ts         # HTTP client for dashboard API
    widget-data.service.ts           # Fetches data for each widget type
  stores/
    dashboard.store.ts               # NgRx signal store for dashboard state
  pages/
    dashboard/
      dashboard.component.ts         # Main dashboard page (replaces existing)
  components/
    dashboard-grid/
      dashboard-grid.component.ts    # Gridster2 wrapper
    widget-wrapper/
      widget-wrapper.component.ts    # Container for each widget
    widgets/
      kpi-card/
        kpi-card.component.ts        # KPI metric card widget
      chart-widget/
        chart-widget.component.ts    # Bar/Line/Pie chart widget
      leaderboard/
        leaderboard.component.ts     # User performance leaderboard
      table-widget/
        table-widget.component.ts    # Mini table widget
      target-progress/
        target-progress.component.ts # Target vs actual progress
    widget-config-dialog/
      widget-config-dialog.component.ts  # Dialog for configuring a widget
    dashboard-selector/
      dashboard-selector.component.ts    # Switch between dashboards
    date-range-filter/
      date-range-filter.component.ts     # Global date range filter
```

### Pattern 1: Dashboard Entity with JSONB Widget Config
**What:** Dashboard stores its widgets as child entities with JSONB configuration, following the same pattern as SavedView + ViewColumn/ViewFilter.
**When to use:** Always -- this is the core data model.
**Example:**
```csharp
// Domain entity pattern matching existing SavedView
public class Dashboard
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }

    // Personal vs team-wide (same pattern as SavedView.OwnerId)
    public Guid? OwnerId { get; set; }
    public bool IsDefault { get; set; } = false;

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    // Navigation
    public ApplicationUser? Owner { get; set; }
    public ICollection<DashboardWidget> Widgets { get; set; } = new List<DashboardWidget>();
}

public class DashboardWidget
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid DashboardId { get; set; }
    public WidgetType Type { get; set; }
    public string Title { get; set; } = string.Empty;

    // Gridster2 position/size
    public int X { get; set; }
    public int Y { get; set; }
    public int Cols { get; set; } = 2;
    public int Rows { get; set; } = 2;

    // Widget-specific configuration stored as JSONB
    // e.g., { "metric": "DealValue", "groupBy": "stage", "chartType": "bar" }
    public Dictionary<string, object?> Config { get; set; } = new();

    public int SortOrder { get; set; }

    // Navigation
    public Dashboard Dashboard { get; set; } = null!;
}
```

### Pattern 2: Backend Aggregation Service
**What:** A centralized service that queries across entity DbSets using EF Core GroupBy/Count/Sum, returning pre-computed metric results.
**When to use:** For all widget data endpoints -- never query raw entities from the dashboard controller.
**Example:**
```csharp
// Aggregation service computes metrics server-side
public class DashboardAggregationService
{
    private readonly ApplicationDbContext _db;

    public async Task<MetricResult> ComputeMetricAsync(
        MetricType metric, DateRange dateRange, Guid? userId = null)
    {
        return metric switch
        {
            MetricType.DealCount => new MetricResult
            {
                Value = await _db.Deals
                    .Where(d => d.CreatedAt >= dateRange.Start && d.CreatedAt <= dateRange.End)
                    .CountAsync(),
                Label = "Total Deals"
            },
            MetricType.DealPipelineValue => new MetricResult
            {
                Value = await _db.Deals
                    .Where(d => d.CreatedAt >= dateRange.Start && d.CreatedAt <= dateRange.End)
                    .SumAsync(d => d.Value ?? 0),
                Label = "Pipeline Value"
            },
            MetricType.DealsByStage => /* GroupBy stage, return series */,
            MetricType.ActivitiesCompleted => /* Count where Status == Done */,
            _ => throw new ArgumentException($"Unknown metric: {metric}")
        };
    }
}
```

### Pattern 3: Angular Gridster2 Dashboard Grid
**What:** Use angular-gridster2 for the dashboard grid with each widget in a GridsterItem.
**When to use:** The main dashboard page component.
**Example:**
```typescript
import { GridsterModule, GridsterConfig, GridsterItem } from 'angular-gridster2';

@Component({
  standalone: true,
  imports: [GridsterModule],
  template: `
    <gridster [options]="gridOptions">
      @for (widget of widgets(); track widget.id) {
        <gridster-item [item]="widget.gridItem">
          <app-widget-wrapper [widget]="widget" />
        </gridster-item>
      }
    </gridster>
  `
})
export class DashboardGridComponent {
  gridOptions: GridsterConfig = {
    draggable: { enabled: true },
    resizable: { enabled: true },
    pushItems: true,
    minCols: 12,
    maxCols: 12,
    minRows: 1,
    outerMargin: true,
    margin: 16,
    itemChangeCallback: (item) => this.onWidgetChange(item),
    itemResizeCallback: (item) => this.onWidgetResize(item),
  };
}
```

### Pattern 4: ng2-charts Chart Widget
**What:** Use BaseChartDirective from ng2-charts for all chart types.
**When to use:** Bar, line, pie, and doughnut chart widgets.
**Example:**
```typescript
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration } from 'chart.js';

@Component({
  standalone: true,
  imports: [BaseChartDirective],
  template: `
    <canvas baseChart
      [data]="chartData()"
      [options]="chartOptions"
      [type]="chartType()">
    </canvas>
  `
})
export class ChartWidgetComponent {
  chartType = input<'bar' | 'line' | 'pie' | 'doughnut'>('bar');
  chartData = input.required<ChartConfiguration['data']>();

  chartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom' }
    }
  };
}
```

### Pattern 5: Component-Provided Signal Store for Dashboard
**What:** Dashboard store is component-provided (not root), following the DealStore pattern. Each dashboard page gets its own store instance.
**When to use:** The dashboard page component provides the store.
**Example:**
```typescript
export const DashboardStore = signalStore(
  withState({
    dashboards: [] as DashboardDto[],
    activeDashboard: null as DashboardDto | null,
    widgetData: {} as Record<string, WidgetDataResult>,
    dateRange: { start: null, end: null } as DateRange,
    isLoading: false,
    isEditing: false,
  }),
  withMethods((store) => {
    const dashboardApi = inject(DashboardApiService);
    return {
      loadDashboards(): void { /* ... */ },
      loadWidgetData(widgetId: string, config: WidgetConfig): void { /* ... */ },
      saveLayout(widgets: GridsterItem[]): void { /* ... */ },
      setDateRange(range: DateRange): void { /* ... */ },
    };
  })
);
```

### Anti-Patterns to Avoid
- **Raw entity queries from dashboard controller:** Never query Deals/Activities/etc. directly in controller actions. Always use the DashboardAggregationService -- this keeps aggregation logic testable and avoids N+1 queries.
- **Client-side aggregation:** Never send all deals/activities to the frontend for counting/summing. Always aggregate server-side and return pre-computed results. CRM datasets can be large.
- **Storing widget data in the dashboard entity:** Widget configuration (what to show) is stored in the DB. Widget data (actual numbers) is always computed on request. Never cache metric results in the database.
- **One API call per widget:** Batch widget data requests where possible. The dashboard load endpoint should accept a list of widget configs and return all data in one response to avoid waterfall requests.
- **Hard-coding widget positions:** Always persist gridster item positions (x, y, cols, rows) in the DashboardWidget entity so layouts survive page reload.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Chart rendering | Custom SVG/Canvas charts | ng2-charts (Chart.js) | 8 chart types, responsive, accessible, tooltips, animations -- 500+ lines of code per chart type |
| Dashboard grid layout | Custom CSS Grid + drag handlers | angular-gridster2 | Collision detection, push logic, resize handles, mobile responsiveness -- thousands of lines of layout math |
| Date range picker | Custom calendar inputs | Angular Material mat-date-range-picker | Already installed, handles locale, timezone, validation |
| Progress indicators | Custom SVG circles | CSS + mat-progress-bar | Material progress bar handles animation, a11y, indeterminate states |

**Key insight:** Dashboard features are deceptively complex. The grid layout alone involves collision detection, item pushing, resize constraints, mobile breakpoints, and scroll handling. Chart rendering involves canvas management, responsive resizing, tooltip positioning, and accessibility. Both are solved problems.

## Common Pitfalls

### Pitfall 1: Chart.js Canvas Not Resizing on Widget Resize
**What goes wrong:** When a gridster widget is resized, the Chart.js canvas does not automatically adjust its dimensions. Charts appear stretched or cropped.
**Why it happens:** Chart.js renders to a fixed-size canvas. It responds to window resize events but not to parent container resize.
**How to avoid:** Set `responsive: true` and `maintainAspectRatio: false` in chart options. Listen to gridster's `itemResizeCallback` and call `chart.resize()` or trigger a re-render. Use `ResizeObserver` on the widget container.
**Warning signs:** Charts look correct on load but distorted after resizing.

### Pitfall 2: N+1 Queries in Aggregation Endpoints
**What goes wrong:** Dashboard loads slowly because each widget triggers a separate database query, and some queries load full entity graphs.
**Why it happens:** Aggregation logic uses eager loading (.Include()) instead of projection (.Select() with GroupBy/Sum).
**How to avoid:** Use EF Core projection queries: `.GroupBy(d => d.Stage.Name).Select(g => new { Stage = g.Key, Count = g.Count(), Value = g.Sum(d => d.Value) })`. Never load full entities for counting.
**Warning signs:** Dashboard takes >2s to load, database CPU spikes.

### Pitfall 3: Gridster Not Filling Container Height
**What goes wrong:** The gridster grid appears as a thin strip or has no height.
**Why it happens:** angular-gridster2 requires the parent container to have defined dimensions. If the parent uses `height: auto` or has no explicit height, the grid collapses.
**How to avoid:** Set the gridster parent to `height: calc(100vh - headerHeight)` or use `fixedRowHeight` in gridster options. The gridster container MUST have an explicit height.
**Warning signs:** Grid renders but only shows a few pixels tall.

### Pitfall 4: Widget Config Dialog Losing State
**What goes wrong:** When editing widget configuration in a dialog, closing and reopening loses partial edits or applies changes before the user confirms.
**Why it happens:** Two-way binding between the dialog form and the store state.
**How to avoid:** Pass a deep copy of the widget config to the dialog. Only update the store when the user clicks "Save." Use MatDialogRef.afterClosed() to get the result.
**Warning signs:** Widget config changes take effect before the user confirms.

### Pitfall 5: RBAC Scope Not Applied to Aggregation Queries
**What goes wrong:** A user with "Own" scope on Deals sees aggregated data for all deals, including ones they shouldn't access.
**Why it happens:** The aggregation service queries all entities without checking the user's permission scope.
**How to avoid:** Pass the user's permission scope (Own/Team/All) to every aggregation method. Apply the same ownership filtering as the entity list endpoints (CompaniesController pattern). Global query filters handle tenant isolation, but ownership scope must be applied manually.
**Warning signs:** Dashboard KPIs show higher numbers than the user sees in entity list pages.

### Pitfall 6: angular-gridster2 Import Pattern
**What goes wrong:** Build errors when importing GridsterModule incorrectly.
**Why it happens:** The v19 package may use a different export pattern than documented.
**How to avoid:** Import `GridsterModule` from `angular-gridster2` and add it to standalone component imports. The module contains both `GridsterComponent` and `GridsterItemComponent`.
**Warning signs:** "Module not found" or "not a known element" errors.

### Pitfall 7: Timezone Issues in Date Range Filtering
**What goes wrong:** Dashboard shows incorrect numbers at day boundaries. A deal created at 11 PM UTC appears in the wrong day for users in UTC-5.
**Why it happens:** Backend uses UTC timestamps but frontend date range picker returns local dates.
**How to avoid:** Always send date ranges as UTC ISO 8601 strings. Convert local dates to UTC start-of-day/end-of-day on the frontend before sending. In backend, compare using DateTimeOffset.
**Warning signs:** Numbers don't match between dashboard and list pages, especially around midnight.

## Code Examples

### Backend: Dashboard Entity Configuration (EF Core)
```csharp
// Source: Following existing NotificationConfiguration pattern
public class DashboardConfiguration : IEntityTypeConfiguration<Dashboard>
{
    public void Configure(EntityTypeBuilder<Dashboard> builder)
    {
        builder.ToTable("dashboards");
        builder.HasKey(d => d.Id);
        builder.Property(d => d.Id).HasColumnName("id");
        builder.Property(d => d.TenantId).HasColumnName("tenant_id").IsRequired();
        builder.Property(d => d.Name).HasColumnName("name").HasMaxLength(200).IsRequired();
        builder.Property(d => d.Description).HasColumnName("description").HasMaxLength(1000);
        builder.Property(d => d.OwnerId).HasColumnName("owner_id");
        builder.Property(d => d.IsDefault).HasColumnName("is_default").HasDefaultValue(false);
        builder.Property(d => d.CreatedAt).HasColumnName("created_at").IsRequired();
        builder.Property(d => d.UpdatedAt).HasColumnName("updated_at").IsRequired();

        builder.HasOne(d => d.Owner)
            .WithMany()
            .HasForeignKey(d => d.OwnerId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasMany(d => d.Widgets)
            .WithOne(w => w.Dashboard)
            .HasForeignKey(w => w.DashboardId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(d => new { d.TenantId, d.OwnerId })
            .HasDatabaseName("idx_dashboards_tenant_owner");
    }
}
```

### Backend: Aggregation Query Patterns (EF Core)
```csharp
// Source: EF Core GroupBy documentation pattern
// Deals by stage (for bar chart)
var dealsByStage = await _db.Deals
    .Where(d => d.CreatedAt >= start && d.CreatedAt <= end)
    .GroupBy(d => d.Stage.Name)
    .Select(g => new ChartDataPoint
    {
        Label = g.Key,
        Value = g.Count(),
        Sum = g.Sum(d => d.Value ?? 0)
    })
    .ToListAsync();

// Activities by type (for pie chart)
var activitiesByType = await _db.Activities
    .Where(a => a.CreatedAt >= start && a.CreatedAt <= end)
    .GroupBy(a => a.Type)
    .Select(g => new ChartDataPoint
    {
        Label = g.Key.ToString(),
        Value = g.Count()
    })
    .ToListAsync();

// Sales leaderboard (for leaderboard widget)
var leaderboard = await _db.Deals
    .Where(d => d.ActualCloseDate != null && d.Stage.IsWon)
    .Where(d => d.CreatedAt >= start && d.CreatedAt <= end)
    .GroupBy(d => new { d.OwnerId, d.Owner!.FirstName, d.Owner.LastName })
    .Select(g => new LeaderboardEntry
    {
        UserId = g.Key.OwnerId,
        Name = $"{g.Key.FirstName} {g.Key.LastName}".Trim(),
        DealsWon = g.Count(),
        TotalValue = g.Sum(d => d.Value ?? 0)
    })
    .OrderByDescending(e => e.TotalValue)
    .Take(10)
    .ToListAsync();
```

### Frontend: provideCharts Registration (app.config.ts)
```typescript
// Source: ng2-charts official docs
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';

export const appConfig: ApplicationConfig = {
  providers: [
    // ...existing providers...
    provideCharts(withDefaultRegisterables()),
  ],
};
```

### Frontend: KPI Card Component
```typescript
// Source: Following existing project's inline template pattern for simple components
@Component({
  selector: 'app-kpi-card',
  standalone: true,
  imports: [MatIconModule],
  template: `
    <div class="kpi-card" [attr.data-color]="color()">
      <div class="kpi-card__header">
        <span class="kpi-card__title">{{ title() }}</span>
        <mat-icon class="kpi-card__icon">{{ icon() }}</mat-icon>
      </div>
      <div class="kpi-card__value">{{ formattedValue() }}</div>
      @if (target()) {
        <div class="kpi-card__progress">
          <div class="kpi-card__bar">
            <div class="kpi-card__fill" [style.width.%]="progressPercent()"></div>
          </div>
          <span class="kpi-card__target">{{ progressPercent() }}% of target</span>
        </div>
      }
    </div>
  `
})
export class KpiCardComponent {
  title = input.required<string>();
  value = input.required<number>();
  icon = input<string>('trending_up');
  color = input<string>('primary');
  format = input<'number' | 'currency' | 'percent'>('number');
  target = input<number | null>(null);

  formattedValue = computed(() => {
    const v = this.value();
    switch (this.format()) {
      case 'currency': return `$${v.toLocaleString()}`;
      case 'percent': return `${v}%`;
      default: return v.toLocaleString();
    }
  });

  progressPercent = computed(() => {
    const t = this.target();
    if (!t) return 0;
    return Math.min(100, Math.round((this.value() / t) * 100));
  });
}
```

### Frontend: angular-gridster2 Dashboard Setup
```typescript
import { GridsterModule, GridsterConfig, GridsterItem,
         GridsterItemComponentInterface } from 'angular-gridster2';

// GridsterConfig for the dashboard
const DASHBOARD_GRID_OPTIONS: GridsterConfig = {
  gridType: 'verticalFixed',
  fixedRowHeight: 200,
  compactType: 'compactUp',
  draggable: {
    enabled: true,
    ignoreContent: true,
    dragHandleClass: 'widget-drag-handle',
  },
  resizable: {
    enabled: true,
  },
  pushItems: true,
  swap: false,
  minCols: 12,
  maxCols: 12,
  minRows: 1,
  outerMargin: true,
  outerMarginTop: 16,
  outerMarginRight: 16,
  outerMarginBottom: 16,
  outerMarginLeft: 16,
  margin: 16,
  displayGrid: 'onDrag&Resize',
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| NgModule-based chart imports | Standalone + provideCharts() in app.config.ts | ng2-charts v6+ (2024) | Must use provideCharts() with withDefaultRegisterables() or selective registerables |
| Chart.js v2 datasets API | Chart.js v4 datasets API with tree-shaking | Chart.js v3+ (2021) | Import and register needed controllers; default registerables work for most cases |
| angular-gridster2 NgModule | Standalone component support | v17+ (2023) | Import GridsterModule in standalone component imports array |
| D3.js for everything | Chart.js for standard charts, D3 only for custom viz | Ongoing | Chart.js covers 90% of CRM dashboard needs without D3's complexity |

**Deprecated/outdated:**
- **ngx-charts**: Still maintained but losing community momentum to Chart.js/ng2-charts. SVG-based approach is heavier than Canvas for typical dashboard use.
- **Chart.js v2 API**: The v2 API (`new Chart()` with different config shape) is completely replaced by v3/v4 API. All current docs reference v4.
- **angular-gridster2 NgModule pattern**: While still supported, standalone component usage is the recommended path for Angular 19.

## Open Questions

1. **Real-time widget updates via SignalR**
   - What we know: SignalR is already set up with CrmHub. Dashboards could receive live updates when deals move stages or activities complete.
   - What's unclear: Whether to push individual metric updates or just invalidate/refresh. Granular push is complex; refresh-on-notification is simpler.
   - Recommendation: Start with manual refresh + optional auto-refresh interval (every 60s). Defer SignalR widget push to Phase 11 polish or post-MVP. The notification system already shows toasts that prompt the user to look at changes.

2. **Dashboard PDF export / reporting**
   - What we know: QuestPDF is already installed for quote PDF generation. The phase name includes "Reporting."
   - What's unclear: Whether the success criteria require PDF export of dashboard views. The 6 DASH requirements don't mention export.
   - Recommendation: Defer PDF export. The 6 success criteria are about interactive dashboards, not static reports. If needed later, Chart.js supports `toBase64Image()` for canvas snapshots that could feed into QuestPDF.

3. **Widget data caching strategy**
   - What we know: Aggregation queries hit the database on every dashboard load.
   - What's unclear: Whether response caching or in-memory caching is needed for performance.
   - Recommendation: Start without caching. CRM tenants are mid-size (10-50 users, moderate data volumes). If performance becomes an issue, add `IMemoryCache` with 30-60s TTL per tenant+metric key. Monitor query times in Serilog.

## Defined Metrics (Widget Data Sources)

These are the CRM-relevant metrics the aggregation service should support:

| Metric | Entity | Aggregation | Chart Types |
|--------|--------|-------------|-------------|
| Deal Count | Deals | COUNT | KPI, Bar, Line |
| Deal Pipeline Value | Deals | SUM(Value) | KPI, Bar |
| Deals by Stage | Deals | GROUP BY Stage, COUNT | Bar, Pie |
| Deals Won | Deals | COUNT WHERE IsWon | KPI, Line (trend) |
| Deals Lost | Deals | COUNT WHERE IsLost | KPI, Line (trend) |
| Win Rate | Deals | Won / (Won + Lost) | KPI |
| Average Deal Value | Deals | AVG(Value) | KPI, Line (trend) |
| Activity Count | Activities | COUNT | KPI, Bar |
| Activities by Type | Activities | GROUP BY Type, COUNT | Pie |
| Activities by Status | Activities | GROUP BY Status, COUNT | Bar |
| Activities Completed | Activities | COUNT WHERE Done | KPI, Line (trend) |
| Overdue Activities | Activities | COUNT WHERE DueDate < Now AND Status != Done | KPI |
| Quote Total | Quotes | SUM(GrandTotal) | KPI |
| Quotes by Status | Quotes | GROUP BY Status, COUNT | Pie |
| Contacts Created | Contacts | COUNT | KPI, Line (trend) |
| Companies Created | Companies | COUNT | KPI, Line (trend) |
| Requests by Status | Requests | GROUP BY Status, COUNT | Pie, Bar |
| Requests by Priority | Requests | GROUP BY Priority, COUNT | Bar |
| Sales Leaderboard | Deals (Won) | GROUP BY Owner, SUM(Value) | Leaderboard |
| Activity Leaderboard | Activities (Done) | GROUP BY AssignedTo, COUNT | Leaderboard |

## Sources

### Primary (HIGH confidence)
- npm registry (`npm view`) -- ng2-charts v8.0.0, angular-gridster2 v19.0.0, chart.js v4.5.1 -- version numbers and peer dependencies verified directly
- Existing codebase analysis -- all patterns (DI extensions, EF Core configs, signal stores, SavedView ownership model, controller patterns) verified from source code

### Secondary (MEDIUM confidence)
- [ng2-charts GitHub](https://github.com/valor-software/ng2-charts) -- BaseChartDirective API, provideCharts setup, standalone component support
- [angular-gridster2 GitHub](https://github.com/tiberiuzuld/angular-gridster2) -- GridsterConfig API, item structure, drag/resize callbacks
- [Chart.js official docs](https://www.chartjs.org/docs/) -- Chart configuration, responsive options, chart types

### Tertiary (LOW confidence)
- Web search results for CRM dashboard best practices -- common widget types, KPI patterns (confirmed against existing entity model)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- versions verified via npm, peer deps confirmed compatible with Angular 19
- Architecture: HIGH -- all patterns derived from existing codebase patterns (SavedView, signal stores, DI extensions, EF Core configs)
- Pitfalls: HIGH -- Chart.js resize issue is well-documented; gridster height issue is the #1 FAQ; RBAC scope issue derived from existing controller patterns
- Metric definitions: HIGH -- all metrics map directly to existing domain entities with verified fields

**Research date:** 2026-02-17
**Valid until:** 2026-03-17 (stable libraries, unlikely to change)

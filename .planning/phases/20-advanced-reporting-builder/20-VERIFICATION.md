---
phase: 20-advanced-reporting-builder
verified: 2026-02-19T18:34:20Z
status: passed
score: 4/4 success criteria verified
re_verification: false
human_verification:
  - test: "Navigate to /reports and verify gallery loads with card grid"
    expected: "Card grid shows 6 seed reports with SVG chart thumbnails, entity type badges, and last-run dates"
    why_human: "Visual rendering cannot be verified programmatically"
  - test: "Navigate to /reports/new, select 'Contact' entity, pick 2 fields, click Save, then click Run Report"
    expected: "Report saves, navigates to edit mode, Run Report executes and shows data table with rows"
    why_human: "End-to-end flow involves API calls, navigation, and result rendering"
  - test: "On a grouped report with bar chart, click a chart bar segment"
    expected: "Data table filters to show only records matching the clicked segment; amber drill-down bar appears with clear button"
    why_human: "Chart click interaction and table filtering requires runtime verification"
  - test: "Click Export CSV on an executed report"
    expected: "Snackbar appears: 'Export started. You will be notified when it is ready.'; SignalR notification arrives with download link"
    why_human: "Background job execution and SignalR delivery require runtime verification"
  - test: "Open report builder with 'Deal' entity, add 'Stage > Name' related field, add filter on 'Stage > Name' equals 'Proposal'"
    expected: "Related field appears in field selector under 'Related Fields'; filter condition appears correctly; report executes with Stage join"
    why_human: "Related entity field display and join execution require runtime verification"
---

# Phase 20: Advanced Reporting Builder Verification Report

**Phase Goal:** Users can build custom reports by selecting entity sources, fields (including formula fields and related entity fields), filters, groupings, and visualizations — then save, share, and export them
**Verified:** 2026-02-19T18:34:20Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can create a report by selecting entity source, choosing fields (including formula and related entity fields one level deep), and adding filter conditions with AND/OR logic | VERIFIED | EntitySourcePanelComponent emits entityTypeChange -> store.loadFieldMetadata(); FieldSelectorPanelComponent renders system/custom/formula/related field groups; FilterBuilderPanelComponent supports recursive AND/OR with isNested input; all 8 entity types supported in ReportQueryEngine |
| 2 | User can group report results and apply aggregations (count, sum, average, min, max) to numeric and formula fields | VERIFIED | GroupingPanelComponent outputs groupingsChange + aggregationsChange with AggregationType enum; ReportQueryEngine.ExecuteGroupedQuery uses System.Linq.Dynamic.Core GroupBy with Sum/Average/Min/Max/Count aggregate expressions; ReportAggregationCardsComponent renders summary KPI cards |
| 3 | User can visualize report results as charts (bar, line, pie) or data table, and drill down from chart data point to view underlying records | VERIFIED | ReportChartComponent renders bar/line/pie(doughnut)/funnel via ng2-charts with chartjs-chart-funnel; onClick handler emits drillDown output with ReportFilterCondition; builder's onDrillDown re-executes report with drillDownFilter; ReportDataTableComponent shows drill-down bar with clear button |
| 4 | User can save reports, share them with team members, and export results to CSV | VERIFIED | saveReport() calls store.createReport/updateReport; toggleShare() calls PATCH /api/reports/{id}/share; exportCsv() calls POST /api/reports/{id}/export-csv triggering Hangfire job; ReportCsvExportJob builds RFC 4180 CSV, stores via IFileStorageService, sends SignalR "ReportExportComplete" notification |

**Score:** 4/4 success criteria verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/GlobCRM.Domain/Entities/Report.cs` | Report entity with JSONB ReportDefinition, nested types | VERIFIED | 243 lines; full entity with ReportDefinition, ReportField, ReportFilterGroup, ReportFilterCondition, ReportGrouping, ReportChartConfig nested classes |
| `src/GlobCRM.Domain/Entities/ReportCategory.cs` | ReportCategory entity | VERIFIED | Exists with TenantId, Name, SortOrder, IsSeedData |
| `src/GlobCRM.Domain/Interfaces/IReportRepository.cs` | Repository interface | VERIFIED | CRUD + GetAllAsync + category management methods |
| `src/GlobCRM.Infrastructure/Reporting/ReportRepository.cs` | EF Core repository impl | VERIFIED | Uses `_context.Reports` DbSet; GetAllAsync with filtering, pagination |
| `src/GlobCRM.Infrastructure/Reporting/ReportFieldMetadataService.cs` | Field discovery service | VERIFIED | 315 lines; handles all 8 entity types; returns system/custom/formula/related categories; uses FieldRegistryService + ICustomFieldRepository |
| `src/GlobCRM.Infrastructure/Reporting/ReportQueryEngine.cs` | Dynamic query builder | VERIFIED | Handles all 8 entity types; flat + grouped execution paths; System.Linq.Dynamic.Core GroupBy with Sum/Average/Min/Max/Count; recursive filter expression trees |
| `src/GlobCRM.Infrastructure/Reporting/ReportingServiceExtensions.cs` | DI extension | VERIFIED | Registers ReportFieldMetadataService + ReportQueryEngine as Scoped |
| `src/GlobCRM.Api/Controllers/ReportsController.cs` | REST API controller | VERIFIED | 14 endpoints: GET list, GET by id, POST create, PUT update, DELETE, POST execute, GET fields/{entityType}, PATCH share, POST clone, POST export-csv, GET/POST/PUT/DELETE categories |
| `src/GlobCRM.Infrastructure/Reporting/ReportCsvExportJob.cs` | Hangfire CSV job | VERIFIED | Builds RFC 4180 CSV via StringBuilder; stores via IFileStorageService; sends SignalR "ReportExportComplete" to user group |
| `src/GlobCRM.Infrastructure/Persistence/Migrations/App/20260219174256_AddReports.cs` | EF Core migration | VERIFIED | Creates reports + report_categories tables with composite indexes on (TenantId, EntityType) and (TenantId, OwnerId, IsShared) |
| `scripts/rls-setup.sql` | RLS policies | VERIFIED | Lines 656-681: ALTER TABLE reports/report_categories ENABLE ROW LEVEL SECURITY + tenant_isolation policies |
| `globcrm-web/src/app/features/reports/report.models.ts` | TypeScript models | VERIFIED | Full interface set: Report, ReportListItem, ReportDefinition, ReportField, ReportFilterGroup, ReportFilterCondition, ReportGrouping, ReportChartConfig, ReportFieldMetadata, ReportExecutionResult, all request types |
| `globcrm-web/src/app/features/reports/report.service.ts` | API service | VERIFIED | 14 methods covering all controller endpoints; calls `api/reports` base path |
| `globcrm-web/src/app/features/reports/report.store.ts` | NgRx Signal Store | VERIFIED | withState + withMethods; loadReports, loadReport, createReport, updateReport, deleteReport, executeReport, loadFieldMetadata, toggleShare, cloneReport, exportCsv, loadCategories |
| `globcrm-web/src/app/features/reports/reports.routes.ts` | Lazy-loaded routes | VERIFIED | gallery (''), builder ('new', ':id', ':id/edit') routes |
| `globcrm-web/src/app/features/reports/report-gallery/report-gallery.component.ts` | Gallery page | VERIFIED | providers: [ReportStore]; loadCategories + loadReports on init; categoryFilter, entityTypeFilter, searchFilter signals; navigates to /reports/{id} on card click |
| `globcrm-web/src/app/features/reports/report-gallery/report-card.component.ts` | Gallery card | VERIFIED | SVG chart thumbnails (switch on chartType); isShared/isSeedData badges; relative last-run time |
| `globcrm-web/src/app/features/reports/report-builder/entity-source-panel.component.ts` | Entity source panel | VERIFIED | mat-select for 8 entity types; emits entityTypeChange on selection |
| `globcrm-web/src/app/features/reports/report-builder/field-selector-panel.component.ts` | Field selector panel | VERIFIED | Checkbox list with search; 4 expandable groups (system/custom/formula/related); fieldsChange output |
| `globcrm-web/src/app/features/reports/report-builder/filter-builder-panel.component.ts` | Filter builder panel | VERIFIED | Recursive AND/OR groups; isNested input; self-referencing template for child groups; field-type-adaptive operators |
| `globcrm-web/src/app/features/reports/report-builder/grouping-panel.component.ts` | Grouping panel | VERIFIED | groupingsChange + aggregationsChange outputs; AggregationType enum options; date truncation dropdown |
| `globcrm-web/src/app/features/reports/report-builder/chart-config-panel.component.ts` | Chart config panel | VERIFIED | mat-button-toggle-group for 5 chart types; showLegend/showDataLabels toggles |
| `globcrm-web/src/app/features/reports/report-builder/report-builder.component.ts` | Builder orchestrator | VERIFIED | All 5 panels wired; local signals for state; canSave/canRun computed; drill-down flow; exportCsv; toggleShare; cloneReport |
| `globcrm-web/src/app/features/reports/report-viewer/report-chart.component.ts` | Chart viewer | VERIFIED | bar/line/pie(doughnut)/funnel via ng2-charts + chartjs-chart-funnel; onClick drill-down emits; polished tooltips/animations |
| `globcrm-web/src/app/features/reports/report-viewer/report-data-table.component.ts` | Data table | VERIFIED | mat-table with dynamic columns; mat-paginator; drill-down bar; Router.navigate via ENTITY_ROUTE_MAP on row click |
| `globcrm-web/src/app/features/reports/report-viewer/report-aggregation-cards.component.ts` | Aggregation cards | VERIFIED | KPI cards from aggregates input; formatValue method; cycling color accents |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `ReportRepository.cs` | `ApplicationDbContext.cs` | DbSet<Report> injection | WIRED | `_context.Reports` used on lines 27, 37, 80, 89, 97, 102 |
| `DependencyInjection.cs` | `ReportRepository.cs` | DI registration | WIRED | `services.AddScoped<IReportRepository, ReportRepository>()` at line 203 |
| `DependencyInjection.cs` | `ReportingServiceExtensions.cs` | AddReportingServices call | WIRED | `services.AddReportingServices()` at line 204 |
| `ReportFieldMetadataService.cs` | `FieldRegistryService.cs` | Constructor injection | WIRED | `_fieldRegistry.GetAvailableFields(entityType, [])` at line 35 |
| `ReportQueryEngine.cs` | `ApplicationDbContext.cs` | DbContext injection | WIRED | `_db.Contacts/Deals/Companies/...` on multiple lines |
| `ReportsController.cs` | `ReportQueryEngine.cs` | Service injection | WIRED | `_queryEngine.ExecuteReportAsync()` at line 252 |
| `ReportsController.cs` | `ReportFieldMetadataService.cs` | Service injection | WIRED | `_fieldMetadataService.GetFieldsForEntityTypeAsync()` at line 293 |
| `ReportCsvExportJob.cs` | `ReportQueryEngine.cs` | Service injection | WIRED | `_queryEngine.ExecuteReportAsync()` at line 73 |
| `app.routes.ts` | `reports.routes.ts` | Lazy-loaded feature route | WIRED | `loadChildren: import('./features/reports/reports.routes')` at line 183, guarded by permissionGuard('Report', 'View') |
| `report.service.ts` | ReportsController API | HTTP calls via ApiService | WIRED | `basePath = '/api/reports'`; 14 methods covering all endpoints |
| `entity-source-panel.component.ts` | `report.store.ts` | entityTypeChange -> loadFieldMetadata | WIRED | Builder's `onEntityTypeChange` calls `store.loadFieldMetadata(entityType)` at line 151 |
| `report-chart.component.ts` | `report-builder.component.ts` | drillDown output event | WIRED | `(drillDown)="onDrillDown($event)"` in template; builder re-executes with drillDownFilter |
| `report-data-table.component.ts` | Entity detail routes | Router navigation on row click | WIRED | `router.navigate(['/', routePath, id])` via ENTITY_ROUTE_MAP |

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| RPT-01 | 20-01, 20-02, 20-05 | User can select entity source and choose fields/columns for a report | SATISFIED | EntitySourcePanelComponent + FieldSelectorPanelComponent + ReportFieldMetadataService covers system, custom, formula, and related fields for all 8 entity types |
| RPT-02 | 20-02, 20-03, 20-05 | User can add filters with multiple conditions (AND/OR) | SATISFIED | FilterBuilderPanelComponent with recursive AND/OR groups; ReportQueryEngine.BuildFilterGroupExpression applies nested filter trees |
| RPT-03 | 20-02, 20-03, 20-05 | User can group results and apply aggregations | SATISFIED | GroupingPanelComponent + ReportQueryEngine.ExecuteGroupedQuery with Dynamic LINQ; AggregationType enum (Count/Sum/Average/Min/Max) |
| RPT-04 | 20-04, 20-06 | User can visualize as charts (bar, line, pie) or tables | SATISFIED | ReportChartComponent renders all 4 chart types + table mode; ChartConfigPanelComponent selects type |
| RPT-05 | 20-01, 20-03, 20-04 | User can save reports and share with team | SATISFIED | saveReport() creates/updates via API; toggleShare() PATCH endpoint; IsShared flag; 6 seed reports with IsShared=true |
| RPT-06 | 20-03, 20-06 | User can export to CSV | SATISFIED | POST /api/reports/{id}/export-csv enqueues Hangfire job; ReportCsvExportJob builds RFC 4180 CSV; SignalR notification on complete |
| RPT-07 | 20-02, 20-05 | User can include related entity fields (one level deep) | SATISFIED | ReportFieldMetadataService.GetRelatedFieldsForEntityType returns related fields with "related.{Entity}.{field}" FieldId format; ReportQueryEngine resolves related property paths |
| RPT-08 | 20-06 | User can drill down from chart data point to underlying records | SATISFIED | onClick handler emits ReportFilterCondition; builder re-executes executeReport with drillDownFilter; data table shows amber drill-down bar |

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `report-builder.component.ts` lines 195-196 | `runReport()` silently does nothing for new unsaved reports (no navigation, no feedback, no save-and-run) | Warning | User clicks Run Report on a new report in /reports/new with fields selected, nothing happens. Workaround: Save first, then run. The comment says "handled by saveAndRun pattern in the future." This is a known deferred UX gap, not a blocker since saved reports execute correctly. |

No blocker anti-patterns. No placeholder/stub implementations found in any key file. All "placeholder" text found is valid HTML input element placeholder attributes.

### Human Verification Required

**1. Report Gallery Visual Rendering**

**Test:** Navigate to /reports. Confirm the card grid loads with 6 seed report cards showing SVG chart thumbnails, entity type badges, category names, and "Last run: Never" text.
**Expected:** Responsive 1/2/3-column grid with card hover shadow; "Starter" chips on seed reports; Funnel/Bar/Pie/Table SVG thumbnails visible.
**Why human:** Visual rendering and CSS layout cannot be verified programmatically.

**2. New Report End-to-End Create and Run**

**Test:** Navigate to /reports/new. Select "Contact" from entity dropdown. Expand "Field Selector" panel, check "Name" and "Email" checkboxes. Click "Save". After navigation to edit URL, click "Run Report".
**Expected:** Report saves, URL changes to /reports/{id}/edit, Run Report executes and shows data table with contact rows (50 per page), pagination appears.
**Why human:** Full create-execute flow involves API calls, routing, and table rendering.

**3. Chart Drill-Down Interaction**

**Test:** Open "Deals by Stage" seed report. Click Run Report. Click a funnel chart segment.
**Expected:** Amber drill-down bar appears above data table showing "Filtered by: related.Stage.name = Proposal". Data table rows update to show only matching records. X button clears the filter.
**Why human:** Chart click interaction and table re-render requires runtime verification.

**4. CSV Export with SignalR Notification**

**Test:** On an executed report, click "Export CSV". Open browser network tab or notification panel.
**Expected:** Snackbar shows "Export started. You'll be notified when it's ready." SignalR delivers "ReportExportComplete" event. Notification panel shows download link.
**Why human:** Background job execution, SignalR delivery, and notification rendering require runtime.

**5. Related Entity Field Filter Execution**

**Test:** Create a report with "Deal" entity. Select "Stage > Name" from the Related Fields group. Add a filter on "Stage > Name" equals "Proposal". Save and run.
**Expected:** Field appears in the "Related Fields" expandable group in the field selector. Filter row shows "Stage > Name" in field dropdown. Executed report returns only deals with matching stage name.
**Why human:** Join query execution and result accuracy require runtime verification.

### Gaps Summary

No blocking gaps found. All 4 success criteria are verified with substantive implementations. All 8 requirements (RPT-01 through RPT-08) are satisfied.

**One known deferred UX gap (warning, not blocker):** Running a new unsaved report silently does nothing — the user must save first, then run. This is explicitly documented in the code as future work ("saveAndRun pattern"). The workaround is straightforward and the saved report execution path works correctly.

**Key implementation quality observations:**

1. The backend query engine (ReportQueryEngine.cs) has a full implementation with 700+ lines covering both flat and grouped query execution, recursive filter expression trees, and Dynamic LINQ grouping.

2. The filter builder is genuinely recursive — FilterBuilderPanelComponent references itself in its template with `[isNested]="true"` for child groups, supporting unlimited nesting depth.

3. The chart component handles 4 chart types with polished Chart.js options including easeOutQuart animations, rounded bar corners, doughnut variant for pie, and funnel via chartjs-chart-funnel.

4. RLS policies are applied to both `reports` and `report_categories` tables, and the migration creates 5 indexes including composite indexes optimized for the access patterns (tenant+entityType, tenant+owner+isShared).

5. TenantSeeder creates 3 categories and 6 seed reports demonstrating all chart types and common reporting patterns.

---

_Verified: 2026-02-19T18:34:20Z_
_Verifier: Claude (gsd-verifier)_

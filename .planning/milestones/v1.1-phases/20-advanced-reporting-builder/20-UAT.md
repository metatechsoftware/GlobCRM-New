---
status: complete
phase: 20-advanced-reporting-builder
source: [20-01-SUMMARY.md, 20-02-SUMMARY.md, 20-03-SUMMARY.md, 20-04-SUMMARY.md, 20-05-SUMMARY.md, 20-06-SUMMARY.md]
started: 2026-02-19T19:00:00Z
updated: 2026-02-19T19:15:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Navigate to Reports Gallery
expected: In the sidebar navigation, a "Reports" link with a bar_chart icon appears in the Analytics group (near Dashboard). Clicking it navigates to the reports gallery page.
result: pass
note: Fixed during UAT — EnsurePermissionsForAllEntityTypesAsync was not called during --reseed path. Added call to TenantSeeder.

### 2. View Seed Reports in Gallery
expected: The gallery page displays starter report cards in a responsive grid. Each card shows an SVG chart thumbnail matching its chart type (bar/line/pie/funnel/table), report name, entity type, and category. Category dropdown, entity type filter, and search box are available above the grid.
result: issue
reported: "There are no seed reports its empty right now"
severity: major

### 3. Create New Report - Entity Source Panel
expected: Clicking a "New Report" button opens the report builder with a two-panel layout (320px sidebar + preview area). The first sidebar panel lets you select an entity type from a dropdown (Contact, Deal, Company, Lead, Activity, Quote, Request, Product) plus enter report name, description, and category.
result: issue
reported: "there are no categories to select from, Entity Type is 'trending_upLeads' when I select Leads it should be 'Leads'"
severity: major

### 4. Select Report Fields
expected: After choosing an entity type, the field selector panel shows categorized checkbox lists: System fields, Custom fields, Formula fields, and Related fields (sub-grouped by related entity like "Related: Company"). A search box filters the field list. Checking fields adds them as report columns, with a selected count badge.
result: issue
reported: "In columns there is no fields to be selected and none can be searched."
severity: major

### 5. Configure Filter Conditions
expected: The filter builder panel lets you add filter conditions with field-type-adaptive operators (e.g., string fields show contains/equals/starts with; number fields show greater than/less than/between; date fields show before/after/between). You can toggle AND/OR logic and nest filter groups.
result: issue
reported: "Delete button for groups does not work."
severity: major

### 6. Configure Grouping & Aggregation
expected: The grouping panel lets you select a field to group by. Date fields offer truncation options (day/week/month/quarter/year). Numeric fields show aggregation type pickers (count/sum/average/min/max).
result: skipped
reason: Depends on field selector (Test 4) which is broken

### 7. Select Chart Type
expected: The chart config panel shows a toggle for chart types: Table, Bar, Line, Pie, and Funnel. Display options for legend and data labels are available as toggles.
result: pass

### 8. Run Report & View Results
expected: Clicking "Run Report" executes the query. The preview area shows the selected chart visualization (or data table if Table type selected) plus aggregation KPI summary cards with colored accent borders above a paginated data table.
result: skipped
reason: Depends on field selector (Test 4) which is broken

### 9. Open a Seed Report
expected: From the gallery, clicking a seed report card opens the builder with its configuration pre-loaded (entity type, fields, filters, grouping, chart type). Running it shows the visualization and data.
result: skipped
reason: No seed reports visible (Test 2)

### 10. Chart Drill-Down
expected: Clicking a bar/segment on a chart filters the data table to show only records for that group. An amber indicator bar appears above the data table showing the active drill-down filter, with a clear button to remove it.
result: skipped
reason: No seed reports visible (Test 2)

### 11. Data Table Row Navigation
expected: Clicking a row in the report data table navigates to that entity's detail page (e.g., clicking a contact row goes to /contacts/{id}).
result: skipped
reason: No seed reports visible (Test 2)

### 12. Save Report
expected: After configuring a report, clicking "Save" persists it. Navigating back to the gallery shows the newly saved report card with the correct chart thumbnail.
result: skipped
reason: Depends on field selector (Test 4) which is broken

### 13. CSV Export
expected: Clicking the export/CSV action on a report with results triggers a background job. A snackbar notification confirms the export has been queued.
result: skipped
reason: No seed reports visible (Test 2)

## Summary

total: 13
passed: 2
issues: 4
pending: 0
skipped: 7

## Gaps

- truth: "Gallery displays seed starter report cards"
  status: diagnosed
  reason: "User reported: There are no seed reports its empty right now"
  severity: major
  test: 2
  root_cause: "Multiple issues: (1) ReportRepository.GetAllAsync materializes full Report entities including heavy Definition JSONB — if JSONB deserialization fails the 500 error is silently caught by the store and gallery shows empty state with no error message. (2) ReportListDto.ChartType uses .ToString() producing PascalCase ('Bar','Funnel') but frontend expects lowercase ('bar','funnel') — card thumbnails won't match @switch cases. (3) Gallery template has no error display block. Fix: add .Select() projection to avoid loading Definition in list queries, normalize ChartType to lowercase, add error display to gallery."
  artifacts:
    - src/GlobCRM.Infrastructure/Reporting/ReportRepository.cs (GetAllAsync - needs projection)
    - src/GlobCRM.Api/Controllers/ReportsController.cs:652 (ChartType.ToString() - needs .ToLower())
    - globcrm-web/src/app/features/reports/report-gallery/report-gallery.component.html (needs error display)
  missing: []
  debug_session: ".planning/debug/empty-seed-reports-gallery.md"

- truth: "Entity source panel shows categories and clean entity type labels"
  status: diagnosed
  reason: "User reported: no categories to select from, Entity Type shows 'trending_upLeads' instead of 'Leads'"
  severity: major
  test: 3
  root_cause: "Two sub-issues: (1) mat-select renders textContent of selected mat-option which includes mat-icon ligature text ('trending_up') concatenated with label ('Leads') = 'trending_upLeads'. Fix: add <mat-select-trigger> to customize display. (2) No categories appearing — same root cause as gallery: API call to /api/reports/categories may return error silently, or categories load correctly but builder store instance is separate from gallery store."
  artifacts:
    - globcrm-web/src/app/features/reports/report-builder/entity-source-panel.component.ts (missing mat-select-trigger)
  missing: []
  debug_session: ".planning/debug/entity-source-icon-label-leak.md"

- truth: "Field selector panel shows categorized fields for selected entity type"
  status: diagnosed
  reason: "User reported: no fields to be selected and none can be searched"
  severity: major
  test: 4
  root_cause: "Code chain (store.loadFieldMetadata → GET /api/reports/fields/{entityType} → ReportFieldMetadataService → FieldRegistryService) appears correct. Backend compiles, services registered. Most likely: API returns 500 error at runtime that store catches silently and patches error state, but builder only shows error in preview area (line 146-151 of template), not near the field selector panel. Need to: (1) verify API endpoint works via manual test, (2) add error feedback near field selector, (3) ensure FieldRegistryService returns fields for all entity types."
  artifacts:
    - globcrm-web/src/app/features/reports/report-builder/report-builder.component.html (error only in preview area)
    - src/GlobCRM.Infrastructure/Reporting/ReportFieldMetadataService.cs
    - globcrm-web/src/app/features/reports/report.store.ts (loadFieldMetadata error handler)
  missing: []
  debug_session: ".planning/debug/empty-field-selector.md"

- truth: "Filter builder group delete button removes the group"
  status: diagnosed
  reason: "User reported: Delete button for groups does not work"
  severity: major
  test: 5
  root_cause: "Two missing pieces: (1) Recursive child <app-filter-builder-panel> (lines 208-214) only binds (filterGroupChange), missing (removeRequest) binding on child group instances. (2) No handler method exists to splice a child group from the parent's groups array — removeGroup() at line 503 emits removeRequest.emit() but no parent listens."
  artifacts:
    - globcrm-web/src/app/features/reports/report-builder/filter-builder-panel.component.ts (lines 208-214, 503)
  missing: []
  debug_session: ".planning/debug/filter-group-delete-broken.md"

---
phase: 20-advanced-reporting-builder
verified: 2026-02-19T22:45:00Z
status: passed
score: 4/4 success criteria verified
re_verification:
  previous_status: passed
  previous_score: 4/4
  gaps_closed:
    - "Gallery API returns reports without materializing Definition JSONB (GetAllAsync projection fix)"
    - "ReportListDto.ChartType and ReportDto.ChartType return lowercase strings (ToLowerInvariant fix)"
    - "Gallery shows meaningful error state with retry button instead of silent empty state"
    - "Entity type dropdown shows clean label text via mat-select-trigger (no icon ligature leak)"
    - "Builder sidebar shows error messages near field selector panel"
    - "loadFieldMetadata clears stale state and extracts API error messages properly"
    - "Recursive filter group delete button removes child group from parent via (removeRequest) binding"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Navigate to /reports after reseed and verify gallery loads seed report cards"
    expected: "6 seed cards visible with SVG thumbnails matching chart types; no false empty state"
    why_human: "JSONB projection fix prevents 500 errors at DB level; actual gallery rendering requires runtime"
  - test: "Select 'Leads' from entity type dropdown on /reports/new"
    expected: "Trigger shows 'Leads' not 'trending_upLeads'; field selector populates with Lead fields"
    why_human: "mat-select-trigger rendering and API field loading require runtime verification"
  - test: "Add nested filter groups, then delete a child group"
    expected: "Child group removed from UI; parent group intact; no console errors"
    why_human: "Recursive component event propagation requires runtime interaction"
---

# Phase 20: Advanced Reporting Builder Verification Report

**Phase Goal:** Users can build custom reports by selecting entity sources, fields (including formula fields and related entity fields), filters, groupings, and visualizations — then save, share, and export them
**Verified:** 2026-02-19T22:45:00Z
**Status:** passed
**Re-verification:** Yes — after UAT gap closure (plans 20-07 and 20-08)

## Re-Verification Context

The initial verification (2026-02-19T18:34:20Z) returned `status: passed` based on static code analysis. Subsequent UAT (20-UAT.md) uncovered 4 runtime gaps:

1. Gallery showed empty state instead of seed reports (JSONB deserialization issue — 500 errors swallowed silently)
2. Entity type dropdown displayed "trending_upLeads" instead of "Leads" (mat-icon ligature leak)
3. Field selector showed no fields (API errors not visible near the panel)
4. Nested filter group delete button did nothing (missing `(removeRequest)` binding on recursive child)

Gap closure plans 20-07 (backend) and 20-08 (frontend) were executed and committed:
- `31cf082` — fix(20-07): fix empty gallery and chart type casing in report API
- `85da4c1` — fix(20-08): add gallery error display and fix entity source mat-select trigger
- `6ce826c` — fix(20-08): add builder sidebar error, improve loadFieldMetadata, fix filter group delete

All three commits verified in git log. This re-verification confirms all four gaps are closed in the actual codebase.

## Goal Achievement

### Observable Truths (from Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can create a report by selecting entity source, choosing fields (including formula and related entity fields one level deep), and adding filter conditions with AND/OR logic | VERIFIED | mat-select-trigger + selectedEntityLabel computed signal fixes label display; (removeRequest) binding now wired on recursive filter child; FieldSelectorPanelComponent system/custom/formula/related groups; ReportQueryEngine handles all 8 entity types |
| 2 | User can group report results and apply aggregations (count, sum, average, min, max) to numeric and formula fields | VERIFIED | GroupingPanelComponent with groupingsChange + aggregationsChange outputs; ReportQueryEngine.ExecuteGroupedQuery with Dynamic LINQ; ReportAggregationCardsComponent renders KPI cards — no regression |
| 3 | User can visualize report results as charts (bar, line, pie) or tables, and drill down from chart data point to view underlying records | VERIFIED | ReportChartComponent onClick emitting drillDown; drillDownFilter signal at line 74; onDrillDown at lines 234-245; data table drill-down bar — no regression |
| 4 | User can save reports, share them with team members, and export results to CSV | VERIFIED | saveReport/createReport/updateReport intact; PATCH /share intact; POST /export-csv + Hangfire job intact; ReportListDto.FromEntity and ReportDto.FromEntity both produce lowercase ChartType via ToLowerInvariant() at lines 614, 652 |

**Score:** 4/4 success criteria verified

### Gap Closure Verification

| Gap (UAT Test) | Fix Applied | Status | Codebase Evidence |
|----------------|-------------|--------|-------------------|
| Test 2: Empty gallery (JSONB 500 swallowed) | GetAllAsync anonymous type projection with AsNoTracking excludes Definition column | CLOSED | `ReportRepository.cs` lines 66-107: `.Select(r => new { r.Id, r.TenantId, r.Name, ... })` — Definition intentionally excluded per inline comment |
| Test 2: Wrong ChartType casing | ReportDto and ReportListDto use `.ToString().ToLowerInvariant()` | CLOSED | `ReportsController.cs` line 614 (ReportDto) and line 652 (ReportListDto): both confirmed |
| Test 2: Gallery silent error state | Error block with retry button; !store.error() guards on empty/grid states | CLOSED | `report-gallery.component.html` lines 77-88: error block; line 90: `!store.error() && reports.length === 0`; line 105: `!store.error() && reports.length > 0` |
| Test 3: Entity type icon ligature leak | mat-select-trigger with selectedEntityLabel computed signal | CLOSED | `entity-source-panel.component.ts` lines 78-80: trigger template; lines 159-164: computed signal finds option by value and returns label |
| Test 4: Field selector errors invisible | Sidebar error block in builder template; loadFieldMetadata clears stale state | CLOSED | `report-builder.component.html` lines 61-65: sidebar `@if (store.error())` block; `report.store.ts` line 199: `patchState(store, { fieldMetadata: null, error: null })` at start |
| Test 5: Filter group delete broken | (removeRequest) binding added on recursive child; onChildGroupRemove handler added | CLOSED | `filter-builder-panel.component.ts` line 214: `(removeRequest)="onChildGroupRemove(childIdx)"`; lines 516-520: handler filters groups array and emits update |

### Required Artifacts (Regression Check)

All key artifacts from original verification remain intact. Only files modified in gap closure are noted below.

| Artifact | Status | Gap Closure Notes |
|----------|--------|-------------------|
| `src/GlobCRM.Infrastructure/Reporting/ReportRepository.cs` | VERIFIED | Modified: GetAllAsync now uses anonymous projection; all other CRUD methods unchanged |
| `src/GlobCRM.Api/Controllers/ReportsController.cs` | VERIFIED | Modified: ToLowerInvariant() at lines 614 and 652; all 14 endpoints intact |
| `src/GlobCRM.Infrastructure/Reporting/ReportQueryEngine.cs` | VERIFIED | Unchanged (1051 lines); ExecuteReportAsync wired at controller line 252 |
| `globcrm-web/src/app/features/reports/report-gallery/report-gallery.component.html` | VERIFIED | Modified: error/empty/grid states mutually exclusive via !store.error() guards |
| `globcrm-web/src/app/features/reports/report-builder/entity-source-panel.component.ts` | VERIFIED | Modified: mat-select-trigger at lines 78-80; selectedEntityLabel computed at lines 159-164 |
| `globcrm-web/src/app/features/reports/report-builder/filter-builder-panel.component.ts` | VERIFIED | Modified: removeRequest output at line 359; (removeRequest) binding at line 214; onChildGroupRemove at lines 516-520 |
| `globcrm-web/src/app/features/reports/report-builder/report-builder.component.html` | VERIFIED | Modified: sidebar error block at lines 61-65; drill-down wiring at lines 154-157 still intact |
| `globcrm-web/src/app/features/reports/report.store.ts` | VERIFIED | Modified: loadFieldMetadata at lines 198-211 clears state at start; error extraction chain at line 207 |

### Key Link Verification (Gap Closure)

| From | To | Via | Status | Evidence |
|------|----|----|--------|---------|
| `ReportRepository.cs` GetAllAsync | DB query without Definition JSONB | `.Select(r => new { ... })` anonymous type | WIRED | Lines 69-85: anonymous select; line 96: Category.Name inlined; line 98: Owner names inlined; Definition excluded |
| `ReportsController.cs` ReportListDto | Frontend `ReportChartType` union | `ChartType.ToString().ToLowerInvariant()` | WIRED | Line 652 confirmed lowercase; frontend `'table' | 'bar' | 'line' | 'pie' | 'funnel'` will match |
| `report-gallery.component.html` | `store.error()` display | Error block conditional rendering | WIRED | Line 77: `@if (!store.loading() && store.error())`; retry button calls `loadReports()` (made public) |
| `entity-source-panel.component.ts` template | `selectedEntityLabel` signal | `<mat-select-trigger>{{ selectedEntityLabel() }}</mat-select-trigger>` | WIRED | Lines 78-80: trigger; computed signal finds entity option by value |
| `filter-builder-panel.component.ts` recursive child | `onChildGroupRemove(childIdx)` parent method | `(removeRequest)="onChildGroupRemove(childIdx)"` output binding | WIRED | Line 214: binding confirmed; lines 516-520: `.filter((_, i) => i !== index)` then `emitUpdate` |
| `report.store.ts` loadFieldMetadata | API error visible in sidebar | `patchState` clears state at start; error stored for sidebar display | WIRED | Line 199: `{ fieldMetadata: null, error: null }` cleared at start; line 207: API error extracted and stored |

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| RPT-01 | 20-01, 20-02, 20-05, 20-07, 20-08 | User can select entity source and choose fields/columns | SATISFIED | Entity source panel label fix; field metadata errors now visible; 8 entity types; REQUIREMENTS.md line 73: checked, Phase 20 Complete |
| RPT-02 | 20-02, 20-03, 20-05, 20-08 | User can add filters with AND/OR conditions | SATISFIED | FilterBuilderPanelComponent (removeRequest) binding wired on recursive child; delete functional; REQUIREMENTS.md line 74: checked |
| RPT-03 | 20-02, 20-03, 20-05 | User can group results and apply aggregations | SATISFIED | GroupingPanelComponent + Dynamic LINQ grouped queries; no gap closure changes; REQUIREMENTS.md line 75: checked |
| RPT-04 | 20-04, 20-06, 20-07, 20-08 | User can visualize as charts or table | SATISFIED | ChartType lowercase serialization ensures SVG thumbnails match @switch cases; REQUIREMENTS.md line 76: checked |
| RPT-05 | 20-01, 20-03, 20-04, 20-07 | User can save and share reports | SATISFIED | Save/share API intact; GetAllAsync projection means saved reports appear in gallery; REQUIREMENTS.md line 77: checked |
| RPT-06 | 20-03, 20-06 | User can export to CSV | SATISFIED | POST /api/reports/{id}/export-csv + ReportCsvExportJob + SignalR; no regression; REQUIREMENTS.md line 78: checked |
| RPT-07 | 20-02, 20-05 | User can include related entity fields | SATISFIED | FieldMetadataService related fields + ReportQueryEngine path resolution; no regression; REQUIREMENTS.md line 79: checked |
| RPT-08 | 20-06 | User can drill down from chart to records | SATISFIED | drillDown output + onDrillDown handler + drillDownFilter signal intact; no regression; REQUIREMENTS.md line 80: checked |

All 8 RPT requirements marked Complete in REQUIREMENTS.md (lines 192-199). No orphaned requirements.

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `report-builder.component.ts` | `runReport()` is a no-op for new unsaved reports — user must save first | Warning (deferred UX) | Explicitly documented in code as future "saveAndRun pattern"; pre-existing from initial implementation; not introduced by gap closure; saved report execution works correctly |

No blocker anti-patterns. No new anti-patterns introduced by plans 20-07 or 20-08.

### Human Verification Required

**1. Gallery Seed Reports Now Visible**

**Test:** Run `dotnet run -- --reseed` from `src/GlobCRM.Api`, then navigate to `/reports`.
**Expected:** 6 seed report cards visible in responsive grid. Each card shows SVG thumbnail matching its chart type (bar/line/pie/funnel/table). No misleading "No reports found" empty state.
**Why human:** JSONB projection prevents deserialization 500 at DB query level. Actual gallery rendering and seed data presence require runtime verification.

**2. Clean Entity Type Dropdown Label**

**Test:** Navigate to `/reports/new`. Click the Entity Type dropdown. Select "Leads".
**Expected:** Option list shows icons alongside labels. After selecting, the dropdown trigger shows only "Leads" — not "trending_upLeads".
**Why human:** mat-select-trigger display involves Angular Material's CSS ligature behavior, which requires browser rendering to verify.

**3. Field Selector Populates (Error Visible If API Fails)**

**Test:** On `/reports/new`, select "Contact" from Entity Type. Watch the field selector panel.
**Expected:** Field selector shows checkboxes in 4 groups (System, Custom, Formula, Related). If API fails, an amber warning bar appears in the sidebar near the field selector — not only in the preview area.
**Why human:** API call and sidebar error display location require runtime verification.

**4. Nested Filter Group Delete**

**Test:** On report builder, click "+ Add Group" twice to create two nested filter groups. Click the delete button on the inner child group.
**Expected:** Inner group is removed from the UI. Outer group and parent filter remain. No console errors.
**Why human:** Recursive Angular component output binding propagation requires runtime interaction to verify correct behavior.

**5. Chart SVG Thumbnails Match Chart Types**

**Test:** Navigate to `/reports` gallery after seeding. Compare card thumbnails to their chart type labels.
**Expected:** Bar chart reports show horizontal bar SVG; funnel reports show funnel SVG; pie reports show circle SVG.
**Why human:** The ToLowerInvariant() fix enables `@switch` case matching — actual SVG rendering requires browser verification.

### Gaps Summary

No blocking gaps remain. All 4 UAT gaps are closed and verified in the codebase.

**Gap closure summary:**
- Backend (`31cf082`): GetAllAsync projects into anonymous type to exclude Definition JSONB; both DTO FromEntity methods produce lowercase ChartType strings via ToLowerInvariant()
- Frontend Task 1 (`85da4c1`): Gallery error block added with mutually exclusive empty/grid state guards; entity-source mat-select-trigger with computed selectedEntityLabel signal
- Frontend Task 2 (`6ce826c`): Builder sidebar error block added; loadFieldMetadata clears stale state and extracts API error messages; filter-builder recursive child binds (removeRequest) output; onChildGroupRemove handler splices child group and propagates change

**Known deferred item (not a gap):** Running a new unsaved report is a silent no-op — user must save first, then run. This is explicitly documented in the code as a future "saveAndRun pattern". It pre-exists from the initial implementation and was not introduced by gap closure.

---

_Verified: 2026-02-19T22:45:00Z_
_Verifier: Claude (gsd-verifier)_
_Re-verification: After UAT gap closure plans 20-07 and 20-08_

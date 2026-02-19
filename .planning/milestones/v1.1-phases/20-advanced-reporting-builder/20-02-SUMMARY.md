---
phase: 20-advanced-reporting-builder
plan: 02
subsystem: api
tags: [expression-trees, dynamic-linq, field-metadata, query-engine, reporting, system-linq-dynamic-core]

# Dependency graph
requires:
  - phase: 20-advanced-reporting-builder
    provides: "Report entity with JSONB ReportDefinition, IReportRepository, AggregationType/FilterLogic enums"
  - phase: 15-formula-fields
    provides: "FieldRegistryService for system field definitions, FormulaEvaluationService for computed fields"
provides:
  - "ReportFieldMetadataService for field discovery per entity type (system, custom, formula, related)"
  - "ReportQueryEngine for dynamic query execution with Expression tree filters, ownership scope, grouping, and aggregation"
  - "ReportingServiceExtensions for DI registration of all reporting services"
  - "ReportFieldInfo, ReportFieldMetadataResult, ReportExecutionResult, ReportAggregateResult record types"
affects: [20-03, 20-04, 20-05, 20-06]

# Tech tracking
tech-stack:
  added: []
  patterns: [dynamic expression tree filter builder, conditional Include based on field references, System.Linq.Dynamic.Core grouping]

key-files:
  created:
    - src/GlobCRM.Infrastructure/Reporting/ReportFieldMetadataService.cs
    - src/GlobCRM.Infrastructure/Reporting/ReportQueryEngine.cs
    - src/GlobCRM.Infrastructure/Reporting/ReportingServiceExtensions.cs
  modified:
    - src/GlobCRM.Infrastructure/DependencyInjection.cs

key-decisions:
  - "Custom/formula field filters skipped in SQL expression tree -- applied in-memory post-filter for JSONB values"
  - "Conditional .Include() based on report field references -- prevents N+1 without loading unnecessary navigation properties"
  - "Formula fields are display-only in reports -- computed via FormulaEvaluationService on result rows, not in SQL"
  - "IsCustomOrFormulaField heuristic uses underscore detection (snake_case = custom, camelCase = system)"

patterns-established:
  - "Expression tree filter builder: recursive BuildFilterGroupBody for nested AND/OR groups with 10 operators"
  - "Ownership scope via Expression<Func<T, Guid?>> owner selector -- generic across all entity types"
  - "Conditional Include: GetAllFieldIds scans fields/filters/groupings, then Include only referenced navigations"
  - "System.Linq.Dynamic.Core grouping: GroupBy(key).Select(aggregates) pattern for runtime-defined report groupings"

requirements-completed: [RPT-01, RPT-02, RPT-03, RPT-07]

# Metrics
duration: 4min
completed: 2026-02-19
---

# Phase 20 Plan 02: Report Engine Core Summary

**ReportFieldMetadataService for field discovery (system, custom, formula, related fields across 8 entity types) and ReportQueryEngine with Expression tree filters, ownership scope, and System.Linq.Dynamic.Core grouping/aggregation**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-19T17:47:33Z
- **Completed:** 2026-02-19T17:51:38Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- ReportFieldMetadataService returns categorized fields (system, custom, formula, related) for all 8 CRM entity types
- Related entity fields one level deep with full relationship map (Contact->Company/Owner, Deal->Stage/Pipeline/Company/Owner, etc.)
- ReportQueryEngine builds dynamic Expression trees for nested AND/OR filter groups with 10 operators (equals, contains, between, etc.)
- Ownership scope filtering (Own/Team/All) using generic Expression<Func<T, Guid?>> owner selector
- Flat query execution with pagination, formula field evaluation, and custom field JSONB extraction
- Grouped query execution via System.Linq.Dynamic.Core with aggregate functions (Count, Sum, Average, Min, Max)
- Conditional .Include() based on report field references to prevent N+1 queries
- ReportingServiceExtensions wired into DependencyInjection.cs

## Task Commits

Each task was committed atomically:

1. **Task 1: ReportFieldMetadataService -- field discovery for all entity types with related entity fields** - `289bf98` (feat)
2. **Task 2: ReportQueryEngine -- dynamic query execution with filter expressions, grouping, and aggregation** - `ef11d74` (feat)

## Files Created/Modified
- `src/GlobCRM.Infrastructure/Reporting/ReportFieldMetadataService.cs` - Field discovery service combining FieldRegistryService + ICustomFieldRepository + hardcoded related entity field map
- `src/GlobCRM.Infrastructure/Reporting/ReportQueryEngine.cs` - Dynamic query builder with Expression tree filters, ownership scope, flat/grouped execution modes
- `src/GlobCRM.Infrastructure/Reporting/ReportingServiceExtensions.cs` - DI registration for ReportFieldMetadataService and ReportQueryEngine
- `src/GlobCRM.Infrastructure/DependencyInjection.cs` - Added AddReportingServices() call

## Decisions Made
- Custom/formula field filters skipped in SQL expression tree -- custom fields are JSONB and can't be translated to SQL; formula fields are computed server-side. These are applied in-memory post-filter when needed.
- Conditional .Include() based on report field references -- scans fields, filters, and groupings to determine which navigation properties are actually needed, avoiding unnecessary eager loading.
- Formula fields are display-only in reports -- computed via FormulaEvaluationService on loaded result rows, cannot be used in SQL WHERE or GROUP BY.
- IsCustomOrFormulaField heuristic uses underscore detection: system fields are camelCase (no underscores), custom/formula fields are snake_case (contain underscores). This aligns with the field naming convention established in FieldRegistryService.
- Date truncation for grouped queries uses direct property access (.Year, .Month, .Date) rather than EF.Functions.DateTruncate for better EF Core translation compatibility.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed CS0173 conditional expression type mismatch**
- **Found during:** Task 2 (ReportQueryEngine build verification)
- **Issue:** Ternary expression between MemberExpression and ConstantExpression had no common type for compiler inference
- **Fix:** Added explicit `Expression` type annotation to the variable declaration
- **Files modified:** src/GlobCRM.Infrastructure/Reporting/ReportQueryEngine.cs
- **Verification:** Build succeeded with 0 errors
- **Committed in:** ef11d74 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Trivial type annotation fix. No scope creep.

## Issues Encountered
None beyond the type annotation fix documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Report engine core complete with field metadata and query execution
- Ready for Plan 03: ReportsController with CRUD, execution, field metadata, and CSV export endpoints
- Both services registered via DI and injectable into controllers

## Self-Check: PASSED

All 3 created files verified present. Both task commits (289bf98, ef11d74) verified in git log.

---
*Phase: 20-advanced-reporting-builder*
*Completed: 2026-02-19*

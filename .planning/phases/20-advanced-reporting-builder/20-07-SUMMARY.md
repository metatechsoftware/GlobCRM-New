---
phase: 20-advanced-reporting-builder
plan: 07
subsystem: api
tags: [ef-core, jsonb, projection, dto, reporting]

# Dependency graph
requires:
  - phase: 20-03
    provides: "ReportsController DTOs and ReportRepository"
  - phase: 20-04
    provides: "Frontend gallery expecting lowercase ChartType values"
provides:
  - "Lightweight gallery API that excludes Definition JSONB from list queries"
  - "Lowercase ChartType serialization matching frontend type expectations"
affects: [20-08]

# Tech tracking
tech-stack:
  added: []
  patterns: [anonymous-type-projection-for-jsonb-exclusion]

key-files:
  created: []
  modified:
    - src/GlobCRM.Infrastructure/Reporting/ReportRepository.cs
    - src/GlobCRM.Api/Controllers/ReportsController.cs

key-decisions:
  - "Anonymous type projection with AsNoTracking for JSONB exclusion -- EF Core cannot project into entity type used in DbSet"
  - "ChartType uses ToString().ToLowerInvariant() to match frontend TypeScript union type ('bar' | 'line' | 'pie' | 'funnel' | 'table')"

patterns-established:
  - "JSONB exclusion pattern: .Select() into anonymous type then .ToList().Select() to map back to entity for DTO compatibility"

requirements-completed: [RPT-01, RPT-04, RPT-05]

# Metrics
duration: 2min
completed: 2026-02-19
---

# Phase 20 Plan 07: Gallery API Fix Summary

**GetAllAsync projection excludes Definition JSONB to prevent 500 errors, ChartType serialized lowercase for frontend SVG thumbnail matching**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-19T19:28:15Z
- **Completed:** 2026-02-19T19:29:47Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- Fixed empty gallery by replacing full entity load with .Select() projection that excludes Definition JSONB column
- Fixed chart type thumbnail mismatch by adding .ToLowerInvariant() to both ReportDto and ReportListDto ChartType serialization
- Backend compiles cleanly with 0 errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix ReportRepository.GetAllAsync to use projection and fix ChartType casing in DTOs** - `31cf082` (fix)

**Plan metadata:** `d271d6f` (docs: complete plan)

## Files Created/Modified
- `src/GlobCRM.Infrastructure/Reporting/ReportRepository.cs` - GetAllAsync now uses anonymous type projection with AsNoTracking, excludes Definition JSONB, maps Category and Owner names inline
- `src/GlobCRM.Api/Controllers/ReportsController.cs` - ReportDto.FromEntity and ReportListDto.FromEntity both produce lowercase ChartType strings via ToLowerInvariant()

## Decisions Made
- Used anonymous type projection + in-memory mapping back to Report entities (rather than direct entity projection) because EF Core does not allow projecting into the same entity type used in the DbSet
- Added AsNoTracking() since list query results are read-only DTOs and never need change tracking

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Gallery API now returns report list data safely without JSONB deserialization risk
- Frontend SVG thumbnail @switch cases will correctly match lowercase chart type values
- Ready for Plan 08 (remaining gap closure items)

## Self-Check: PASSED

- FOUND: src/GlobCRM.Infrastructure/Reporting/ReportRepository.cs
- FOUND: src/GlobCRM.Api/Controllers/ReportsController.cs
- FOUND: .planning/phases/20-advanced-reporting-builder/20-07-SUMMARY.md
- FOUND: commit 31cf082

---
*Phase: 20-advanced-reporting-builder*
*Completed: 2026-02-19*

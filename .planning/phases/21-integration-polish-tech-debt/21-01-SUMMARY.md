---
phase: 21-integration-polish-tech-debt
plan: 01
subsystem: api
tags: [di, hangfire, duplicate-detection, refactoring, tech-debt]

# Dependency graph
requires:
  - phase: 20-advanced-reporting-builder
    provides: "ReportCsvExportJob class and ReportingServiceExtensions DI registration"
  - phase: 16-duplicate-detection-merge
    provides: "DuplicateMatch record, DuplicateDetectionService, DuplicatesController"
provides:
  - "ReportCsvExportJob registered in DI for Hangfire CSV export resolution"
  - "Clean Program.cs DI pipeline without duplicate registrations"
  - "Semantically correct DuplicateMatch.SecondaryField for entity-type-specific data"
affects: [duplicate-detection-merge, advanced-reporting-builder]

# Tech tracking
tech-stack:
  added: []
  patterns: ["SecondaryField pattern for polymorphic record properties"]

key-files:
  created: []
  modified:
    - "src/GlobCRM.Infrastructure/Reporting/ReportingServiceExtensions.cs"
    - "src/GlobCRM.Api/Program.cs"
    - "src/GlobCRM.Domain/Interfaces/IDuplicateDetectionService.cs"
    - "src/GlobCRM.Infrastructure/Duplicates/DuplicateDetectionService.cs"
    - "src/GlobCRM.Api/Controllers/DuplicatesController.cs"

key-decisions:
  - "Removed unused DomainEvents and EmailTemplates using directives from Program.cs after removing duplicate calls"
  - "Company DuplicateMatch passes null for Email and Website as SecondaryField (companies have no per-match email)"

patterns-established:
  - "SecondaryField pattern: polymorphic records use explicit named fields instead of overloading existing properties"

requirements-completed: [RPT-06]

# Metrics
duration: 2min
completed: 2026-02-19
---

# Phase 21 Plan 01: Backend Integration Gap Closure Summary

**ReportCsvExportJob DI registration, duplicate Program.cs service call removal, and DuplicateMatch SecondaryField refactor for semantic correctness**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-19T20:44:56Z
- **Completed:** 2026-02-19T20:47:23Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- ReportCsvExportJob now registered in AddReportingServices() so Hangfire can resolve it without activation errors
- Removed duplicate AddDomainEventServices() and AddEmailTemplateServices() calls from Program.cs that were already called via AddInfrastructure()
- DuplicateMatch record refactored with explicit SecondaryField property, eliminating misleading Email field overloading for company Website data

## Task Commits

Each task was committed atomically:

1. **Task 1: Register ReportCsvExportJob in DI and remove duplicate service registrations** - `16431d8` (fix)
2. **Task 2: Refactor DuplicateMatch record to use SecondaryField instead of overloaded Email property** - `2b4ad0d` (refactor)

## Files Created/Modified
- `src/GlobCRM.Infrastructure/Reporting/ReportingServiceExtensions.cs` - Added ReportCsvExportJob DI registration
- `src/GlobCRM.Api/Program.cs` - Removed duplicate AddDomainEventServices() and AddEmailTemplateServices() calls, cleaned unused using directives
- `src/GlobCRM.Domain/Interfaces/IDuplicateDetectionService.cs` - Added SecondaryField parameter to DuplicateMatch record
- `src/GlobCRM.Infrastructure/Duplicates/DuplicateDetectionService.cs` - Updated all DuplicateMatch constructors to use SecondaryField for company Website
- `src/GlobCRM.Api/Controllers/DuplicatesController.cs` - Updated company DTO mappings to read Website from m.SecondaryField

## Decisions Made
- Removed unused `using GlobCRM.Infrastructure.DomainEvents` and `using GlobCRM.Infrastructure.EmailTemplates` from Program.cs after removing the duplicate registration calls
- Company DuplicateMatch passes `null` for Email and the website value as SecondaryField, since companies have no per-match email (company email comes from the enrichment query)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All three audit gaps (INT-01, INT-03, TD-01) are closed
- Backend builds cleanly with all fixes applied
- Ready for Plan 02 (frontend polish and remaining tech debt)

## Self-Check: PASSED

All 5 modified source files verified on disk. Both task commits (16431d8, 2b4ad0d) verified in git log. SUMMARY.md exists.

---
*Phase: 21-integration-polish-tech-debt*
*Completed: 2026-02-19*

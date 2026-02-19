---
phase: 16-duplicate-detection-merge
plan: 02
subsystem: api
tags: [duplicate-detection, merge, api-endpoints, fluent-validation, ef-core]

# Dependency graph
requires:
  - phase: 16-duplicate-detection-merge
    plan: 01
    provides: IDuplicateDetectionService, ContactMergeService, CompanyMergeService, DuplicateMatchingConfig entity, MergedIntoId on Contact/Company
provides:
  - DuplicatesController with 10 endpoints (check, scan, merge-preview, comparison, merge for contacts and companies)
  - DuplicateSettingsController with 3 endpoints (GET all, GET by entity type, PUT update)
  - Merged-record redirect handling in ContactsController and CompaniesController GetById
  - MergedRedirectDto for frontend redirect detection
  - ContactDuplicateMatchDto, CompanyDuplicateMatchDto, MergePreviewDto, MergeResultDto response DTOs
  - ContactComparisonRecordDto, CompanyComparisonRecordDto for side-by-side merge UI
affects: [16-03-frontend, 16-04-settings]

# Tech tracking
tech-stack:
  added: []
  patterns: [merged-record-redirect, auto-create-default-config, scan-enrichment]

key-files:
  created:
    - src/GlobCRM.Api/Controllers/DuplicatesController.cs
    - src/GlobCRM.Api/Controllers/DuplicateSettingsController.cs
  modified:
    - src/GlobCRM.Api/Controllers/ContactsController.cs
    - src/GlobCRM.Api/Controllers/CompaniesController.cs

key-decisions:
  - "DuplicatePairDto uses object-typed RecordA/RecordB to polymorphically hold ContactDuplicateMatchDto or CompanyDuplicateMatchDto"
  - "Merged-record redirect returns 200 with MergedRedirectDto (isMerged: true, mergedIntoId) instead of 301 for simpler frontend handling"
  - "DuplicateSettingsController auto-creates default configs when none exist for a tenant"
  - "Scan endpoints enrich DuplicateMatch records with phone/company details via secondary DB query"
  - "MergePreviewDto includes LeadCount combining Leads.ConvertedContactId + LeadConversions.ContactId"

patterns-established:
  - "Merged-record redirect: GetById returns 200 with {isMerged, mergedIntoId} when record was merged, using IgnoreQueryFilters"
  - "Auto-create default config: DuplicateSettingsController creates default DuplicateMatchingConfig on first access"
  - "Scan enrichment: paginated scan results enriched with additional fields via secondary dictionary lookup"

requirements-completed: [DUP-01, DUP-02, DUP-03, DUP-04, DUP-05, DUP-06, DUP-07]

# Metrics
duration: 5min
completed: 2026-02-19
---

# Phase 16 Plan 02: API Endpoints Summary

**DuplicatesController with 10 endpoints for check/scan/merge-preview/comparison/merge, DuplicateSettingsController for admin config, and merged-record redirect in Contact/Company GetById**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-19T08:54:15Z
- **Completed:** 2026-02-19T08:59:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- DuplicatesController with 10 endpoints: check (2), scan (2), merge-preview (2), merge (2), comparison (2) for both contacts and companies
- DuplicateSettingsController with 3 admin endpoints for listing, getting, and updating matching config per entity type with auto-creation of defaults
- Merged-record redirect in ContactsController and CompaniesController GetById endpoints using IgnoreQueryFilters
- FluentValidation for merge requests (SurvivorId/LoserId required and must differ) and settings updates (threshold 50-100)
- Co-located DTOs with static FromEntity factory methods following established controller pattern

## Task Commits

Each task was committed atomically:

1. **Task 1: DuplicatesController with check, scan, merge-preview, comparison, and merge endpoints** - `7a0963d` (feat)
2. **Task 2: DuplicateSettingsController and merged-record redirect in Contact/Company controllers** - `ecb4cf5` (feat)

## Files Created/Modified
- `src/GlobCRM.Api/Controllers/DuplicatesController.cs` - 10 endpoints for duplicate check, scan, merge-preview, comparison, and merge
- `src/GlobCRM.Api/Controllers/DuplicateSettingsController.cs` - 3 admin endpoints for matching config CRUD with auto-defaults
- `src/GlobCRM.Api/Controllers/ContactsController.cs` - Added merged-record redirect in GetById, MergedRedirectDto
- `src/GlobCRM.Api/Controllers/CompaniesController.cs` - Added merged-record redirect in GetById

## Decisions Made
- DuplicatePairDto uses `object` typed RecordA/RecordB to allow polymorphic contact/company match DTOs in the same paginated wrapper
- Merged-record redirect returns 200 with `{isMerged: true, mergedIntoId}` instead of HTTP 301 -- simpler for Angular HttpClient to handle since 301 would cause browser redirect
- DuplicateSettingsController auto-creates default configs (threshold 70, auto-detection enabled) when no configs exist for a tenant, avoiding null handling in frontend
- Scan endpoints perform secondary DB queries to enrich DuplicateMatch results with phone, companyName, email fields not available from the detection service
- MergePreviewDto LeadCount combines both Leads.ConvertedContactId and LeadConversions.ContactId counts for complete coverage
- Comparison endpoints use IgnoreQueryFilters to load even recently merged records for edge case where one record was merged between page load and comparison request

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed anonymous type dictionary to dynamic conversion error**
- **Found during:** Task 1 (DuplicatesController scan endpoints)
- **Issue:** Helper methods accepting `Dictionary<Guid, dynamic>` could not receive anonymous type dictionaries -- C# does not implicitly convert anonymous types to dynamic in generic arguments
- **Fix:** Replaced static helper methods with inline local functions that capture the anonymous type dictionaries directly via closure
- **Files modified:** src/GlobCRM.Api/Controllers/DuplicatesController.cs
- **Verification:** Build succeeded with 0 errors
- **Committed in:** 7a0963d (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Auto-fix necessary for compilation. No scope creep.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All 13 API endpoints operational (10 in DuplicatesController + 3 in DuplicateSettingsController)
- Contact and Company GetById handle merged records with redirect info
- Frontend (Plan 03) can implement: scan page, comparison/merge UI, create form warnings
- Admin settings (Plan 04) can implement: matching config management via DuplicateSettingsController

## Self-Check: PASSED

All 2 created files verified on disk. Both task commits (7a0963d, ecb4cf5) verified in git log. Modified files (ContactsController.cs, CompaniesController.cs) verified with merged-record redirect logic.

---
*Phase: 16-duplicate-detection-merge*
*Completed: 2026-02-19*

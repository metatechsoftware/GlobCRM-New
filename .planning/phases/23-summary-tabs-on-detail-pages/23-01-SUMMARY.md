---
phase: 23-summary-tabs-on-detail-pages
plan: 01
subsystem: api
tags: [dotnet, ef-core, task-whenall, summary-endpoints, batched-queries]

# Dependency graph
requires:
  - phase: 22-shared-foundation-entity-preview-sidebar
    provides: EntityPreviewController batched query pattern, ActivityLinks/Notes/Attachments DbSets
provides:
  - GET {id}/summary endpoints on all 6 entity controllers (Companies, Contacts, Deals, Leads, Quotes, Requests)
  - CompanySummaryDto, ContactSummaryDto, DealSummaryDto, LeadSummaryDto, QuoteSummaryDto, RequestSummaryDto
  - DealPipelineSummaryDto for Company and Contact summaries
  - EmailEngagementDto for Contact summaries
  - DealStageInfoDto and LeadStageInfoDto for pipeline progress bars
affects: [23-02, 23-03, 23-04, frontend-summary-tabs]

# Tech tracking
tech-stack:
  added: []
  patterns: [Task.WhenAll batched parallel queries for summary aggregation, co-located summary DTOs per controller file, entity-prefixed DTO naming to avoid namespace collisions]

key-files:
  created: []
  modified:
    - src/GlobCRM.Api/Controllers/CompaniesController.cs
    - src/GlobCRM.Api/Controllers/ContactsController.cs
    - src/GlobCRM.Api/Controllers/DealsController.cs
    - src/GlobCRM.Api/Controllers/LeadsController.cs
    - src/GlobCRM.Api/Controllers/QuotesController.cs
    - src/GlobCRM.Api/Controllers/RequestsController.cs

key-decisions:
  - "Entity-prefixed DTO names (CompanySummaryActivityDto, ContactSummaryActivityDto, etc.) to avoid namespace collisions since DTOs are co-located per controller file"
  - "Win rate computed client-side from materialized deal data rather than a separate SQL query"
  - "Lead email lookup simplified since leads don't have LinkedContactId mapping"
  - "Request summary uses dual-ownership RBAC scope check (OwnerId + AssignedToId) matching existing RequestsController pattern"

patterns-established:
  - "Summary endpoint pattern: fetch entity, RBAC check, parallel Task.WhenAll for all sub-queries, assemble DTO"
  - "Last contacted calculation: MAX of most recent completed activity and most recent email"
  - "Association counts return List of typed DTOs with entityType, label, icon, count"

requirements-completed: [SUMMARY-02, SUMMARY-03, SUMMARY-04, SUMMARY-05, SUMMARY-08, SUMMARY-09, SUMMARY-10, SUMMARY-11, SUMMARY-12]

# Metrics
duration: 7min
completed: 2026-02-20
---

# Phase 23 Plan 01: Backend Summary Endpoints Summary

**6 batched GET {id}/summary endpoints using Task.WhenAll for parallel aggregation of activities, notes, associations, attachments, pipeline data, and email engagement**

## Performance

- **Duration:** 7 min
- **Started:** 2026-02-20T08:31:48Z
- **Completed:** 2026-02-20T08:38:45Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- All 6 entity controllers (Companies, Contacts, Deals, Leads, Quotes, Requests) now have GET {id}/summary endpoints
- All endpoints use Task.WhenAll for parallel batched queries, avoiding N+1 sequential calls
- Company and Contact summaries include deal pipeline data with win rate calculation
- Contact summary includes email engagement stats (sent/received counts, last activity, sequence enrollment)
- Deal and Lead summaries include stage progress info for frontend pipeline stepper visualization
- All endpoints enforce RBAC scope checks matching existing GetById patterns per controller

## Task Commits

Each task was committed atomically:

1. **Task 1: Summary endpoints for Company, Contact, and Deal controllers** - `8d7fe79` (feat)
2. **Task 2: Summary endpoints for Lead, Quote, and Request controllers** - `40eacbd` (feat)

## Files Created/Modified
- `src/GlobCRM.Api/Controllers/CompaniesController.cs` - Added GetSummary endpoint with CompanySummaryDto, DealPipelineSummaryDto, and supporting DTOs
- `src/GlobCRM.Api/Controllers/ContactsController.cs` - Added GetSummary endpoint with ContactSummaryDto, EmailEngagementDto, DealPipelineSummaryDto
- `src/GlobCRM.Api/Controllers/DealsController.cs` - Added GetSummary endpoint with DealSummaryDto and DealStageInfoDto for pipeline stepper
- `src/GlobCRM.Api/Controllers/LeadsController.cs` - Added GetSummary endpoint with LeadSummaryDto and LeadStageInfoDto for stage progress
- `src/GlobCRM.Api/Controllers/QuotesController.cs` - Added GetSummary endpoint with QuoteSummaryDto (simpler: no pipeline/email)
- `src/GlobCRM.Api/Controllers/RequestsController.cs` - Added GetSummary endpoint with RequestSummaryDto (dual-ownership RBAC)

## Decisions Made
- Used entity-prefixed DTO names (CompanySummaryActivityDto vs ContactSummaryActivityDto) since DTOs are co-located per controller file and cannot share names across files in the same namespace
- Win rate computed by materializing deal data to memory then computing ratio, avoiding complex SQL division-by-zero handling
- Lead last-email lookup simplified since leads don't have a LinkedContactId mapping in EmailMessages
- Request summary follows dual-ownership RBAC pattern checking both OwnerId and AssignedToId

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All 6 summary API endpoints ready for frontend consumption in plans 23-02 through 23-04
- DTOs are fully typed with all fields the frontend summary tab components will need
- Stage info DTOs ready for pipeline stepper and lead progress bar components

## Self-Check: PASSED

All 6 modified controller files verified present. Both task commits (8d7fe79, 40eacbd) verified in git log. SUMMARY.md created successfully.

---
*Phase: 23-summary-tabs-on-detail-pages*
*Completed: 2026-02-20*

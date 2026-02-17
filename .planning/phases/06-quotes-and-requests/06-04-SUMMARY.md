---
phase: 06-quotes-and-requests
plan: 04
subsystem: ui
tags: [angular, ngrx-signals, typescript, quotes, requests, data-layer]

# Dependency graph
requires:
  - phase: 02-core-infrastructure
    provides: "ApiService, ViewFilter/FilterParam models, NgRx signal store pattern"
  - phase: 03-core-crm-entities
    provides: "PagedResult, EntityQueryParams, TimelineEntry shared query models"
provides:
  - "QuoteListDto, QuoteDetailDto, QuoteLineItemDto TypeScript interfaces"
  - "QuoteService with 9 API methods including blob PDF download"
  - "QuoteStore component-provided signal store"
  - "RequestListDto, RequestDetailDto TypeScript interfaces"
  - "RequestService with 8 API methods"
  - "RequestStore component-provided signal store"
  - "calculateLineTotals and calculateQuoteTotals helpers"
  - "QUOTE_STATUSES, QUOTE_TRANSITIONS, REQUEST_STATUSES, REQUEST_PRIORITIES, REQUEST_CATEGORIES, ALLOWED_TRANSITIONS constants"
affects: [06-05, 06-06, 06-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Blob PDF download via HttpClient directly (matching ActivityService attachment pattern)"
    - "Quote calculation helpers for frontend live preview"

key-files:
  created:
    - "globcrm-web/src/app/features/quotes/quote.models.ts"
    - "globcrm-web/src/app/features/quotes/quote.service.ts"
    - "globcrm-web/src/app/features/quotes/quote.store.ts"
    - "globcrm-web/src/app/features/requests/request.models.ts"
    - "globcrm-web/src/app/features/requests/request.service.ts"
    - "globcrm-web/src/app/features/requests/request.store.ts"
  modified: []

key-decisions:
  - "QuoteService uses HttpClient directly for PDF blob download (matching ActivityService attachment pattern)"
  - "Both stores are component-provided with createdAt desc default sort"

patterns-established:
  - "Quote line item calculation: lineTotal = qty * unitPrice, discount on lineTotal, tax on post-discount amount"
  - "Request entity follows simplified Activity pattern with fixed status workflow"

# Metrics
duration: 3min
completed: 2026-02-17
---

# Phase 6 Plan 4: Quote & Request Frontend Data Layer Summary

**TypeScript models, API services, and NgRx signal stores for Quotes (9 endpoints with PDF blob download and line item calculation helpers) and Requests (8 endpoints with status workflow constants)**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-17T13:27:27Z
- **Completed:** 2026-02-17T13:30:01Z
- **Tasks:** 2
- **Files created:** 6

## Accomplishments
- Complete Quote data layer with DTOs matching backend, line item calculation helpers for live preview, 9-method API service including blob PDF download and versioning, and component-provided signal store
- Complete Request data layer with DTOs, status/priority/category constants, workflow transitions, 8-method API service, and component-provided signal store
- Both stores follow established DealStore/ActivityStore patterns with ViewFilter-based filtering, pagination, sorting, and search

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Quote TypeScript models, API service, and signal store** - `ea91c2a` (feat)
2. **Task 2: Create Request TypeScript models, API service, and signal store** - `0d51bc3` (feat)

## Files Created/Modified
- `globcrm-web/src/app/features/quotes/quote.models.ts` - Quote DTOs, line item models, status constants, QUOTE_TRANSITIONS workflow, calculateLineTotals/calculateQuoteTotals helpers
- `globcrm-web/src/app/features/quotes/quote.service.ts` - QuoteService with 9 methods: CRUD, updateStatus, generatePdf (blob), createNewVersion, getTimeline
- `globcrm-web/src/app/features/quotes/quote.store.ts` - QuoteStore component-provided signal store with pagination, sorting, filtering, detail loading
- `globcrm-web/src/app/features/requests/request.models.ts` - Request DTOs, REQUEST_STATUSES, REQUEST_PRIORITIES, REQUEST_CATEGORIES, ALLOWED_TRANSITIONS workflow
- `globcrm-web/src/app/features/requests/request.service.ts` - RequestService with 8 methods: CRUD, updateStatus, getAllowedTransitions, getTimeline
- `globcrm-web/src/app/features/requests/request.store.ts` - RequestStore component-provided signal store with pagination, sorting, filtering, detail loading

## Decisions Made
- QuoteService uses HttpClient directly for PDF blob download (responseType: 'blob'), matching the ActivityService attachment download pattern rather than going through ApiService
- Both stores are component-provided (not root) with createdAt desc default sort, following ActivityStore pattern over DealStore pattern
- Quote calculation helpers use Math.round to 2 decimal places to avoid floating-point precision issues in financial calculations

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Quote and Request data layers ready for consumption by UI components in plans 06-05, 06-06, and 06-07
- All TypeScript interfaces match the backend DTOs specified in 06-RESEARCH.md
- Services cover all controller endpoints with correct HTTP methods and return types

## Self-Check: PASSED

- All 6 feature files: FOUND
- SUMMARY.md: FOUND
- Commit ea91c2a (Task 1): FOUND
- Commit 0d51bc3 (Task 2): FOUND

---
*Phase: 06-quotes-and-requests*
*Completed: 2026-02-17*

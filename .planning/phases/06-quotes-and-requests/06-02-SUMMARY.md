---
phase: 06-quotes-and-requests
plan: 02
subsystem: database
tags: [efcore, repository, linq, pagination, filtering, seed-data]

# Dependency graph
requires:
  - phase: 06-01
    provides: Quote, QuoteLineItem, QuoteStatusHistory, Request entities, IQuoteRepository, IRequestRepository interfaces
provides:
  - QuoteRepository with paged queries, line item loading, versioning queries
  - RequestRepository with paged queries and dual-ownership scope
  - DI registration for both repositories
  - Seed data for 3 quotes (7 line items) and 3 requests
affects: [06-03, 06-05, 06-06, 06-07]

# Tech tracking
tech-stack:
  added: []
  patterns: [quote-line-item-eager-loading, request-dual-ownership-scope, computed-line-item-totals-in-seed]

key-files:
  created:
    - src/GlobCRM.Infrastructure/Persistence/Repositories/QuoteRepository.cs
    - src/GlobCRM.Infrastructure/Persistence/Repositories/RequestRepository.cs
  modified:
    - src/GlobCRM.Infrastructure/CrmEntities/CrmEntityServiceExtensions.cs
    - src/GlobCRM.Infrastructure/MultiTenancy/TenantSeeder.cs

key-decisions:
  - "DI registration in CrmEntityServiceExtensions (existing pattern) not DependencyInjection.cs (plan said)"
  - "RequestRepository uses dual-ownership scope (OwnerId + AssignedToId) matching Activity pattern"

patterns-established:
  - "QuoteRepository includes StatusHistories in GetByIdWithLineItemsAsync for detail page"
  - "Seed data uses static local function for line item total computation"

# Metrics
duration: 5min
completed: 2026-02-17
---

# Phase 6 Plan 2: Quote & Request Repositories + Seed Data Summary

**QuoteRepository and RequestRepository with full paged query support, line item eager loading, versioning, dual-ownership scope, plus 3 sample quotes (7 line items with computed totals) and 3 sample requests in TenantSeeder**

## Performance

- **Duration:** 5 min
- **Tasks:** 2
- **Files created:** 2
- **Files modified:** 2

## Accomplishments
- QuoteRepository: paged queries with 6+ filter fields, 6 sort fields, line item eager loading with Product navigation, versioning queries
- RequestRepository: paged queries with 7+ filter fields, 5 sort fields, dual-ownership scope (OwnerId + AssignedToId matching Activity pattern)
- TenantSeeder extended with 3 quotes across Draft/Sent/Accepted statuses, 7 line items with correctly computed totals, QuoteStatusHistory entries
- TenantSeeder extended with 3 requests across New/InProgress/Resolved statuses with different priorities and categories

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement QuoteRepository and RequestRepository** - `21c6bca` (feat)
2. **Task 2: Add quote and request seed data to TenantSeeder** - `330f37f` (feat)

## Files Created/Modified
- `src/GlobCRM.Infrastructure/Persistence/Repositories/QuoteRepository.cs` - Quote CRUD with paged queries, filtering, sorting, line item eager loading, versioning
- `src/GlobCRM.Infrastructure/Persistence/Repositories/RequestRepository.cs` - Request CRUD with paged queries, filtering, sorting, dual-ownership scope
- `src/GlobCRM.Infrastructure/CrmEntities/CrmEntityServiceExtensions.cs` - Added IQuoteRepository and IRequestRepository DI registrations
- `src/GlobCRM.Infrastructure/MultiTenancy/TenantSeeder.cs` - Added productMap, 3 quotes with 7 line items, QuoteStatusHistory entries, 3 requests

## Decisions Made
- DI registration placed in CrmEntityServiceExtensions.cs (existing subsystem pattern) instead of DependencyInjection.cs (plan specification). This follows the established convention for all CRM entity repositories.
- RequestRepository uses dual-ownership scope checking both OwnerId and AssignedToId, matching the Activity entity pattern for assigned entities.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] DI registration in CrmEntityServiceExtensions instead of DependencyInjection.cs**
- **Found during:** Task 1 (DI Registration)
- **Issue:** Plan specified DependencyInjection.cs, but all existing CRM entity repositories are registered in CrmEntityServiceExtensions.cs
- **Fix:** Registered in CrmEntityServiceExtensions.cs following the established pattern
- **Files modified:** src/GlobCRM.Infrastructure/CrmEntities/CrmEntityServiceExtensions.cs
- **Verification:** dotnet build succeeds, pattern matches existing IDealRepository/IActivityRepository registrations
- **Committed in:** 21c6bca (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** DI registration location change follows existing codebase convention. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Quote and Request repositories ready for API controller layer (06-03)
- Seed data will create realistic demo data for new organizations
- Line item totals computed correctly using the established formula: LineTotal = Qty*UnitPrice, DiscountAmount = LineTotal*DiscountPercent/100, TaxAmount = (LineTotal-DiscountAmount)*TaxPercent/100, NetTotal = LineTotal - DiscountAmount + TaxAmount

---
*Phase: 06-quotes-and-requests*
*Completed: 2026-02-17*

---
phase: 06-quotes-and-requests
plan: 01
subsystem: database
tags: [ef-core, postgresql, domain-entities, rls, migration, quotes, requests, workflow]

# Dependency graph
requires:
  - phase: 03-core-crm-entities
    provides: Company, Contact, Product entities with tenant isolation pattern
  - phase: 04-deals-and-pipelines
    provides: Deal entity, DealProduct child pattern, DealStageHistory audit pattern
  - phase: 05-activities-and-workflow
    provides: ActivityWorkflow static class pattern, ActivityStatusHistory enum-based audit pattern
provides:
  - Quote entity with line items, versioning, status tracking, entity links, custom fields
  - QuoteLineItem child entity with product, quantity, pricing, discount, tax computations
  - QuoteStatusHistory audit trail for quote status transitions
  - Request entity with workflow status, priority, category, dual ownership
  - RequestWorkflow static class for status transition validation
  - IQuoteRepository and IRequestRepository interfaces
  - AddQuotesAndRequests EF Core migration creating 4 database tables
  - RLS policies for quotes and requests tables
affects: [06-02, 06-03, 06-04, 06-05, 06-06, 06-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Quote versioning via self-referencing FK (OriginalQuoteId) with SetNull delete"
    - "QuoteLineItem child entity pattern: no TenantId, cascade delete via Quote FK"
    - "Stored computed amounts on QuoteLineItem (LineTotal, DiscountAmount, TaxAmount, NetTotal)"
    - "RequestWorkflow follows ActivityWorkflow static dictionary pattern"

key-files:
  created:
    - src/GlobCRM.Domain/Entities/Quote.cs
    - src/GlobCRM.Domain/Entities/QuoteLineItem.cs
    - src/GlobCRM.Domain/Entities/QuoteStatusHistory.cs
    - src/GlobCRM.Domain/Entities/Request.cs
    - src/GlobCRM.Domain/Entities/RequestWorkflow.cs
    - src/GlobCRM.Domain/Enums/QuoteStatus.cs
    - src/GlobCRM.Domain/Enums/RequestStatus.cs
    - src/GlobCRM.Domain/Enums/RequestPriority.cs
    - src/GlobCRM.Domain/Interfaces/IQuoteRepository.cs
    - src/GlobCRM.Domain/Interfaces/IRequestRepository.cs
    - src/GlobCRM.Infrastructure/Persistence/Configurations/QuoteConfiguration.cs
    - src/GlobCRM.Infrastructure/Persistence/Configurations/QuoteLineItemConfiguration.cs
    - src/GlobCRM.Infrastructure/Persistence/Configurations/QuoteStatusHistoryConfiguration.cs
    - src/GlobCRM.Infrastructure/Persistence/Configurations/RequestConfiguration.cs
    - src/GlobCRM.Infrastructure/Persistence/Migrations/App/20260217133100_AddQuotesAndRequests.cs
  modified:
    - src/GlobCRM.Domain/Entities/Company.cs
    - src/GlobCRM.Domain/Entities/Contact.cs
    - src/GlobCRM.Infrastructure/Persistence/ApplicationDbContext.cs
    - scripts/rls-setup.sql

key-decisions:
  - "Quote versioning uses self-referencing FK (OriginalQuoteId) with SetNull delete -- versions survive original deletion"
  - "QuoteLineItem stores computed amounts (LineTotal, DiscountAmount, TaxAmount, NetTotal) rather than computing on read"
  - "RequestWorkflow uses same static dictionary pattern as ActivityWorkflow for zero-dependency transition validation"
  - "Quote has 4 entity link FKs (Deal, Contact, Company, Owner) all with SetNull delete behavior"

patterns-established:
  - "Quote versioning: OriginalQuoteId + VersionNumber for version chain tracking"
  - "QuoteLineItem precision: (18,4) for quantities/prices, (5,2) for percentages, (18,2) for totals"
  - "Request dual ownership: OwnerId (created by) + AssignedToId (working on) matching Activity pattern"

# Metrics
duration: 4min
completed: 2026-02-17
---

# Phase 6 Plan 1: Domain Entities & Migration Summary

**Quote and Request domain entities with line items, versioning, workflow validation, EF Core configurations, migration, and RLS policies**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-17T13:27:26Z
- **Completed:** 2026-02-17T13:31:39Z
- **Tasks:** 2
- **Files modified:** 21

## Accomplishments
- Complete domain model for quotes (with line items, versioning, status history) and requests (with workflow, priority, category)
- 4 EF Core configurations with snake_case naming, proper decimal precision, GIN indexes on JSONB columns
- AddQuotesAndRequests migration creating quotes, quote_line_items, quote_status_history, and requests tables
- RLS policies enforcing tenant isolation on quotes and requests tables
- Company and Contact entities updated with Quotes and Requests navigation collections

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Quote and Request domain entities, enums, workflow, and repository interfaces** - `c119223` (feat)
2. **Task 2: Create EF Core configurations, update DbContext, add RLS policies, and generate migration** - `ec46030` (feat)

## Files Created/Modified
- `src/GlobCRM.Domain/Enums/QuoteStatus.cs` - Quote lifecycle states (Draft/Sent/Accepted/Rejected/Expired)
- `src/GlobCRM.Domain/Enums/RequestStatus.cs` - Request workflow states (New/InProgress/Resolved/Closed)
- `src/GlobCRM.Domain/Enums/RequestPriority.cs` - Request priority levels (Low/Medium/High/Urgent)
- `src/GlobCRM.Domain/Entities/Quote.cs` - Quote entity with line items, versioning, 4 FK links, custom fields
- `src/GlobCRM.Domain/Entities/QuoteLineItem.cs` - Line item with product, quantity, pricing, computed amounts
- `src/GlobCRM.Domain/Entities/QuoteStatusHistory.cs` - Status transition audit trail
- `src/GlobCRM.Domain/Entities/Request.cs` - Request entity with workflow, priority, category, dual ownership
- `src/GlobCRM.Domain/Entities/RequestWorkflow.cs` - Static transition validation (4 status transitions)
- `src/GlobCRM.Domain/Interfaces/IQuoteRepository.cs` - CRUD + GetByIdWithLineItemsAsync + GetVersionsAsync
- `src/GlobCRM.Domain/Interfaces/IRequestRepository.cs` - CRUD with paged queries and ownership scope
- `src/GlobCRM.Infrastructure/Persistence/Configurations/QuoteConfiguration.cs` - snake_case table mapping with GIN index
- `src/GlobCRM.Infrastructure/Persistence/Configurations/QuoteLineItemConfiguration.cs` - Decimal precision (18,4)/(5,2)/(18,2)
- `src/GlobCRM.Infrastructure/Persistence/Configurations/QuoteStatusHistoryConfiguration.cs` - String-converted status enums
- `src/GlobCRM.Infrastructure/Persistence/Configurations/RequestConfiguration.cs` - Dual ownership FKs with GIN index
- `src/GlobCRM.Infrastructure/Persistence/Migrations/App/20260217133100_AddQuotesAndRequests.cs` - Migration creating 4 tables
- `src/GlobCRM.Domain/Entities/Company.cs` - Added Quotes and Requests navigation collections
- `src/GlobCRM.Domain/Entities/Contact.cs` - Added Quotes and Requests navigation collections
- `src/GlobCRM.Infrastructure/Persistence/ApplicationDbContext.cs` - 4 new DbSets and 2 new query filters
- `scripts/rls-setup.sql` - RLS policies for quotes and requests tables

## Decisions Made
- Quote versioning uses self-referencing FK (OriginalQuoteId) with SetNull delete -- versions survive original deletion
- QuoteLineItem stores computed amounts (LineTotal, DiscountAmount, TaxAmount, NetTotal) rather than computing on read, matching DealProduct pattern of pre-computed values
- RequestWorkflow uses same static dictionary pattern as ActivityWorkflow for zero-dependency transition validation
- Quote has 4 entity link FKs (Deal, Contact, Company, Owner) all with SetNull delete behavior for data preservation
- QuoteLineItem Description is required (not nullable) to support ad-hoc line items without ProductId

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Domain entities and migration ready for Plan 06-02 (Repositories & API endpoints)
- IQuoteRepository and IRequestRepository interfaces ready for implementation
- RequestWorkflow ready for use in request status change endpoints
- Company and Contact navigation collections ready for entity-scoped query loading

## Self-Check: PASSED

- All 15 created files verified on disk
- Commit c119223 (Task 1) verified in git log
- Commit ec46030 (Task 2) verified in git log
- dotnet build succeeds with 0 errors

---
*Phase: 06-quotes-and-requests*
*Completed: 2026-02-17*

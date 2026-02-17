---
phase: 06-quotes-and-requests
plan: 03
subsystem: api
tags: [dotnet, controllers, questpdf, crud, workflow, pdf-generation]

# Dependency graph
requires:
  - phase: 06-01
    provides: "Domain entities, enums, EF Core configs, migration"
  - phase: 06-02
    provides: "QuoteRepository, RequestRepository, seed data"
provides:
  - "QuotesController with 9 REST endpoints (CRUD + PDF + versioning + status + timeline)"
  - "RequestsController with 8 REST endpoints (CRUD + status workflow + allowed-transitions + timeline)"
  - "QuestPDF infrastructure (QuotePdfDocument, PdfServiceExtensions)"
affects: [phase-06-04, phase-06-05, phase-06-06, phase-06-07]

# Tech tracking
tech-stack:
  added:
    - "QuestPDF 2026.2.0 (Community license, PDF generation)"
  patterns:
    - "QuoteWorkflow static class for status transition validation (same pattern as RequestWorkflow, ActivityWorkflow)"
    - "QuoteCalculator static helper for server-side line item and quote total calculation"
    - "QuotePdfDocument IDocument implementation for on-demand PDF generation"

key-files:
  created:
    - "src/GlobCRM.Api/Controllers/QuotesController.cs"
    - "src/GlobCRM.Api/Controllers/RequestsController.cs"
    - "src/GlobCRM.Infrastructure/Pdf/QuotePdfDocument.cs"
    - "src/GlobCRM.Infrastructure/Pdf/PdfServiceExtensions.cs"
  modified:
    - "src/GlobCRM.Infrastructure/GlobCRM.Infrastructure.csproj"
    - "src/GlobCRM.Api/Program.cs"

key-decisions:
  - "QuoteWorkflow defined inline in QuotesController file (not separate Domain class) since it's quote-specific"
  - "QuoteCalculator uses Math.Round(value, 2) for all monetary calculations"
  - "PDF generation uses ITenantProvider.GetCurrentOrganizationAsync() for org name (not DbContext query)"
  - "Request dual-ownership scope checks both OwnerId and AssignedToId (matching Activity pattern)"
  - "Request timeline infers status changes from ResolvedAt/ClosedAt timestamps (no separate status history table)"

patterns-established:
  - "QuestPDF IDocument pattern for PDF generation with model records"

# Metrics
duration: 5min
completed: 2026-02-17
---

# Phase 06 Plan 03: API Controllers + QuestPDF PDF Generation Summary

**QuotesController (9 endpoints) and RequestsController (8 endpoints) with QuestPDF infrastructure for quote PDF generation**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-17
- **Completed:** 2026-02-17
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Built QuotesController with 9 endpoints: list, detail, create (with server-side total calculation), update (batch line item replacement), delete, status transition (with QuoteStatusHistory audit), PDF generation (QuestPDF A4 document), new version (deep clone), timeline
- Built RequestsController with 8 endpoints: list, detail, create, update, delete, status transition (with ResolvedAt/ClosedAt tracking), allowed-transitions, timeline
- Installed QuestPDF 2026.2.0 with Community license configuration
- Created QuotePdfDocument with A4 layout, header (org info, quote number, contact/company), line items table, totals section, notes, and page footer
- QuoteCalculator provides server-side Math.Round calculations for LineTotal, DiscountAmount, TaxAmount, NetTotal
- Both controllers use Permission:Entity:Operation policy authorization with ownership scope enforcement
- FluentValidation on create requests (title 3-500 chars, line items required, quantity > 0)

## Task Commits

Each task was committed atomically:

1. **Task 1: QuotesController + QuestPDF infrastructure** - `5361735` (feat)
2. **Task 2: RequestsController with CRUD and status workflow** - `6fe3921` (feat)

## Files Created/Modified
- `src/GlobCRM.Api/Controllers/QuotesController.cs` - 9 endpoints, QuoteWorkflow, QuoteCalculator, DTOs, FluentValidation
- `src/GlobCRM.Api/Controllers/RequestsController.cs` - 8 endpoints, dual-ownership scope, DTOs, FluentValidation
- `src/GlobCRM.Infrastructure/Pdf/QuotePdfDocument.cs` - IDocument with A4 layout, line items table, totals
- `src/GlobCRM.Infrastructure/Pdf/PdfServiceExtensions.cs` - QuestPDF community license configuration
- `src/GlobCRM.Infrastructure/GlobCRM.Infrastructure.csproj` - QuestPDF 2026.2.0 package reference
- `src/GlobCRM.Api/Program.cs` - AddPdfServices() registration

## Decisions Made
- QuoteWorkflow transitions: Draft->[Sent], Sent->[Accepted,Rejected,Expired,Draft], Accepted->[] (terminal), Rejected->[Draft], Expired->[Draft]
- Request dual-ownership scope checks OwnerId OR AssignedToId for all mutating endpoints
- Request timeline uses ResolvedAt/ClosedAt timestamps rather than a separate status history table
- PDF uses ITenantProvider.GetCurrentOrganizationAsync() for organization name

## Deviations from Plan

1. Used ITenantProvider.GetCurrentOrganizationAsync() instead of direct DbContext query for organization name (Organizations DbSet is on TenantDbContext, not ApplicationDbContext)

## Issues Encountered

None.

## User Setup Required

None - QuestPDF Community license is free and auto-configured.

---
*Phase: 06-quotes-and-requests*
*Completed: 2026-02-17*

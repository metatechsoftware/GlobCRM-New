---
phase: 06-quotes-and-requests
verified: 2026-02-17T14:04:25Z
status: gaps_found
score: 5/6 must-haves verified
gaps:
  - truth: "User can generate PDF from quote and create new versions from existing quotes (status transitions work correctly)"
    status: partial
    reason: "Frontend QUOTE_TRANSITIONS constant shows 'Draft' as allowed from 'Accepted' status, but backend QuoteWorkflow defines Accepted as terminal (no transitions). Clicking the resulting UI button will produce a 400 error from the API."
    artifacts:
      - path: "globcrm-web/src/app/features/quotes/quote.models.ts"
        issue: "QUOTE_TRANSITIONS maps Accepted: ['Draft'] but backend allows Accepted -> [] (terminal)"
      - path: "globcrm-web/src/app/features/quotes/quote-detail/quote-detail.component.ts"
        issue: "allowedTransitions computed from client-side QUOTE_TRANSITIONS constant (line 591) rather than server-driven allowed transitions in DTO"
    missing:
      - "Fix QUOTE_TRANSITIONS in quote.models.ts: change Accepted: ['Draft'] to Accepted: [] to match backend QuoteWorkflow"
      - "OR: update QuoteDetailComponent to fetch allowed transitions from the backend (like RequestDetailComponent does with server-driven allowedTransitions from DTO) rather than using the client-side constant"
human_verification:
  - test: "Navigate to a quote, click 'Generate PDF' button"
    expected: "Browser downloads a PDF file named 'Quote-Q-0001-v1.pdf' containing organization name, quote header, line items table with amounts, and totals"
    why_human: "PDF content and rendering cannot be verified programmatically"
  - test: "Open quote form, add line item with quantity=2, unitPrice=100, discountPercent=10, taxPercent=20"
    expected: "Live totals show: Subtotal=200, Discount=-20, Tax=21.60, Grand Total=201.60"
    why_human: "Real-time calculation display requires browser interaction"
  - test: "Create a new request, then transition from New to InProgress, then to Resolved, then to Closed"
    expected: "Each transition succeeds, status updates in UI, no 400 errors"
    why_human: "Full status workflow requires running backend and browser interaction"
---

# Phase 6: Quotes and Requests Verification Report

**Phase Goal:** Line-item quote builder with PDF generation and support request tracking
**Verified:** 2026-02-17T14:04:25Z
**Status:** gaps_found (1 gap — client/server workflow mismatch on Accepted status)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can create quotes with line items (product, quantity, unit price, discount, tax) | VERIFIED | QuotesController POST /api/quotes with CreateQuoteRequest + FormArray line items in QuoteFormComponent; FluentValidation enforces quantity > 0 and discount/tax 0-100 |
| 2 | Quote calculates subtotal, discount total, tax total, and grand total automatically | VERIFIED | Server-side QuoteCalculator.CalculateLineItem/CalculateQuoteTotals called on create/update; frontend calculateLineTotals/calculateQuoteTotals used for live preview |
| 3 | User can generate PDF from quote and create new versions from existing quotes | PARTIAL | PDF generation wired (QuestPDF QuotePdfDocument, GET /api/quotes/{id}/pdf, blob download via URL.createObjectURL); versioning endpoint POST /api/quotes/{id}/new-version is wired. BUT: quote status transitions have client/server mismatch (Accepted shown as non-terminal in UI, terminal in backend) |
| 4 | User can link quotes to deals and contacts | VERIFIED | Quote entity has DealId, ContactId, CompanyId FKs; QuoteFormComponent has autocomplete for all three; company-detail, contact-detail, and deal-detail all lazy-load quote tabs with companyId/contactId/dealId filters |
| 5 | User can create requests with status workflow (new to in progress to resolved to closed) | VERIFIED | RequestWorkflow defines New->InProgress->Resolved->Closed state machine; RequestsController PATCH /status enforces transitions, sets ResolvedAt/ClosedAt timestamps; RequestDetailComponent renders transition buttons from server-driven allowedTransitions |
| 6 | Requests have priority, category, and assigned owner with links to contacts and companies | VERIFIED | Request entity has Priority (enum), Category (free-text), OwnerId + AssignedToId (dual ownership); ContactId and CompanyId FKs; all fields in CreateRequestRequest and rendered in RequestFormComponent |

**Score:** 5/6 truths verified (1 partial — workflow mismatch is a UI correctness bug)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/GlobCRM.Domain/Entities/Quote.cs` | Quote entity with line items, versioning, 4 FK links | VERIFIED | Substantive: Subtotal, DiscountTotal, TaxTotal, GrandTotal fields; OriginalQuoteId self-referencing FK; DealId/ContactId/CompanyId/OwnerId FKs |
| `src/GlobCRM.Domain/Entities/QuoteLineItem.cs` | Line item with product, quantity, pricing, computed amounts | VERIFIED | Substantive: Quantity, UnitPrice, DiscountPercent, TaxPercent, LineTotal, DiscountAmount, TaxAmount, NetTotal |
| `src/GlobCRM.Domain/Entities/Request.cs` | Request with workflow, priority, category, dual ownership | VERIFIED | Substantive: Status, Priority, Category, OwnerId, AssignedToId, ResolvedAt, ClosedAt |
| `src/GlobCRM.Domain/Entities/RequestWorkflow.cs` | Static workflow transition validation | VERIFIED | Defines New->InProgress,Closed; InProgress->Resolved,New; Resolved->Closed,InProgress; Closed->InProgress |
| `src/GlobCRM.Infrastructure/Persistence/Migrations/App/20260217133100_AddQuotesAndRequests.cs` | EF Core migration creating 4 tables | VERIFIED | Creates quotes, requests, quote_line_items, quote_status_history tables with full column specs and FKs |
| `src/GlobCRM.Infrastructure/Pdf/QuotePdfDocument.cs` | QuestPDF IDocument with A4 layout | VERIFIED | Substantive: ComposeHeader (org name, quote number, contact/company), ComposeContent (line items table), ComposeFooter |
| `src/GlobCRM.Api/Controllers/QuotesController.cs` | 9 REST endpoints + QuoteCalculator + QuoteWorkflow | VERIFIED | GET list, GET detail, POST create, PUT update, DELETE, PATCH status, GET /pdf, POST /new-version, GET /timeline. QuoteCalculator and QuoteWorkflow defined inline |
| `src/GlobCRM.Api/Controllers/RequestsController.cs` | 8 REST endpoints + status workflow | VERIFIED | GET list, GET detail, POST create, PUT update, DELETE, PATCH status, GET /allowed-transitions, GET /timeline |
| `src/GlobCRM.Infrastructure/CrmEntities/CrmEntityServiceExtensions.cs` | DI registration for repositories | VERIFIED | `services.AddScoped<IQuoteRepository, QuoteRepository>()` and `services.AddScoped<IRequestRepository, RequestRepository>()` at lines 26-27 |
| `src/GlobCRM.Api/Program.cs` | AddPdfServices registration | VERIFIED | `builder.Services.AddPdfServices()` at line 54 |
| `globcrm-web/src/app/features/quotes/quote.models.ts` | TypeScript DTOs + calculation helpers + workflow constants | PARTIAL | calculateLineTotals/calculateQuoteTotals implemented correctly; QUOTE_TRANSITIONS has Accepted: ['Draft'] which contradicts backend (Accepted is terminal) |
| `globcrm-web/src/app/features/quotes/quote.service.ts` | QuoteService with 9 methods including PDF blob | VERIFIED | generatePdf uses HttpClient directly with responseType:'blob'; all 9 endpoints covered |
| `globcrm-web/src/app/features/quotes/quote-list/quote-list.component.ts` | Quote list with DynamicTable | VERIFIED | Exists and is substantive |
| `globcrm-web/src/app/features/quotes/quote-form/quote-form.component.ts` | Quote form with FormArray line items + live calculations | VERIFIED | FormArray with add/remove; lineItems.valueChanges -> lineItemValues signal -> quoteTotals computed signal using calculateQuoteTotals |
| `globcrm-web/src/app/features/quotes/quote-detail/quote-detail.component.ts` | Quote detail with PDF download, versioning, status transitions | PARTIAL | PDF download wired (generatePdf -> createObjectURL -> anchor.click); versioning wired; but allowedTransitions uses client-side QUOTE_TRANSITIONS which incorrectly shows Accepted->Draft |
| `globcrm-web/src/app/features/quotes/quotes.routes.ts` | Lazy-loaded QUOTE_ROUTES | VERIFIED | list, new, :id, :id/edit with loadComponent |
| `globcrm-web/src/app/features/requests/request.models.ts` | Request DTOs + workflow constants | VERIFIED | REQUEST_STATUSES, REQUEST_PRIORITIES, REQUEST_CATEGORIES, ALLOWED_TRANSITIONS all present |
| `globcrm-web/src/app/features/requests/request-list/request-list.component.ts` | Request list with DynamicTable | VERIFIED | Exists and is substantive |
| `globcrm-web/src/app/features/requests/request-form/request-form.component.ts` | Request form with priority/category/autocomplete | VERIFIED | Exists and is substantive |
| `globcrm-web/src/app/features/requests/request-detail/request-detail.component.ts` | Request detail with server-driven status transitions | VERIFIED | Uses allowedTransitions from server DTO (correct pattern) |
| `globcrm-web/src/app/features/requests/requests.routes.ts` | Lazy-loaded REQUEST_ROUTES | VERIFIED | list, new, :id, :id/edit with loadComponent |
| `globcrm-web/src/app/app.routes.ts` | App routes include quotes and requests | VERIFIED | /quotes and /requests routes with authGuard and QUOTE_ROUTES/REQUEST_ROUTES |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| QuotesController | IQuoteRepository | DI injection | WIRED | Constructor injection verified |
| QuotesController | QuotePdfDocument | `new QuotePdfDocument(pdfModel); document.GeneratePdf()` | WIRED | Line 432-433 in controller |
| QuotesController | QuoteCalculator | `QuoteCalculator.CalculateLineItem/CalculateQuoteTotals` | WIRED | Called on create (lines 189, 194) and update (lines 277, 282) |
| QuotePdfDocument | QuestPDF | `using QuestPDF.Fluent` | WIRED | QuestPDF 2026.2.0 installed, PdfServiceExtensions registers Community license |
| Program.cs | AddPdfServices | `builder.Services.AddPdfServices()` | WIRED | Line 54 |
| CrmEntityServiceExtensions | QuoteRepository | `AddScoped<IQuoteRepository, QuoteRepository>()` | WIRED | Lines 26-27 |
| ApplicationDbContext | Quote/Request DbSets | `DbSet<Quote> Quotes`, `DbSet<Request> Requests` | WIRED | Lines 89-92 |
| QuoteFormComponent | calculateQuoteTotals | `lineItems.valueChanges -> signal -> quoteTotals = computed(calculateQuoteTotals)` | WIRED | Lines 44-45, 633-634, 758-761 |
| QuoteDetailComponent | QuoteService.generatePdf | `quoteService.generatePdf(id).subscribe -> URL.createObjectURL` | WIRED | Lines 685, 688 |
| QuoteDetailComponent | QUOTE_TRANSITIONS | `allowedTransitions = computed(() => QUOTE_TRANSITIONS[q.status])` | PARTIAL - MISMATCH | Frontend Accepted->['Draft'] disagrees with backend Accepted->[] |
| RequestDetailComponent | server allowedTransitions | `allowedTransitions` from RequestDetailDto | WIRED | Uses server-driven value, correct pattern |
| company-detail | QuoteService.getList | `quoteService.getList({ filters: [{fieldId:'companyId'...}] })` | WIRED | Line 451 |
| contact-detail | QuoteService/RequestService | `getList` with contactId filter | WIRED | Lines 464, 483 |
| deal-detail | QuoteService.getList | `getList` with dealId filter | WIRED | Lines 227-237 |
| app.routes.ts | QUOTE_ROUTES | `loadChildren: import quotes.routes` | WIRED | Lines 91-97 |
| app.routes.ts | REQUEST_ROUTES | `loadChildren: import requests.routes` | WIRED | Lines 98-105 |
| navbar | /quotes and /requests links | `routerLink="/quotes"`, `routerLink="/requests"` | WIRED | Lines 42-48 |

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `globcrm-web/src/app/features/quotes/quote.models.ts:22` | `Accepted: ['Draft']` disagrees with backend `Accepted: []` | Warning | UI will show "Back to Draft" button on accepted quotes; clicking it will return a 400 error from API |
| `globcrm-web/src/app/features/quotes/quote-detail/quote-detail.component.ts:591` | Uses client-side `QUOTE_TRANSITIONS` for allowed transitions rather than server-driven value | Warning | Quote detail doesn't follow the server-driven pattern established by RequestDetailComponent |

### Human Verification Required

#### 1. PDF Download and Content

**Test:** Navigate to any quote detail page and click the "Generate PDF" button
**Expected:** Browser downloads a PDF file named "Quote-Q-0001-v1.pdf" containing the organization name, quote title, contact/company names, a line items table with quantity/price/discount/tax/total columns, and totals section (subtotal, discount, tax, grand total)
**Why human:** PDF binary content and QuestPDF rendering cannot be verified programmatically

#### 2. Live Line Item Calculation in Quote Form

**Test:** Open the create quote form, add a line item with quantity=2, unitPrice=100, discountPercent=10, taxPercent=20
**Expected:** The totals card shows: Subtotal=200.00, Discount=-20.00, Tax=21.60, Grand Total=201.60 — updating as values are typed
**Why human:** Real-time reactive form calculation display requires browser interaction

#### 3. Request Status Workflow End-to-End

**Test:** Create a new request, then use the status transition buttons to move it through: New -> InProgress -> Resolved -> Closed
**Expected:** Each transition succeeds, the status chip updates, the timeline shows the progression; Resolved shows a ResolvedAt timestamp
**Why human:** Full end-to-end workflow requires running backend and browser

#### 4. Quote Linking to Deal/Contact/Company

**Test:** Create a quote and link it to a deal, contact, and company via the autocomplete fields. Then navigate to that deal's detail page and check the Quotes tab.
**Expected:** The quote appears in the deal's Quotes tab, with correct quote number and grand total
**Why human:** Cross-entity navigation and filter-based loading requires running app

---

## Gaps Summary

### Gap 1: Quote Status Transition Frontend/Backend Mismatch (Warning)

The frontend `QUOTE_TRANSITIONS` constant in `quote.models.ts` defines:
```typescript
Accepted: ['Draft'],
```

But the backend `QuoteWorkflow` (in `QuotesController.cs`) defines:
```csharp
[QuoteStatus.Accepted] = [],  // terminal — no transitions allowed
```

The quote detail component uses `QUOTE_TRANSITIONS` client-side (line 591) to compute allowed transition buttons. For a quote in "Accepted" status, the UI will render a "Draft" transition button. Clicking it will call `PATCH /api/quotes/{id}/status` with `{ status: 'Draft' }`, and the backend will return HTTP 400: "Cannot transition from Accepted to Draft."

This is a correctness bug, not a capability gap — the core quote workflow (Draft->Sent->Accepted/Rejected/Expired) works correctly. The mismatch only affects recovery from "Accepted" state. The backend is correctly protected.

**Fix options:**
1. Simplest: Change `quote.models.ts` line 22 from `Accepted: ['Draft']` to `Accepted: []`
2. Better: Follow the `RequestDetailComponent` pattern — fetch allowed transitions from the server (already included in `QuoteDetailDto.AllowedTransitions` if the backend exposes it) rather than computing client-side

Note: The backend `QuoteDetailDto` does NOT currently include `AllowedTransitions` (unlike `RequestDetailDto`). Option 2 would require a small backend DTO change. Option 1 is simpler and sufficient.

---

_Verified: 2026-02-17T14:04:25Z_
_Verifier: Claude (gsd-verifier)_

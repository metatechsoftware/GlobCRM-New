---
phase: 06-quotes-and-requests
plan: 07
subsystem: ui
tags: [angular, routing, lazy-loading, tabs, navbar, request-detail, status-workflow]

# Dependency graph
requires:
  - phase: 06-05
    provides: "Quote list, form, and QuoteService"
  - phase: 06-06
    provides: "Quote detail, Request list, form, and RequestService"
provides:
  - "Request detail page with status workflow and entity links"
  - "Quote and Request lazy-loaded routes (list, new, detail, edit)"
  - "Navbar links for Quotes and Requests"
  - "Quotes and Requests tabs on Company, Contact, and Deal detail pages"
affects: [phase-07, phase-08, phase-11]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Entity detail tab lazy loading with signal guard pattern for Quotes/Requests"
    - "Lazy-loaded feature routes (QUOTE_ROUTES, REQUEST_ROUTES) following ACTIVITY_ROUTES pattern"

key-files:
  created:
    - "globcrm-web/src/app/features/requests/request-detail/request-detail.component.ts"
    - "globcrm-web/src/app/features/quotes/quotes.routes.ts"
    - "globcrm-web/src/app/features/requests/requests.routes.ts"
  modified:
    - "globcrm-web/src/app/app.routes.ts"
    - "globcrm-web/src/app/shared/components/navbar/navbar.component.html"
    - "globcrm-web/src/app/shared/components/related-entity-tabs/related-entity-tabs.component.ts"
    - "globcrm-web/src/app/features/companies/company-detail/company-detail.component.ts"
    - "globcrm-web/src/app/features/companies/company-detail/company-detail.component.html"
    - "globcrm-web/src/app/features/contacts/contact-detail/contact-detail.component.ts"
    - "globcrm-web/src/app/features/contacts/contact-detail/contact-detail.component.html"
    - "globcrm-web/src/app/features/deals/deal-detail/deal-detail.component.ts"
    - "globcrm-web/src/app/features/deals/deal-detail/deal-detail.component.html"

key-decisions:
  - "RequestDetailComponent uses allowedTransitions from detail DTO (server-driven) rather than client-side ALLOWED_TRANSITIONS"
  - "Entity tab Quotes/Requests use filter-based getList with companyId/contactId/dealId rather than dedicated API endpoints"
  - "Navbar order: Dashboard | Companies | Contacts | Products | Deals | Activities | Quotes | Requests | Team | Settings"

patterns-established:
  - "Quote/Request entity tab pattern: signal guard + filter-based getList for entity-scoped data loading"

# Metrics
duration: 5min
completed: 2026-02-17
---

# Phase 06 Plan 07: Request Detail, Routes, Navbar & Entity Tabs Summary

**Request detail page with status workflow, lazy-loaded Quote/Request routes, navbar links, and Quotes/Requests tabs on Company, Contact, and Deal detail pages**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-17
- **Completed:** 2026-02-17
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- Built RequestDetailComponent with status workflow transition buttons (Start Work, Resolve, Close, Reopen), entity links, info cards, and timeline tab
- Configured lazy-loaded routes for both Quotes (QUOTE_ROUTES) and Requests (REQUEST_ROUTES) with list, new, detail, edit paths
- Added Quotes and Requests links to navbar in correct position after Activities
- Enabled Quotes and Requests tabs on Company detail with companyId-filtered data
- Enabled Quotes and Requests tabs on Contact detail with contactId-filtered data
- Added Quotes tab on Deal detail with dealId-filtered quote list including version numbers

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Request detail page and configure all routes** - `8b4b7ba` (feat)
2. **Task 2: Add navbar links and enable Quotes/Requests tabs on entity detail pages** - `e7491de` (feat)

## Files Created/Modified
- `globcrm-web/src/app/features/requests/request-detail/request-detail.component.ts` - Request detail page with status workflow, info cards, timeline
- `globcrm-web/src/app/features/quotes/quotes.routes.ts` - Quote feature routes with lazy loading
- `globcrm-web/src/app/features/requests/requests.routes.ts` - Request feature routes with lazy loading
- `globcrm-web/src/app/app.routes.ts` - Added quotes and requests route entries with authGuard
- `globcrm-web/src/app/shared/components/navbar/navbar.component.html` - Added Quotes and Requests links
- `globcrm-web/src/app/shared/components/related-entity-tabs/related-entity-tabs.component.ts` - Enabled Quotes tab, added Requests tab in COMPANY_TABS, CONTACT_TABS; added Quotes tab in DEAL_TABS
- `globcrm-web/src/app/features/companies/company-detail/company-detail.component.ts` - Added QuoteService, RequestService with signal guard loading
- `globcrm-web/src/app/features/companies/company-detail/company-detail.component.html` - Added Quotes and Requests tab templates
- `globcrm-web/src/app/features/contacts/contact-detail/contact-detail.component.ts` - Added QuoteService, RequestService with signal guard loading
- `globcrm-web/src/app/features/contacts/contact-detail/contact-detail.component.html` - Added Quotes and Requests tab templates
- `globcrm-web/src/app/features/deals/deal-detail/deal-detail.component.ts` - Added QuoteService with signal guard loading
- `globcrm-web/src/app/features/deals/deal-detail/deal-detail.component.html` - Added Quotes tab template

## Decisions Made
- RequestDetailComponent uses `allowedTransitions` from the backend detail DTO response (server-driven workflow) rather than the client-side ALLOWED_TRANSITIONS constant, for consistency with backend state management
- Entity detail Quotes/Requests tabs use filter-based `getList` calls (with companyId/contactId/dealId filter) rather than dedicated entity-scoped API endpoints, since the service already supports filtering
- Navbar final order: Dashboard | Companies | Contacts | Products | Deals | Activities | Quotes | Requests | Team | Settings

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 06 is now complete (all 7 plans executed)
- All Quote and Request CRUD, detail, list, form, routes, and entity integration are in place
- Ready for Phase 07 (next milestone phase)

---
*Phase: 06-quotes-and-requests*
*Completed: 2026-02-17*

---
phase: 03-core-crm-entities
plan: 06
subsystem: ui
tags: [angular, material, dynamic-table, saved-views, filter-panel, custom-fields, entity-timeline, reactive-forms, crud]

# Dependency graph
requires:
  - phase: 03-core-crm-entities
    plan: 02
    provides: "CompanyDto, CompanyDetailDto, CompanyService, CompanyStore signal store"
  - phase: 03-core-crm-entities
    plan: 03
    provides: "CustomFieldFormComponent, EntityTimelineComponent, RelatedEntityTabsComponent, COMPANY_TABS"
  - phase: 03-core-crm-entities
    plan: 05
    provides: "CompaniesController REST API with CRUD, timeline, company-contacts endpoints"
  - phase: 02-core-infrastructure
    provides: "DynamicTableComponent, ViewStore, ViewSidebar, FilterPanel, FilterChips, HasPermissionDirective, PermissionStore"
provides:
  - "CompanyListComponent with DynamicTableComponent, saved views sidebar, filter panel/chips, and permission-guarded New button"
  - "CompanyDetailComponent with tabs (Details, Contacts active; Deals/Quotes/Activities/Notes disabled), timeline sidebar, and edit/delete actions"
  - "CompanyFormComponent for create and edit with reactive form validation and custom field integration"
  - "COMPANY_ROUTES: lazy-loaded routes for list, new, :id detail, :id/edit"
  - "getCompanyContacts method on CompanyService for company-contacts API endpoint"
affects: [03-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Entity list page pattern: component-provided ViewStore + EntityStore, DynamicTable + ViewSidebar + FilterPanel"
    - "Entity detail page pattern: tabs via RelatedEntityTabsComponent, timeline sidebar, confirm delete dialog"
    - "Entity form page pattern: reactive form with FormBuilder + CustomFieldFormComponent, create/edit mode via :id route param"
    - "Lazy contact loading: Contacts tab loads data on first tab switch, not on page load"

key-files:
  created:
    - "globcrm-web/src/app/features/companies/company-list/company-list.component.ts"
    - "globcrm-web/src/app/features/companies/company-list/company-list.component.html"
    - "globcrm-web/src/app/features/companies/company-detail/company-detail.component.ts"
    - "globcrm-web/src/app/features/companies/company-detail/company-detail.component.html"
    - "globcrm-web/src/app/features/companies/company-form/company-form.component.ts"
    - "globcrm-web/src/app/features/companies/companies.routes.ts"
  modified:
    - "globcrm-web/src/app/app.routes.ts"
    - "globcrm-web/src/app/features/companies/company.service.ts"

key-decisions:
  - "Reused ConfirmDeleteDialogComponent from role-list component for company delete confirmation"
  - "Lazy-load contacts on Contacts tab switch instead of on page init for better initial load performance"
  - "Custom field column sorting disabled (JSONB limitation) -- only core columns are sortable"
  - "Error feedback via MatSnackBar for form submit failures and success confirmations"
  - "FilterPanel uses activeFilters/filtersChanged inputs (matching existing component API, not plan's filters/filtersApplied)"

patterns-established:
  - "Entity list page: CompanyListComponent as template for Contact and Product list pages"
  - "Entity detail page: two-column layout (tabs 65% + timeline 35%), responsive mobile stacking"
  - "Entity form page: 2-column grid for core fields, CustomFieldFormComponent below, reactive form validation"
  - "Route structure: '' (list), 'new' (create), ':id' (detail), ':id/edit' (edit)"

# Metrics
duration: 8min
completed: 2026-02-16
---

# Phase 3 Plan 06: Company Frontend Pages Summary

**Complete Company feature UI with dynamic table list page, tabbed detail page with timeline sidebar, and reactive create/edit form with custom field integration**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-16T20:24:51Z
- **Completed:** 2026-02-16T20:32:23Z
- **Tasks:** 2
- **Files created/modified:** 8

## Accomplishments
- CompanyListComponent with DynamicTableComponent, ViewSidebar for saved views, FilterPanel/FilterChips for advanced filtering, and HasPermission-guarded "New Company" button
- CompanyDetailComponent with two-column layout: RelatedEntityTabsComponent (Details and Contacts tabs active, Deals/Quotes/Activities/Notes disabled with "coming soon") plus EntityTimelineComponent sidebar
- CompanyFormComponent supporting both create and edit modes with reactive form validation, 2-column grid layout, and CustomFieldFormComponent integration
- Lazy-loaded routes at /companies with list, new, :id, and :id/edit paths

## Task Commits

Each task was committed atomically:

1. **Task 1: Create CompanyListComponent with dynamic table integration** - `37dafc6` (feat)
2. **Task 2: Create CompanyDetailComponent and CompanyFormComponent** - `1deff06` (feat)

## Files Created/Modified
- `globcrm-web/src/app/features/companies/company-list/company-list.component.ts` - List page with DynamicTable, ViewSidebar, FilterPanel, core+custom column definitions, event handlers for sort/page/filter/view selection
- `globcrm-web/src/app/features/companies/company-list/company-list.component.html` - Template with entity-list-layout: sidebar + content area with header, filter chips, filter panel, and dynamic table
- `globcrm-web/src/app/features/companies/company-detail/company-detail.component.ts` - Detail page with company data loading, contacts lazy-loading, timeline, delete confirmation dialog
- `globcrm-web/src/app/features/companies/company-detail/company-detail.component.html` - Template with header (back/edit/delete), subheader (industry/phone/owner), tabs+timeline two-column layout
- `globcrm-web/src/app/features/companies/company-form/company-form.component.ts` - Create/edit form with reactive FormGroup, 12 core fields, custom field integration, MatSnackBar feedback
- `globcrm-web/src/app/features/companies/companies.routes.ts` - COMPANY_ROUTES with list, new, :id, :id/edit paths
- `globcrm-web/src/app/app.routes.ts` - Added /companies lazy-loaded route with authGuard
- `globcrm-web/src/app/features/companies/company.service.ts` - Added getCompanyContacts method for company-contacts API endpoint

## Decisions Made
- Reused existing ConfirmDeleteDialogComponent from role-list (DRY) for company delete confirmation instead of creating a new dialog
- Contacts tab lazy-loads on first tab switch (index === 1) rather than on page init, improving initial load performance
- Custom field columns are not sortable (JSONB sorting not supported per Plan 03-04 decision), only core columns sort
- Used MatSnackBar for create/update/delete success and error feedback (consistent with Material Design patterns)
- Adapted FilterPanel input names to match actual component API (activeFilters/filtersChanged not filters/filtersApplied)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added getCompanyContacts method to CompanyService**
- **Found during:** Task 2 (CompanyDetailComponent)
- **Issue:** CompanyService lacked a method for the GET /api/companies/{id}/contacts endpoint needed by the Contacts tab
- **Fix:** Added `getCompanyContacts(id: string): Observable<ContactDto[]>` method with ContactDto import
- **Files modified:** company.service.ts
- **Verification:** ng build compiles, method matches backend endpoint
- **Committed in:** 1deff06 (Task 2 commit)

**2. [Rule 3 - Blocking] Adapted FilterPanel input/output names to match actual component API**
- **Found during:** Task 1 (CompanyListComponent template)
- **Issue:** Plan template used `[filters]` and `(filtersApplied)` but FilterPanelComponent uses `[activeFilters]` and `(filtersChanged)`
- **Fix:** Used correct property names in template binding
- **Files modified:** company-list.component.html
- **Verification:** ng build compiles without binding errors
- **Committed in:** 37dafc6 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both fixes necessary for correctness. No scope creep.

## Issues Encountered

Parallel agent execution (03-08) committed Task 2 files alongside its own product files. Both tasks' code is correctly committed and the build passes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Company feature pages complete and ready for navigation integration (Plan 03-09)
- Entity list/detail/form patterns established for Contact (03-07) and Product (03-08) pages
- All 4 routes functional: /companies, /companies/new, /companies/:id, /companies/:id/edit

## Self-Check: PASSED

- [x] company-list.component.ts exists (7817 bytes)
- [x] company-list.component.html exists (1243 bytes)
- [x] company-detail.component.ts exists (7951 bytes)
- [x] company-detail.component.html exists (6285 bytes)
- [x] company-form.component.ts exists (11777 bytes)
- [x] companies.routes.ts exists (701 bytes)
- [x] Commit 37dafc6 (Task 1) exists in git log
- [x] Commit 1deff06 (Task 2) exists in git log
- [x] ng build compiles without errors

---
*Phase: 03-core-crm-entities*
*Completed: 2026-02-16*

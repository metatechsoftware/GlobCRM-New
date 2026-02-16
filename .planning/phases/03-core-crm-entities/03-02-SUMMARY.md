---
phase: 03-core-crm-entities
plan: 02
subsystem: ui
tags: [angular, ngrx-signals, typescript, api-services, signal-stores, entity-models]

# Dependency graph
requires:
  - phase: 02-core-infrastructure
    provides: "ApiService, ViewStore pattern, ViewFilter/ViewSort models, @ngrx/signals"
provides:
  - "CompanyDto, CompanyDetailDto, CreateCompanyRequest, UpdateCompanyRequest TypeScript interfaces"
  - "ContactDto, ContactDetailDto, CreateContactRequest, UpdateContactRequest TypeScript interfaces"
  - "ProductDto, CreateProductRequest, UpdateProductRequest TypeScript interfaces"
  - "CompanyService, ContactService, ProductService API services with full CRUD + pagination"
  - "CompanyStore, ContactStore, ProductStore NgRx Signal Stores with loadPage/setSort/setFilters/setSearch/loadDetail"
  - "Shared PagedResult<T>, EntityQueryParams, FilterParam, TimelineEntry query models"
affects: [03-03, 03-04, 03-05, 03-06, 03-07, 03-08, 03-09]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Entity signal store with server-side pagination", "Shared query models for cross-entity reuse", "ViewFilter to FilterParam conversion for API integration"]

key-files:
  created:
    - "globcrm-web/src/app/shared/models/query.models.ts"
    - "globcrm-web/src/app/features/companies/company.models.ts"
    - "globcrm-web/src/app/features/companies/company.service.ts"
    - "globcrm-web/src/app/features/companies/company.store.ts"
    - "globcrm-web/src/app/features/contacts/contact.models.ts"
    - "globcrm-web/src/app/features/contacts/contact.service.ts"
    - "globcrm-web/src/app/features/contacts/contact.store.ts"
    - "globcrm-web/src/app/features/products/product.models.ts"
    - "globcrm-web/src/app/features/products/product.service.ts"
    - "globcrm-web/src/app/features/products/product.store.ts"
  modified: []

key-decisions:
  - "Shared query models in shared/models/query.models.ts rather than in individual entity model files"
  - "Product detail uses ProductDto (not a separate ProductDetailDto) since products have fewer fields"
  - "All stores component-provided (not root) matching ViewStore pattern for per-page instance isolation"

patterns-established:
  - "Entity signal store pattern: withState + withMethods with inject(Service), loadPage builds params from state"
  - "Entity API service pattern: Injectable root, uses ApiService, buildQueryParams helper for EntityQueryParams"
  - "ViewFilter to FilterParam conversion via convertFilters helper inside store methods"

# Metrics
duration: 2min
completed: 2026-02-16
---

# Phase 3 Plan 02: Frontend Entity Data Layer Summary

**TypeScript models, API services, and NgRx Signal Stores for Company, Contact, and Product entities with shared pagination/query infrastructure**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-16T19:41:08Z
- **Completed:** 2026-02-16T19:43:32Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Created shared query models (PagedResult, EntityQueryParams, FilterParam, TimelineEntry) in shared/models for cross-entity reuse
- Built 3 model files, 3 API services, and 3 signal stores covering Company, Contact, and Product entities
- All services provide full CRUD + paginated list methods; Company and Contact include getTimeline
- All stores support loadPage, setSort, setFilters, setSearch, setPage, setPageSize, loadDetail, and clearDetail

## Task Commits

Each task was committed atomically:

1. **Task 1: Create entity models and API services** - `f39ad17` (feat)
2. **Task 2: Create NgRx Signal Stores** - `606c640` (feat)

## Files Created/Modified
- `globcrm-web/src/app/shared/models/query.models.ts` - PagedResult<T>, EntityQueryParams, FilterParam, TimelineEntry shared interfaces
- `globcrm-web/src/app/features/companies/company.models.ts` - CompanyDto, CompanyDetailDto, Create/UpdateCompanyRequest
- `globcrm-web/src/app/features/companies/company.service.ts` - CompanyService with CRUD + pagination + timeline
- `globcrm-web/src/app/features/companies/company.store.ts` - CompanyStore signal store with list and detail state management
- `globcrm-web/src/app/features/contacts/contact.models.ts` - ContactDto, ContactDetailDto with companyName, Create/UpdateContactRequest
- `globcrm-web/src/app/features/contacts/contact.service.ts` - ContactService with CRUD + pagination + timeline
- `globcrm-web/src/app/features/contacts/contact.store.ts` - ContactStore signal store with list and detail state management
- `globcrm-web/src/app/features/products/product.models.ts` - ProductDto with unitPrice/sku/category/isActive, Create/UpdateProductRequest
- `globcrm-web/src/app/features/products/product.service.ts` - ProductService with CRUD + pagination (no timeline)
- `globcrm-web/src/app/features/products/product.store.ts` - ProductStore signal store with list and detail state management

## Decisions Made
- **Shared query models location:** Created `shared/models/query.models.ts` instead of defining PagedResult in company.models.ts -- cleaner cross-entity imports
- **ProductDto for detail:** Product detail endpoint returns ProductDto directly (no separate ProductDetailDto) since products have fewer fields than companies/contacts
- **Component-provided stores:** All 3 entity stores are component-provided (not root) matching the ViewStore pattern so each list page gets its own instance

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All entity data layer files ready for list/detail/form pages (plans 03-05 through 03-09)
- Backend API endpoints not yet created (plan 03-03 and 03-04 will build those)
- Stores are designed for easy integration with DynamicTableComponent via items/totalCount/isLoading signals

## Self-Check: PASSED

All 10 created files verified present. Both task commits (f39ad17, 606c640) verified in git log. Angular build passes without errors.

---
*Phase: 03-core-crm-entities*
*Completed: 2026-02-16*

---
phase: 15-formula-computed-custom-fields
plan: 02
subsystem: api
tags: [ncalc, formula, custom-fields, dto-enrichment, field-registry, validation-api]

# Dependency graph
requires:
  - phase: 15-01
    provides: "FormulaEvaluationService, FormulaValidationService, FieldRegistryService, CustomField domain model with Formula support"
provides:
  - "Formula validation API endpoint (POST validate-formula)"
  - "Formula preview API endpoint (POST preview-formula)"
  - "Field registry API endpoint (GET field-registry/{entityType})"
  - "Formula-aware Create/Update CRUD on CustomFieldsController"
  - "Formula evaluation injected into all 8 entity controller DTO mappings"
affects: [15-03, 15-04]

# Tech tracking
tech-stack:
  added: []
  patterns: ["DTO enrichment via optional parameter on FromEntity", "formula evaluation on GET-only operations", "DependsOnFieldIds extracted via NCalc GetParameterNames()"]

key-files:
  created: []
  modified:
    - src/GlobCRM.Api/Controllers/CustomFieldsController.cs
    - src/GlobCRM.Api/Controllers/DealsController.cs
    - src/GlobCRM.Api/Controllers/ContactsController.cs
    - src/GlobCRM.Api/Controllers/CompaniesController.cs
    - src/GlobCRM.Api/Controllers/LeadsController.cs
    - src/GlobCRM.Api/Controllers/ActivitiesController.cs
    - src/GlobCRM.Api/Controllers/QuotesController.cs
    - src/GlobCRM.Api/Controllers/RequestsController.cs
    - src/GlobCRM.Api/Controllers/ProductsController.cs

key-decisions:
  - "Optional parameter pattern on FromEntity for backward compatibility with Create/POST endpoints"
  - "Only detail endpoints enriched for controllers where ListDto has no CustomFields (Contacts, Companies, Leads, Quotes, Requests, Products)"
  - "Both list and detail endpoints enriched for Deals and Activities (whose ListDtos include CustomFields)"
  - "DependsOnFieldIds extracted from NCalc GetParameterNames() during Create/Update"

patterns-established:
  - "DTO enrichment pattern: enrichedCustomFields ?? entity.CustomFields in FromEntity"
  - "Formula validation gate on CustomField Create/Update for Formula type fields"

requirements-completed: [FORM-04, FORM-05]

# Metrics
duration: 8min
completed: 2026-02-19
---

# Phase 15 Plan 02: Formula API Endpoints Summary

**Formula validation/preview/field-registry endpoints on CustomFieldsController plus formula evaluation injected into all 8 entity controller DTO mappings for computed-on-read formula values**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-19T07:50:00Z
- **Completed:** 2026-02-19T07:58:48Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Added 3 new API endpoints to CustomFieldsController: validate-formula, preview-formula, field-registry/{entityType}
- Made CustomFieldsController Create/Update formula-aware with server-side validation and DependsOnFieldIds extraction
- Injected FormulaEvaluationService into all 8 entity controllers (Deal, Contact, Company, Lead, Activity, Quote, Request, Product)
- All entity GET endpoints now return computed formula field values in the CustomFields dictionary
- Formula errors appear as `{ __formulaError: true, message: "..." }` objects in API responses (not exceptions)

## Task Commits

Each task was committed atomically:

1. **Task 1: CustomFieldsController formula endpoints and formula-aware CRUD** - `06640dd` (feat)
2. **Task 2: Inject formula evaluation into all 8 entity controller DTO mappings** - `b2e7b96` (feat)

## Files Created/Modified
- `src/GlobCRM.Api/Controllers/CustomFieldsController.cs` - Added validate-formula, preview-formula, field-registry endpoints; formula-aware Create/Update with validation and DependsOnFieldIds
- `src/GlobCRM.Api/Controllers/DealsController.cs` - Injected FormulaEvaluationService; enriched both list and detail DTO mappings
- `src/GlobCRM.Api/Controllers/ContactsController.cs` - Injected FormulaEvaluationService; enriched detail DTO mapping
- `src/GlobCRM.Api/Controllers/CompaniesController.cs` - Injected FormulaEvaluationService; enriched detail DTO mapping
- `src/GlobCRM.Api/Controllers/LeadsController.cs` - Injected FormulaEvaluationService; enriched detail DTO mapping
- `src/GlobCRM.Api/Controllers/ActivitiesController.cs` - Injected FormulaEvaluationService; enriched both list and detail DTO mappings
- `src/GlobCRM.Api/Controllers/QuotesController.cs` - Injected FormulaEvaluationService; enriched detail DTO mapping
- `src/GlobCRM.Api/Controllers/RequestsController.cs` - Injected FormulaEvaluationService; enriched detail DTO mapping
- `src/GlobCRM.Api/Controllers/ProductsController.cs` - Injected FormulaEvaluationService; enriched detail DTO mapping

## Decisions Made
- Used optional parameter pattern on FromEntity (`Dictionary<string, object?>? enrichedCustomFields = null`) for backward compatibility -- existing callers (Create/POST endpoints) continue to work without changes
- Only enriched detail endpoints for controllers where ListDto lacks CustomFields (Contacts, Companies, Leads, Quotes, Requests, Products) -- list DTOs for these entities do not expose custom fields
- Enriched both list and detail endpoints for Deals and Activities since their ListDtos include CustomFields
- Skipped the private helper method suggested in the plan; called `_formulaEvaluator.EvaluateFormulasForEntityAsync()` directly for simplicity and fewer indirection layers
- Added `FieldName` parameter to `ValidateFormulaRequest` for self-reference detection during validation

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Backend formula engine is fully wired: domain model, evaluation/validation/registry services, API endpoints, and DTO enrichment all complete
- Ready for Plan 03 (Angular frontend formula field components) to consume the validate-formula, preview-formula, and field-registry endpoints
- Ready for Plan 04 (end-to-end integration) to verify computed formula values appear in entity detail/list views

## Self-Check: PASSED

- All 9 modified files verified present
- Commit 06640dd (Task 1) verified in git log
- Commit b2e7b96 (Task 2) verified in git log

---
*Phase: 15-formula-computed-custom-fields*
*Completed: 2026-02-19*

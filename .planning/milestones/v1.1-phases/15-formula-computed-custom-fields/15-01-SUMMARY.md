---
phase: 15-formula-computed-custom-fields
plan: 01
subsystem: api
tags: [ncalc, formula-fields, expression-evaluation, custom-fields, topological-sort]

# Dependency graph
requires:
  - phase: 08-custom-fields-views
    provides: "CustomFieldDefinition entity, CustomFieldType enum, ICustomFieldRepository, CustomFieldsController, CustomFieldServiceExtensions"
provides:
  - "CustomFieldType.Formula = 10 enum value"
  - "FormulaExpression, FormulaResultType, DependsOnFieldIds columns on custom_field_definitions"
  - "FormulaEvaluationService with NCalc engine, topological sort, DATEDIFF/CONCAT functions"
  - "FormulaValidationService with syntax/field-ref/circular-dep validation and preview"
  - "FieldRegistryService with system field definitions for all 8 CRM entity types"
  - "DTO and request records updated for formula field CRUD"
affects: [15-02, 15-03, 15-04]

# Tech tracking
tech-stack:
  added: [NCalcSync 5.11.0, NCalc.Core 5.11.0, Parlot 1.5.6, ExtendedNumerics.BigDecimal]
  patterns: [formula-evaluation-on-read, topological-sort-dependency-ordering, field-registry-per-entity-type, ncalc-custom-function-registration]

key-files:
  created:
    - src/GlobCRM.Infrastructure/FormulaFields/FieldRegistryService.cs
    - src/GlobCRM.Infrastructure/FormulaFields/FormulaEvaluationService.cs
    - src/GlobCRM.Infrastructure/FormulaFields/FormulaValidationService.cs
    - src/GlobCRM.Infrastructure/FormulaFields/FormulaFieldServiceExtensions.cs
    - src/GlobCRM.Infrastructure/Persistence/Migrations/App/20260219074405_AddFormulaFields.cs
  modified:
    - src/GlobCRM.Domain/Enums/CustomFieldType.cs
    - src/GlobCRM.Domain/Entities/CustomFieldDefinition.cs
    - src/GlobCRM.Infrastructure/Persistence/Configurations/CustomFieldDefinitionConfiguration.cs
    - src/GlobCRM.Infrastructure/GlobCRM.Infrastructure.csproj
    - src/GlobCRM.Infrastructure/CustomFields/CustomFieldServiceExtensions.cs
    - src/GlobCRM.Api/Controllers/CustomFieldsController.cs

key-decisions:
  - "NCalc v5 EvaluateFunction event handler pattern for DATEDIFF/CONCAT (not Functions dictionary)"
  - "Field references use snake_case custom field names and camelCase system field names - no GUID references"
  - "FormulaResultType is admin-selected (number/text/date) for explicit display formatting"
  - "DependsOnFieldIds stores field names (not GUIDs) for readable dependency tracking"
  - "Formula services registered via AddFormulaFieldServices() chained from AddCustomFieldServices()"

patterns-established:
  - "FormulaFields/ directory under Infrastructure for all formula-related services"
  - "FieldRegistryService switch expression per entity type for system field definitions"
  - "TopologicalSort via Kahn's algorithm as static method on FormulaEvaluationService"
  - "ConvertJsonValue helper for JsonElement-to-.NET type conversion"
  - "Formula errors as Dictionary with __formulaError marker for frontend #ERR display"

requirements-completed: [FORM-01, FORM-02, FORM-03, FORM-05]

# Metrics
duration: 5min
completed: 2026-02-19
---

# Phase 15 Plan 01: Backend Foundation Summary

**NCalc-based formula evaluation engine with topological sort, DATEDIFF/CONCAT functions, field registry for 8 entity types, and comprehensive validation (syntax/field-refs/circular-deps)**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-19T07:42:49Z
- **Completed:** 2026-02-19T07:48:02Z
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments
- Extended domain model with Formula = 10 enum value and three formula-specific properties (FormulaExpression, FormulaResultType, DependsOnFieldIds)
- Built NCalc-based evaluation engine with custom DATEDIFF/CONCAT functions, topological dependency sorting, and chained formula support
- Created comprehensive validation service: NCalc syntax validation, field reference validation against full registry, circular dependency detection via topological sort
- Built field registry service covering all 8 CRM entity types (Deal, Contact, Company, Lead, Activity, Quote, Request, Product) with system field definitions and entity value extraction
- Updated CustomFieldsController DTOs, request records, and validator for formula field CRUD

## Task Commits

Each task was committed atomically:

1. **Task 1: Domain model extension, NCalc package, EF configuration, and migration** - `170f13d` (feat)
2. **Task 2: Formula evaluation, validation, and field registry services with DI registration** - `03bbb55` (feat)

## Files Created/Modified
- `src/GlobCRM.Domain/Enums/CustomFieldType.cs` - Added Formula = 10 enum value
- `src/GlobCRM.Domain/Entities/CustomFieldDefinition.cs` - Added FormulaExpression, FormulaResultType, DependsOnFieldIds properties
- `src/GlobCRM.Infrastructure/Persistence/Configurations/CustomFieldDefinitionConfiguration.cs` - EF mapping for formula columns (varchar + JSONB)
- `src/GlobCRM.Infrastructure/GlobCRM.Infrastructure.csproj` - Added NCalcSync 5.11.0 package reference
- `src/GlobCRM.Infrastructure/Persistence/Migrations/App/20260219074405_AddFormulaFields.cs` - Migration adding formula_expression, formula_result_type, depends_on_field_ids columns
- `src/GlobCRM.Infrastructure/FormulaFields/FieldRegistryService.cs` - System field registry per entity type, custom/formula field mapping, entity value extraction
- `src/GlobCRM.Infrastructure/FormulaFields/FormulaEvaluationService.cs` - NCalc evaluation engine with custom functions, topological sort, JsonElement conversion
- `src/GlobCRM.Infrastructure/FormulaFields/FormulaValidationService.cs` - Syntax, field ref, and circular dependency validation with preview
- `src/GlobCRM.Infrastructure/FormulaFields/FormulaFieldServiceExtensions.cs` - DI registration for all three services
- `src/GlobCRM.Infrastructure/CustomFields/CustomFieldServiceExtensions.cs` - Wired AddFormulaFieldServices() into AddCustomFieldServices()
- `src/GlobCRM.Api/Controllers/CustomFieldsController.cs` - DTO, request records, validator updated for formula fields

## Decisions Made
- Used NCalc v5 `EvaluateFunction` event handler pattern (not `Functions` dictionary) as the v5 API uses event-based function registration
- Field references use snake_case custom field names and camelCase system field names for readability (not GUID references)
- FormulaResultType is admin-selected ("number", "text", "date") rather than auto-detected for explicit display formatting
- DependsOnFieldIds stores field names (not GUIDs) for readable dependency tracking and stable formula portability
- Formula services registered via AddFormulaFieldServices() chained from existing AddCustomFieldServices() for cohesion

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed NCalc API method name: GetParameterNames (not GetParametersNames)**
- **Found during:** Task 2 (FormulaValidationService)
- **Issue:** Research document referenced `GetParametersNames()` but NCalcSync v5.11.0 API uses `GetParameterNames()` (no 's' before Names)
- **Fix:** Updated method call to `GetParameterNames()` matching the actual NCalc v5 API
- **Files modified:** src/GlobCRM.Infrastructure/FormulaFields/FormulaValidationService.cs
- **Verification:** Build succeeds with 0 errors
- **Committed in:** 03bbb55 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug - incorrect API method name from research)
**Impact on plan:** Minor API naming correction. No scope creep.

## Issues Encountered
None beyond the API naming deviation documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Backend foundation complete: domain model, evaluation engine, validation service, field registry
- Plan 02 can build API endpoints (validate-formula, preview, available-fields) on top of these services
- Plans 03-04 can build frontend formula editor using the field registry and validation APIs

## Self-Check: PASSED

All 10 key files verified present. Both task commits (170f13d, 03bbb55) verified in git log. Build succeeds with 0 errors.

---
*Phase: 15-formula-computed-custom-fields*
*Completed: 2026-02-19*

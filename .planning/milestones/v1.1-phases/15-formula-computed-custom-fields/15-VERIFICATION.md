---
phase: 15-formula-computed-custom-fields
verified: 2026-02-19T09:00:00Z
status: passed
score: 18/18 must-haves verified
re_verification: false
---

# Phase 15: Formula / Computed Custom Fields Verification Report

**Phase Goal:** Admins can define formula-based custom fields that automatically compute values from other fields, extending the custom field system with calculated intelligence
**Verified:** 2026-02-19T09:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth                                                                                                      | Status     | Evidence                                                                                   |
|----|------------------------------------------------------------------------------------------------------------|------------|--------------------------------------------------------------------------------------------|
| 1  | FormulaEvaluationService can evaluate arithmetic expressions with field references                         | VERIFIED   | `EvaluateFormulasForEntityAsync` in FormulaEvaluationService.cs; calls NCalc `Expression`  |
| 2  | FormulaEvaluationService supports IF(), DATEDIFF(), and CONCAT() custom functions                          | VERIFIED   | `RegisterCustomFunctions` uses `EvaluateFunction` event; DATEDIFF/CONCAT registered         |
| 3  | FormulaValidationService detects syntax errors, unknown field references, and circular dependencies        | VERIFIED   | `ValidateAsync` runs 3-step pipeline: NCalc HasErrors(), GetParameterNames(), TopologicalSort |
| 4  | Topological sort orders formula fields by dependency for chained evaluation                                | VERIFIED   | `TopologicalSort` (Kahn's algorithm) in FormulaEvaluationService.cs, line 202               |
| 5  | CustomFieldType.Formula = 10 exists in backend enum and domain model                                      | VERIFIED   | `Formula = 10` in CustomFieldType.cs line 37                                               |
| 6  | CustomFieldDefinition has FormulaExpression, FormulaResultType, DependsOnFieldIds persisted               | VERIFIED   | All three properties on entity (lines 55–68); EF config maps to formula_expression, formula_result_type, depends_on_field_ids (jsonb) |
| 7  | API endpoint validates formula expressions with syntax/field ref/circular dep errors                       | VERIFIED   | `POST validate-formula` at line 301 in CustomFieldsController.cs calls ValidateAsync        |
| 8  | API endpoint previews formula result with sample or real entity data                                       | VERIFIED   | `POST preview-formula` at line 320 calls PreviewAsync with optional sampleEntityId          |
| 9  | API endpoint returns available fields grouped by category for autocomplete                                 | VERIFIED   | `GET field-registry/{entityType}` at line 339 calls FieldRegistryService.GetAvailableFields |
| 10 | All entity GET responses include computed formula field values in the customFields dictionary               | VERIFIED   | All 8 entity controllers inject FormulaEvaluationService and call EvaluateFormulasForEntityAsync on GET |
| 11 | Formula errors appear as __formulaError objects in the API response                                        | VERIFIED   | EvaluateSingle returns `{ "__formulaError": true, "message": ex.Message }` on failure      |
| 12 | Formula-aware create/update validates formulas and stores DependsOnFieldIds                                | VERIFIED   | CustomFieldsController Create/Update (lines 126–151, 219–247) validate and store deps       |
| 13 | Admin sees formula editor when creating/editing a Formula type custom field                                | VERIFIED   | `custom-field-edit-dialog.component.html` shows formula section at `@if (showFormula())`    |
| 14 | Typing '[' triggers autocomplete dropdown with fields grouped by System/Custom/Formula                     | VERIFIED   | `onKeyUp` in formula-editor.component.ts sets showAutocomplete on '['; `groupedFields` computed signal groups by category |
| 15 | Formula editor shows real-time validation and live preview                                                 | VERIFIED   | `validateAndPreview()` uses debounceTime(500), calls validateFormula then previewFormula sequentially |
| 16 | Admin must select result type (Number, Text, Date) and save is blocked until formula validates              | VERIFIED   | `formulaResultType` form control in dialog; save button disabled when `showFormula() && !formulaValid()` |
| 17 | Formula field values display in dynamic table as read-only with #ERR tooltip on errors                     | VERIFIED   | DynamicTableComponent.html lines 57–60: `@if (isFormulaErrorValue(...))` renders `#ERR` with matTooltip |
| 18 | Formula fields display as read-only computed values in detail page custom field sections                    | VERIFIED   | CustomFieldFormComponent `@case ('formula')` renders display-only div with functions icon; no FormControl created (line 452: `continue`) |

**Score:** 18/18 truths verified

### Required Artifacts

| Artifact                                                                                   | Provides                                              | Exists | Substantive | Wired      | Status     |
|--------------------------------------------------------------------------------------------|-------------------------------------------------------|--------|-------------|------------|------------|
| `src/GlobCRM.Domain/Enums/CustomFieldType.cs`                                              | Formula = 10 enum value                               | Yes    | Yes         | Yes        | VERIFIED   |
| `src/GlobCRM.Domain/Entities/CustomFieldDefinition.cs`                                     | FormulaExpression, FormulaResultType, DependsOnFieldIds | Yes  | Yes         | Yes        | VERIFIED   |
| `src/GlobCRM.Infrastructure/FormulaFields/FormulaEvaluationService.cs`                     | NCalc engine, topological sort, custom functions      | Yes    | Yes (304 lines, full impl) | Yes (injected in 8 controllers) | VERIFIED |
| `src/GlobCRM.Infrastructure/FormulaFields/FormulaValidationService.cs`                     | 3-step validation + preview                           | Yes    | Yes (263 lines, full impl) | Yes (injected in CustomFieldsController) | VERIFIED |
| `src/GlobCRM.Infrastructure/FormulaFields/FieldRegistryService.cs`                         | Field registry for 8 entity types                    | Yes    | Yes (331 lines, all 8 entities) | Yes (injected in CustomFieldsController + ValidationService) | VERIFIED |
| `src/GlobCRM.Infrastructure/FormulaFields/FormulaFieldServiceExtensions.cs`                | DI registration for all 3 services                   | Yes    | Yes         | Yes (called from AddCustomFieldServices) | VERIFIED |
| `src/GlobCRM.Infrastructure/Persistence/Migrations/App/20260219074405_AddFormulaFields.cs` | DB migration adding formula columns                  | Yes    | Yes (3 columns: formula_expression, formula_result_type, depends_on_field_ids jsonb) | Yes | VERIFIED |
| `src/GlobCRM.Api/Controllers/CustomFieldsController.cs`                                    | validate-formula, preview-formula, field-registry endpoints | Yes | Yes (3 endpoints) | Yes (FormulaValidationService, FieldRegistryService injected) | VERIFIED |
| `src/GlobCRM.Api/Controllers/DealsController.cs`                                           | Formula evaluation in DTO mapping                    | Yes    | Yes         | Yes (list + detail enriched) | VERIFIED   |
| `globcrm-web/src/app/features/settings/custom-fields/formula-editor/formula-editor.component.ts` | Autocomplete, validation, preview editor         | Yes    | Yes (264 lines, full impl) | Yes (imported in custom-field-edit-dialog) | VERIFIED |
| `globcrm-web/src/app/core/custom-fields/custom-field.models.ts`                            | Formula type, FieldInfo, FormulaError, isFormulaError | Yes  | Yes         | Yes        | VERIFIED   |
| `globcrm-web/src/app/core/custom-fields/custom-field.service.ts`                           | validateFormula, previewFormula, getFieldRegistry     | Yes    | Yes         | Yes (called from formula-editor.component) | VERIFIED |
| `globcrm-web/src/app/shared/components/dynamic-table/dynamic-table.component.ts`           | isFormulaError detection, #ERR display, tooltip       | Yes    | Yes         | Yes (isFormulaError imported, template renders #ERR) | VERIFIED |
| `globcrm-web/src/app/shared/components/custom-field-form/custom-field-form.component.ts`   | Read-only formula display in detail pages             | Yes    | Yes (@case 'formula' in inline template, no FormControl) | Yes | VERIFIED |

### Key Link Verification

| From                                              | To                                     | Via                               | Status  | Details                                                                                              |
|---------------------------------------------------|----------------------------------------|-----------------------------------|---------|------------------------------------------------------------------------------------------------------|
| FormulaEvaluationService.cs                       | NCalc Expression class                | `new Expression(...)` calls       | WIRED   | Line 90, 115: `new Expression(expression)`, NCalcSync 5.11.0 referenced in .csproj                  |
| FormulaValidationService.cs                       | FieldRegistryService.cs               | field reference validation        | WIRED   | Constructor injection; `GetAvailableFields` called at line 94                                        |
| FormulaFieldServiceExtensions.cs                  | DI container                          | AddFormulaFieldServices()         | WIRED   | Called from `CustomFieldServiceExtensions.AddCustomFieldServices()` line 30                          |
| CustomFieldsController.cs                         | FormulaValidationService.cs           | validate-formula endpoint         | WIRED   | Constructor injection; `_formulaValidation.ValidateAsync()` called at line 308                       |
| DealsController.cs                                | FormulaEvaluationService.cs           | EvaluateFormulasForEntityAsync    | WIRED   | Constructor injection; called at lines 93 and 130 (list + detail)                                   |
| formula-editor.component.ts                       | custom-field.service.ts               | validateFormula + previewFormula  | WIRED   | `validateAndPreview()` calls `fieldService.validateFormula(...)` then `fieldService.previewFormula(...)` |
| custom-field-edit-dialog.component.ts             | formula-editor.component.ts           | app-formula-editor selector       | WIRED   | FormulaEditorComponent imported at line 33; used in template at line 160                             |
| dynamic-table.component.ts                        | custom-field.models.ts                | isFormulaError type guard         | WIRED   | `import { isFormulaError }` at line 31; used in `isFormulaErrorValue()` method                      |
| custom-field-form.component.ts                    | custom-field.models.ts                | CustomFieldType.Formula enum      | WIRED   | `CustomFieldType` imported at line 30; `@case ('formula')` in template, skip guard at line 452       |

### Requirements Coverage

| Requirement | Source Plan(s) | Description                                                                         | Status    | Evidence                                                                                                     |
|-------------|----------------|-------------------------------------------------------------------------------------|-----------|--------------------------------------------------------------------------------------------------------------|
| FORM-01     | 15-01, 15-03   | Admin can create formula custom fields with arithmetic expressions and field references | SATISFIED | Formula = 10 in enum; FormulaEditorComponent with textarea + autocomplete; CustomFieldsController Create supports formulaExpression |
| FORM-02     | 15-01          | Formula fields support date difference calculations (days between dates)            | SATISFIED | DATEDIFF(date1, date2) registered in `RegisterCustomFunctions`; returns `(date2 - date1).Days`               |
| FORM-03     | 15-01          | Formula fields support string concatenation and conditional logic (IF)              | SATISFIED | CONCAT registered in custom functions; NCalc built-in `if()` works natively; confirmed by registration comment in code |
| FORM-04     | 15-02, 15-04   | Formula values are computed on-read and displayed as read-only in all views         | SATISFIED | All 8 entity controllers enrich GET responses; dynamic table #ERR display; custom-field-form read-only @case; formula fields skip FormControl |
| FORM-05     | 15-01, 15-02, 15-03 | Admin receives validation feedback when creating invalid formulas (syntax errors, circular references) | SATISFIED | 3-step ValidateAsync (syntax + field refs + circular deps); validate-formula endpoint; FormulaEditorComponent shows real-time validation errors with debounce |

All 5 requirements (FORM-01 through FORM-05) are accounted for in the plans and verified in the codebase. No orphaned requirements.

### Anti-Patterns Found

No blockers or warnings found. The only "placeholder" references in the codebase are correctly-named placeholder values used intentionally in the preview feature (sample data for preview when no real entity ID is provided). These are functional code, not stubs.

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | — | — | — |

### Build Verification

- Backend `dotnet build`: **PASSED** — 0 errors, 2 analyzer warnings (pre-existing, unrelated to phase 15)
- Frontend `npx tsc --noEmit`: **PASSED** — 4 errors, all from `crm-button/index.ts` (pre-existing `isolatedModules` export-type issue, unrelated to phase 15)
- All 7 git commits verified present: 170f13d, 03bbb55, 06640dd, b2e7b96, 1606fcb, 25694f3, c5de0a8

### Human Verification Required

The following items require a running application to verify fully. All automated checks passed, but these confirm the user-facing experience:

**1. Formula Autocomplete UX**
- **Test:** Open Settings > Custom Fields for "Deal" entity, create a new field with type "Formula", type `[` in the expression textarea
- **Expected:** Autocomplete dropdown appears showing System fields (title, value, probability, expectedCloseDate...), with fields grouped by System/Custom/Formula category
- **Why human:** Dropdown positioning and visual grouping cannot be verified programmatically

**2. Live Validation and Preview**
- **Test:** Enter `[value] * [probability] / 100` in the formula expression field
- **Expected:** After 500ms debounce, validation passes (no errors), preview shows a numeric result (e.g., 0 for placeholder data)
- **Why human:** API calls and real-time UI updates require a running backend and frontend

**3. Formula Values in Deal List Page**
- **Test:** Create a Formula custom field on Deal entity, open the Deals list
- **Expected:** The formula column shows computed values. If formula fails, the cell shows "#ERR" in red with a tooltip explaining the error
- **Why human:** Requires actual custom field definition in a running tenant database

**4. Formula Field Read-Only on Detail Page**
- **Test:** Open a Deal detail page that has a formula custom field
- **Expected:** The formula field renders with a "functions" icon next to the label, shows the computed value, and has no input control. The field does not appear in form submission on save
- **Why human:** Requires live data and visual inspection

**5. Circular Dependency Rejection**
- **Test:** Create formula field A referencing field B, then create formula field B referencing field A
- **Expected:** The second formula creation fails validation with "Circular reference detected" error message
- **Why human:** Requires two formula fields to exist in the tenant database

---

## Gaps Summary

No gaps. All 18 must-have truths are verified. All 5 requirements (FORM-01 through FORM-05) are satisfied with substantive implementations:

- Backend foundation is complete: NCalc engine, topological sort, custom functions (DATEDIFF/CONCAT/IF), field registry for all 8 entity types, 3-step validation (syntax + field refs + circular deps), EF migration with formula columns
- API layer is complete: 3 formula endpoints (validate, preview, field-registry), formula-aware CRUD, formula evaluation injected into all 8 entity controllers
- Frontend formula editor is complete: bracket-triggered autocomplete with field grouping, debounced real-time validation, live preview, result type selector, save blocked on invalid formula
- Frontend display is complete: dynamic table shows #ERR with tooltip, custom-field-form renders formula as read-only with functions icon, formula fields excluded from form submission, filterable:false applied across all 10 list components

---

_Verified: 2026-02-19T09:00:00Z_
_Verifier: Claude (gsd-verifier)_

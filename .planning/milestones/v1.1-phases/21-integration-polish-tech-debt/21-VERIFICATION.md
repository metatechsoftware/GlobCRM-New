---
phase: 21-integration-polish-tech-debt
verified: 2026-02-19T21:30:00Z
status: passed
score: 4/4 must-haves verified
re_verification: false
human_verification:
  - test: "Open workflow builder with a workflow that has a sendEmail action, verify template dropdown appears with search and shows template name + subject"
    expected: "mat-select dropdown opens, shows search input at top, options display template name in bold with subject below in secondary text"
    why_human: "Visual rendering of mat-select with custom option layout cannot be verified programmatically"
  - test: "Open workflow builder with a workflow that has a enrollInSequence action, verify sequence dropdown shows name + step count + status badge"
    expected: "mat-select dropdown opens with search input, options show sequence name, step count, and colored status badge (active/draft/paused/archived)"
    why_human: "Visual rendering and CSS class application for status badges cannot be verified programmatically"
  - test: "Load a workflow that references a deleted template ID, verify amber banner appears"
    expected: "Amber warning banner appears at top of builder content area with warning icon and message describing the stale reference"
    why_human: "Requires a runtime environment with a deleted template UUID to trigger the stale detection path"
  - test: "Attempt to save a workflow with a stale template/sequence reference, verify save is blocked"
    expected: "onSave() shows snackbar error 'Cannot save: Action ... references a deleted email template', workflow is not saved"
    why_human: "Requires runtime environment with deleted template/sequence to exercise the blocking path"
---

# Phase 21: Integration Polish & Tech Debt Closure Verification Report

**Phase Goal:** Close all integration gaps and tech debt identified by v1.1 milestone audit — ensure CSV export DI is reliable, workflow builder has proper UX pickers, and duplicate registrations are cleaned up
**Verified:** 2026-02-19T21:30:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | ReportCsvExportJob is explicitly registered in DI and CSV export Hangfire flow completes without activation errors | VERIFIED | `services.AddScoped<ReportCsvExportJob>()` present at line 15 of `ReportingServiceExtensions.cs`; `AddReportingServices()` called at line 204 of `DependencyInjection.cs` |
| 2 | Workflow builder "Send Email" and "Enroll in Sequence" action panels use mat-select dropdowns populated from API (not free-text UUID inputs) | VERIFIED | `action-config.component.ts` lines 258-283 (Send Email) and 337-363 (Enroll in Sequence) use `<mat-select>` with `filteredTemplates()` / `filteredSequences()` computed signals; templates/sequences inputs populated from parent; no `matInput` for these fields |
| 3 | No duplicate DI registrations exist between Program.cs and DependencyInjection.cs | VERIFIED | `grep "AddDomainEventServices\|AddEmailTemplateServices" Program.cs` returns no matches; canonical calls exist in `DependencyInjection.cs` at lines 60 and 184 |
| 4 | DuplicatesController uses correct field naming (Website for companies, Email for contacts) | VERIFIED | `DuplicatesController.cs` line 130: `Website = m.SecondaryField`; line 235: `Website = m.SecondaryField`; no `m.Email` in company mappings; no misleading field overloading comments remain |

**Score:** 4/4 truths verified

---

### Required Artifacts — Plan 01 (Backend DI fixes)

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/GlobCRM.Infrastructure/Reporting/ReportingServiceExtensions.cs` | ReportCsvExportJob DI registration | VERIFIED | 19 lines, contains `services.AddScoped<ReportCsvExportJob>()` after `AddScoped<ReportQueryEngine>()` |
| `src/GlobCRM.Api/Program.cs` | Clean DI pipeline without duplicate registrations | VERIFIED | 203 lines; `AddDomainEventServices` and `AddEmailTemplateServices` absent; `AddInfrastructure()` present at line 56; single clean pipeline |
| `src/GlobCRM.Domain/Interfaces/IDuplicateDetectionService.cs` | DuplicateMatch record with explicit SecondaryField property | VERIFIED | `SecondaryField` parameter at position 4 in `DuplicateMatch` record (line 48); XML doc present explaining semantics |
| `src/GlobCRM.Infrastructure/Duplicates/DuplicateDetectionService.cs` | DuplicateMatch construction using SecondaryField for companies | VERIFIED | All company `new DuplicateMatch(...)` calls pass `null` for Email and `c.Website`/`a.Website`/`b.Website` as SecondaryField (lines 143-149, 238-240); contact calls pass `c.Email` for Email and `null` for SecondaryField (lines 77-83, 194-195) |
| `src/GlobCRM.Api/Controllers/DuplicatesController.cs` | Clean DTO mapping without field overloading comments | VERIFIED | Company DTOs: `Website = m.SecondaryField` at lines 130 and 235; contact DTOs: `Email = m.Email` unchanged; no misleading comments found |

### Required Artifacts — Plan 02 (Frontend workflow pickers)

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `globcrm-web/src/app/features/workflows/workflow-builder/panels/action-config.component.ts` | Searchable mat-select pickers for email template and sequence selection | VERIFIED | 746 lines; `templates` and `sequences` inputs declared (lines 556-557); `templateSearch`/`sequenceSearch` signals (lines 560-561); `filteredTemplates`/`filteredSequences` computed (lines 563-578); mat-select with search for both action types (lines 258-295 Send Email; 329-364 Enroll in Sequence) |
| `globcrm-web/src/app/features/workflows/workflow-builder/workflow-builder.component.ts` | Template/sequence list loading, stale reference detection, save validation | VERIFIED | 459 lines; `loadPickerData()` via `forkJoin` (lines 148-164); `detectStaleReferences()` (lines 166-187); `onSave()` blocks on `staleWarnings` (lines 324-333); `ngOnInit()` calls `loadPickerData()` (line 109) |
| `globcrm-web/src/app/features/workflows/workflow-builder/workflow-builder.component.html` | Amber stale reference warning banner | VERIFIED | Lines 19-28: `@if (staleWarnings().length > 0)` block with `stale-warning-banner` div; `[templates]="templates()"` and `[sequences]="sequences()"` passed to both `app-action-config` usages (lines 127-129 and 143-145) |
| `src/GlobCRM.Api/Controllers/EmailTemplatesController.cs` | GET /api/email-templates/{id}/usage endpoint | VERIFIED | Lines 269-283: `[HttpGet("{id:guid}/usage")]`, `GetTemplateUsage()` method with raw SQL JSONB text search returning `{ usedByCount, workflows }` |
| `src/GlobCRM.Api/Controllers/SequencesController.cs` | GET /api/sequences/{id}/usage endpoint | VERIFIED | Lines 888-902: `[HttpGet("{id:guid}/usage")]`, `GetSequenceUsage()` method with identical pattern |

---

### Key Link Verification — Plan 01

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `ReportingServiceExtensions.cs` | `ReportCsvExportJob.cs` | `AddScoped<ReportCsvExportJob>()` | WIRED | Registration present at line 15; `AddReportingServices()` is called by `DependencyInjection.cs` line 204 |
| `Program.cs` | `DependencyInjection.cs` | `AddInfrastructure(...)` | WIRED | `builder.Services.AddInfrastructure(builder.Configuration, builder.Environment)` at line 56; `AddDomainEventServices`/`AddEmailTemplateServices` confirmed only in `DependencyInjection.cs`, not in `Program.cs` |

### Key Link Verification — Plan 02

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `action-config.component.ts` | `email-template.models.ts` | `EmailTemplateListItem` type import | WIRED | Import at line 23; type used as `input<EmailTemplateListItem[]>` at line 556 and in `filteredTemplates` computed |
| `action-config.component.ts` | `sequence.models.ts` | `SequenceListItem` type import | WIRED | Import at line 24; type used as `input<SequenceListItem[]>` at line 557 and in `filteredSequences` computed |
| `workflow-builder.component.ts` | `email-template.service.ts` | `inject(EmailTemplateService)` | WIRED | Import at line 25; `inject(EmailTemplateService)` at line 65; `emailTemplateService.getTemplates()` called in `loadPickerData()` line 150 |
| `workflow-builder.component.ts` | `sequence.service.ts` | `inject(SequenceService)` | WIRED | Import at line 27; `inject(SequenceService)` at line 66; `sequenceService.getSequences()` called in `loadPickerData()` line 151 |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| RPT-06 | 21-01-PLAN.md | User can export report results to CSV | SATISFIED | `ReportCsvExportJob` registered via `AddScoped<ReportCsvExportJob>()` in `ReportingServiceExtensions.cs` line 15; Hangfire can now resolve the job without `InvalidOperationException: Unable to activate type` errors |
| WFLOW-07 | 21-02-PLAN.md | User can add "send email" action using an email template with merge fields | SATISFIED | Send Email action panel replaced from free-text UUID input to searchable mat-select populated from `EmailTemplateService.getTemplates()` API; template name + subject shown per option |
| WFLOW-09 | 21-02-PLAN.md | User can add "enroll in sequence" action to start email sequences | SATISFIED | Enroll in Sequence action panel replaced from free-text UUID input to searchable mat-select populated from `SequenceService.getSequences()` API; sequence name + step count + status badge shown per option |

All three requirement IDs declared in plan frontmatter are accounted for. No orphaned requirements found via `grep "Phase 21" .planning/REQUIREMENTS.md` cross-check (requirements assigned to Phase 19/20, not 21, per ROADMAP).

---

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|---------|--------|
| None found | — | — | — |

Scanned: `ReportingServiceExtensions.cs`, `action-config.component.ts`, `DuplicatesController.cs`, `workflow-builder.component.ts`, `workflow-builder.component.html`. No TODO/FIXME/PLACEHOLDER comments, no empty return stubs, no console.log-only handlers found.

---

### Human Verification Required

#### 1. Template Picker Visual Rendering

**Test:** Open the workflow builder for any workflow, add or select an action node, set Action Type to "Send Email", open the Email Template dropdown
**Expected:** Dropdown shows a search input at the top (sticky), below it a list of templates with name in bold and subject in smaller secondary text per option
**Why human:** mat-select rendering and CSS class application for `.option-name`/`.option-preview` cannot be verified from static analysis

#### 2. Sequence Picker Status Badges

**Test:** Open the workflow builder, add an "Enroll in Sequence" action, open the Sequence dropdown
**Expected:** Options show sequence name, step count, and a colored badge (green for active, gray for draft, amber for paused, red for archived)
**Why human:** CSS `.status-active/.status-draft/.status-paused/.status-archived` class application to `.status-badge` spans is a visual runtime concern

#### 3. Stale Reference Warning Banner

**Test:** Construct a workflow with a sendEmail node whose `emailTemplateId` config value is a UUID not present in the loaded templates list; open the builder
**Expected:** Amber banner with warning icon appears below the toolbar, before the canvas, listing the stale action name
**Why human:** Requires a runtime environment with a deliberately deleted/mismatched template ID; stale detection logic is present and wired, but the banner appearance requires visual confirmation

#### 4. Save Blocking on Stale References

**Test:** With a stale reference present (as above), click Save
**Expected:** SnackBar appears with "Cannot save: Action X references a deleted email template", workflow is not saved
**Why human:** Requires runtime environment to trigger the blocking code path in `onSave()`

---

### Verification Notes

**Plan 01 INT-03 fix confirmed clean:** `grep "AddDomainEventServices\|AddEmailTemplateServices"` in `Program.cs` returns zero matches. The canonical calls in `DependencyInjection.cs` at lines 60 and 184 are the sole registration sites. No double registration risk.

**DuplicateMatch field semantics confirmed correct:** Company `DuplicateMatch` construction passes `null` for `Email` (companies have no per-match email in the detection tier — email is enriched separately from the `companyDetails` query). Website is stored in `SecondaryField`. Contact matches pass the actual `c.Email` for `Email` and `null` for `SecondaryField`. Controller DTOs correctly read `m.SecondaryField` for company `Website` and `m.Email` for contact `Email`.

**EmailTemplateService.getTemplates() compatibility:** The method accepts optional params (all optional, no required args), so `getTemplates()` called without arguments in `loadPickerData()` is valid and returns all templates.

**Usage endpoint implementation:** Both controllers use raw SQL `CAST(definition AS text) ILIKE` rather than EF Core LINQ because the `Workflow.Definition` is a JSONB owned type (mapped via `ToJson()`) that does not support LINQ text search. Raw SQL approach is correct for this schema.

**`stale-warning-banner` CSS:** Defined in `workflow-builder.component.scss` (line 83) and referenced in `workflow-builder.component.html` (line 20). Both sides of the wiring are present.

---

_Verified: 2026-02-19T21:30:00Z_
_Verifier: Claude (gsd-verifier)_

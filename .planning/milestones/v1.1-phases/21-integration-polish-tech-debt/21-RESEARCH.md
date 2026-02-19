# Phase 21: Integration Polish & Tech Debt Closure - Research

**Researched:** 2026-02-19
**Domain:** .NET DI registration, Angular Material pickers, cross-module integration hardening
**Confidence:** HIGH

## Summary

Phase 21 is a hardening-only phase that closes four specific gaps identified in the v1.1 milestone audit. The changes span two categories: (1) backend fixes that are surgical one-liner or few-line edits (DI registration, duplicate cleanup, field rename), and (2) a frontend UX improvement replacing free-text UUID inputs with searchable `mat-select` dropdowns in the workflow builder action config panel, plus stale reference handling across the workflow system.

All affected files have been located and analyzed. The backend fixes are straightforward with no architectural risk. The frontend picker work is the most involved item --- it requires injecting `EmailTemplateService` and `SequenceService` into the `ActionConfigComponent`, loading template/sequence lists on init, and replacing the `<input matInput>` elements with `<mat-select>` plus an inline search `<input>` inside `<mat-select-trigger>`. The stale reference handling spans three touchpoints: builder UI (open warning + save validation), execution engine (skip + log), and delete endpoints (usage warning).

**Primary recommendation:** Split into two plans --- one for the backend fixes (quick, zero risk) and one for the frontend picker + stale reference system (more involved, needs testing).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Action Config Pickers (Workflow Builder)
- Replace free-text UUID inputs for "Send Email" and "Enroll in Sequence" actions with `mat-select` dropdowns
- Template picker shows name + subject line preview per option
- Sequence picker shows name + step count or summary
- Both pickers include a search input at the top for filtering as the list grows
- Template picker shows all templates but visually highlights ones matching the workflow's trigger entity type (not filtered --- user can still pick any template)
- Sequence picker: Claude's discretion on whether to show status badge or filter to active-only

#### Stale Reference Handling
- **At execution time:** If a workflow references a deleted template or sequence, skip that action and log a warning in the execution log --- do not fail the entire workflow run
- **In builder (on open):** Show an amber banner warning if any referenced template/sequence no longer exists
- **In builder (on save):** Validate references --- block save with a clear error pointing to the broken action node
- **In picker display:** Claude's discretion on whether to show stale reference as "(Deleted)" greyed-out option or clear to empty
- **On template/sequence deletion:** Show a "Used by N workflows" warning with workflow names before confirming deletion

#### Backend Fixes (Claude's Discretion)
- ReportCsvExportJob: Add explicit DI registration in ReportingServiceExtensions
- Duplicate DI cleanup: Remove redundant AddDomainEventServices() and AddEmailTemplateServices() calls from Program.cs (already called via AddInfrastructure)
- DuplicatesController: Fix field naming --- use Website for companies, Email for contacts

### Claude's Discretion
- Sequence picker: whether to show status badge or filter to active-only
- Picker display of stale references: "(Deleted)" greyed-out option or clear to empty
- Backend fix implementation details

### Deferred Ideas (OUT OF SCOPE)
None --- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| RPT-06 | User can export report results to CSV (integration hardening) | INT-01: `ReportCsvExportJob` missing from DI in `ReportingServiceExtensions.cs`. Single-line fix: `services.AddScoped<ReportCsvExportJob>()`. All 5 dependencies already registered. |
| WFLOW-07 | User can add "send email" action using an email template with merge fields (UX improvement) | INT-02: `action-config.component.ts` lines 255-273 use free-text `<input matInput>` for `emailTemplateId`. Replace with `<mat-select>` populated from `EmailTemplateService.getTemplates()`. Model already has `name` + `subject` fields for display. |
| WFLOW-09 | User can add "enroll in sequence" action to start email sequences (UX improvement) | INT-02: `action-config.component.ts` lines 308-323 use free-text `<input matInput>` for `sequenceId`. Replace with `<mat-select>` populated from `SequenceService.getSequences()`. Model already has `name` + `stepCount` + `status` fields. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @angular/material | ^19.2.19 | mat-select, mat-form-field, mat-option, mat-icon | Already installed and used throughout the codebase |
| Angular Signals | 19.x | signal(), computed(), effect() for reactive state | Codebase standard for all components |
| FormsModule | 19.x | ngModel template-driven binding | Already used in action-config.component.ts |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| EmailTemplateService | existing | API calls to /api/email-templates | Inject into ActionConfigComponent for template list |
| SequenceService | existing | API calls to /api/sequences | Inject into ActionConfigComponent for sequence list |
| WorkflowService | existing | API calls to /api/workflows | Already injected in WorkflowBuilderComponent |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| mat-select + inline search | mat-autocomplete | mat-autocomplete is better for large datasets with server-side search; mat-select is better for bounded lists (templates/sequences are typically 10-50 items). Decision locked: use mat-select. |
| ngx-mat-select-search | Custom inline search | Third-party package not in project; custom inline search using mat-option with matInput is simpler and consistent with existing patterns |

## Architecture Patterns

### Current Action Config Structure
```
globcrm-web/src/app/features/workflows/
  workflow-builder/
    workflow-builder.component.ts     # Parent - owns nodes[], entityType, entityFields
    workflow-builder.component.html   # Passes [node], [entityType], [entityFields] to config panels
    panels/
      action-config.component.ts      # TARGET FILE - owns form state, emits configChanged
      trigger-config.component.ts
      condition-config.component.ts
      template-gallery.component.ts
```

### Pattern 1: Searchable Mat-Select with Inline Filter
**What:** A `mat-select` dropdown with an `<input>` element inside for filtering options, using signals for reactive filtering.
**When to use:** When the option list is bounded (10-100 items) and loaded client-side.
**Example:**
```typescript
// In action-config.component.ts
readonly templateSearch = signal('');
readonly templates = signal<EmailTemplateListItem[]>([]);
readonly filteredTemplates = computed(() => {
  const search = this.templateSearch().toLowerCase();
  if (!search) return this.templates();
  return this.templates().filter(t =>
    t.name.toLowerCase().includes(search) ||
    (t.subject?.toLowerCase().includes(search) ?? false)
  );
});
```

```html
<!-- Template picker with search -->
<mat-form-field appearance="outline" class="full-width">
  <mat-label>Email Template</mat-label>
  <mat-select [ngModel]="form().emailTemplateId"
              (ngModelChange)="updateFormField('emailTemplateId', $event)">
    <!-- Inline search -->
    <div class="select-search">
      <input matInput placeholder="Search templates..."
             (input)="templateSearch.set($event.target.value)"
             (keydown)="$event.stopPropagation()" />
    </div>
    @for (t of filteredTemplates(); track t.id) {
      <mat-option [value]="t.id" [class.entity-match]="isEntityTypeMatch(t)">
        <span class="option-name">{{ t.name }}</span>
        <span class="option-preview">{{ t.subject }}</span>
      </mat-option>
    }
  </mat-select>
</mat-form-field>
```

### Pattern 2: Stale Reference Detection on Builder Open
**What:** When loading a workflow, check if referenced templates/sequences still exist by comparing action config IDs against the loaded lists.
**When to use:** In the workflow builder `loadWorkflow()` after loading the workflow definition and template/sequence lists.
**Example:**
```typescript
// After loading workflow definition + templates + sequences:
const staleRefs: string[] = [];
for (const node of workflow.definition.nodes) {
  if (node.config?.actionType === 'sendEmail' && node.config?.emailTemplateId) {
    if (!templates.find(t => t.id === node.config.emailTemplateId)) {
      staleRefs.push(`Send Email action "${node.label}" references a deleted template`);
    }
  }
  // Similar for enrollInSequence...
}
if (staleRefs.length > 0) {
  this.staleWarnings.set(staleRefs);
}
```

### Pattern 3: Backend "Used By" Query for Deletion Warning
**What:** Before deleting a template or sequence, query workflows whose JSONB definition contains the ID.
**When to use:** In the delete endpoints of EmailTemplatesController and SequencesController.
**Example:**
```csharp
// New endpoint: GET /api/email-templates/{id}/usage
var workflows = await _db.Workflows
    .Where(w => EF.Functions.JsonContains(
        w.Definition,
        $"{{\"actions\":[{{\"config\":\"{{\\\"emailTemplateId\\\":\\\"{id}\\\"}}\"}}]}}"
    ))
    .ToListAsync();

// Simpler approach using raw SQL or string search on the JSONB column:
var workflows = await _db.Workflows
    .Where(w => w.Definition.Actions.Any(a =>
        a.Config.Contains(id.ToString())))
    .ToListAsync();
```

### Anti-Patterns to Avoid
- **Loading all templates/sequences on every keystroke:** Load the full list once on component init, filter client-side with signals. These are bounded lists.
- **Storing template/sequence names in workflow config:** Only store the ID. Names should be resolved at display time from the loaded lists.
- **Failing the entire workflow on stale references:** Per locked decision, skip the action and log a warning. This is already the pattern in `SendEmailAction.cs` (line 58-63) and `EnrollInSequenceAction.cs` (line 71-78).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Search-in-select filtering | Custom dropdown component | mat-select + inline input + signal-based filter | Angular Material handles a11y, keyboard nav, overlay positioning |
| Template/sequence API calls | New HTTP calls | Existing `EmailTemplateService.getTemplates()` and `SequenceService.getSequences()` | Already tested, handles auth, error handling |
| JSONB workflow content search | Complex EF LINQ | PostgreSQL `CAST(definition AS text) LIKE '%{id}%'` or iterate Actions list | JSONB nested search is fragile; simple string containment on serialized JSON is reliable enough for this use case |

**Key insight:** The backend actions (`SendEmailAction`, `EnrollInSequenceAction`) already handle missing template/sequence gracefully --- they log a warning and return without failing. The execution-time stale reference handling is already implemented. The remaining work is UI-level only.

## Common Pitfalls

### Pitfall 1: Mat-Select Search Input Stealing Focus
**What goes wrong:** Typing in the search input triggers mat-select keyboard navigation (e.g., typing "a" selects the first option starting with "a").
**Why it happens:** mat-select interprets keydown events as option navigation.
**How to avoid:** Add `(keydown)="$event.stopPropagation()"` on the search input to prevent mat-select from intercepting keystrokes. Also add `(keydown.space)="$event.stopPropagation()"` specifically for space key.
**Warning signs:** Selecting wrong options when typing in search field.

### Pitfall 2: Duplicate DI Registration for Singletons
**What goes wrong:** `AddEmailTemplateServices()` called twice (DependencyInjection.cs + Program.cs) registers `TemplateRenderService` as singleton twice. The second registration wins in DI, but the first singleton instance is still allocated.
**Why it happens:** Historical layering --- both Program.cs and the AddInfrastructure pipeline register the same extension methods.
**How to avoid:** Remove the calls from Program.cs (lines 91 and 94). The calls in `DependencyInjection.cs` via `AddInfrastructure()` are canonical.
**Warning signs:** Two singleton instances of the same service consuming memory.

### Pitfall 3: DuplicateMatch Record Field Overloading
**What goes wrong:** `DuplicateMatch` record uses the `Email` field for company Website data. Controller comment says `// DuplicateMatch.Email stores website for companies` but API consumers see `Email` property name.
**Why it happens:** The `DuplicateMatch` record was designed for contacts first. Companies reuse it but store Website in the Email parameter.
**How to avoid:** Two approaches: (a) rename `Email` to `SecondaryField` in the DuplicateMatch record (broader change), or (b) just fix the controller DTO mapping to use correct field names --- the controller already maps to typed DTOs (`CompanyDuplicateMatchDto` which has separate `Website` and `Email` fields). The mapping at lines 130 and 234-235 assigns `Website = m.Email` which is semantically correct but the source field name is misleading.
**Warning signs:** Code comments explaining field overloading.

### Pitfall 4: JSONB String Search False Positives
**What goes wrong:** Searching for a template/sequence UUID in the workflow definition JSON might match UUIDs in unrelated fields.
**Why it happens:** UUID strings could theoretically appear in node IDs or other config values.
**How to avoid:** Search specifically in the `actions` array configs. The WorkflowActionConfig stores action-specific config as a JSON string field. For SendEmail actions, the config string will contain `"emailTemplateId":"<uuid>"`. For EnrollInSequence, it will contain `"sequenceId":"<uuid>"`. Search for the full key-value pattern, not just the UUID alone.
**Warning signs:** False positive "used by" counts in deletion warnings.

## Code Examples

### INT-01: ReportCsvExportJob DI Registration Fix

**File:** `src/GlobCRM.Infrastructure/Reporting/ReportingServiceExtensions.cs`

```csharp
// CURRENT (missing ReportCsvExportJob):
public static IServiceCollection AddReportingServices(this IServiceCollection services)
{
    services.AddScoped<ReportFieldMetadataService>();
    services.AddScoped<ReportQueryEngine>();
    return services;
}

// FIX (add one line):
public static IServiceCollection AddReportingServices(this IServiceCollection services)
{
    services.AddScoped<ReportFieldMetadataService>();
    services.AddScoped<ReportQueryEngine>();
    services.AddScoped<ReportCsvExportJob>();
    return services;
}
```

All 5 constructor dependencies of `ReportCsvExportJob` are already registered:
- `ApplicationDbContext` --- registered in DependencyInjection.cs
- `ReportQueryEngine` --- registered in same file
- `IFileStorageService` --- registered via AddImageServices
- `IHubContext<CrmHub>` --- registered via AddSignalR
- `ILogger<ReportCsvExportJob>` --- provided by logging framework

### INT-03: Duplicate DI Registration Cleanup

**File:** `src/GlobCRM.Api/Program.cs` (lines 90-94)

```csharp
// CURRENT (duplicate calls):
// Domain event infrastructure (interceptor + dispatcher)
builder.Services.AddDomainEventServices();    // line 91 -- DUPLICATE

// Email template services (repository, render, merge fields)
builder.Services.AddEmailTemplateServices();  // line 94 -- DUPLICATE

// FIX: Remove both lines. Both are already called from
// DependencyInjection.cs lines 60 and 184 respectively
// via builder.Services.AddInfrastructure() at Program.cs line 58.
```

Verify callchain:
- Program.cs line 58: `builder.Services.AddInfrastructure(...)` calls DependencyInjection.cs
- DependencyInjection.cs line 60: `services.AddDomainEventServices()`
- DependencyInjection.cs line 184: `services.AddEmailTemplateServices()`

### TD-01: DuplicatesController Field Naming Fix

**File:** `src/GlobCRM.Api/Controllers/DuplicatesController.cs`

The issue is at two locations where `DuplicateMatch.Email` (which stores Website for companies) is mapped to `CompanyDuplicateMatchDto.Website`:

```csharp
// Line 130 (CheckCompanyDuplicates):
Website = m.Email, // DuplicateMatch.Email stores website for companies

// Line 234-235 (ScanCompanyDuplicates / EnrichCompany):
Website = m.Email, // DuplicateMatch.Email stores website for companies
```

**Root cause:** `DuplicateMatch` record (`IDuplicateDetectionService.cs` line 43) uses `Email` parameter for both contact email AND company website:
```csharp
public record DuplicateMatch(
    Guid EntityId,
    string FullName,
    string? Email,    // For contacts: email. For companies: website.
    int Score,
    DateTimeOffset UpdatedAt);
```

**Fix options:**
1. **Minimal (DTO-level only):** The mapping is already correct --- `CompanyDuplicateMatchDto.Website` gets the right data. The comments document the overloading. No API contract change needed. Just document it.
2. **Proper (refactor DuplicateMatch):** Add a `SecondaryField` or rename `Email` to something generic, or create separate `ContactDuplicateMatch` and `CompanyDuplicateMatch` records. This changes the interface and all callers.
3. **Middle ground (recommended):** The comment is the only "misleading" thing. The DTO names are already correct for the API consumer. Clean up the field by adding an explicit `Website` parameter to the DuplicateMatch or by using a separate company-specific match record.

**Recommendation:** Add a `Website` property to the `DuplicateMatch` record (or split into entity-specific records) so the mapping code reads `Website = m.Website` instead of `Website = m.Email`. This is a refactor of the domain interface + detection service + controller mapping.

### INT-02: Action Config Picker Implementation

**File:** `globcrm-web/src/app/features/workflows/workflow-builder/panels/action-config.component.ts`

Current free-text inputs to replace:

```html
<!-- CURRENT Send Email (lines 255-262): -->
<mat-form-field appearance="outline" class="full-width">
  <mat-label>Email Template ID</mat-label>
  <input matInput
         [ngModel]="form().emailTemplateId"
         (ngModelChange)="updateFormField('emailTemplateId', $event)"
         placeholder="Enter template ID" />
</mat-form-field>

<!-- CURRENT Enroll in Sequence (lines 316-322): -->
<mat-form-field appearance="outline" class="full-width">
  <mat-label>Sequence ID</mat-label>
  <input matInput
         [ngModel]="form().sequenceId"
         (ngModelChange)="updateFormField('sequenceId', $event)"
         placeholder="Enter sequence ID" />
</mat-form-field>
```

**Services to inject:**
- `EmailTemplateService` (already `providedIn: 'root'`) --- call `getTemplates()` on init
- `SequenceService` (already `providedIn: 'root'`) --- call `getSequences()` on init

**Data models available for display:**
- `EmailTemplateListItem`: `{ id, name, subject, categoryName, ... }` --- use name + subject for display
- `SequenceListItem`: `{ id, name, status, stepCount, ... }` --- use name + stepCount for display

**Entity type matching for template highlighting:**
The workflow's `entityType` input (e.g., "Contact", "Company") can be compared to the email template's implicit entity scope. However, `EmailTemplateListItem` does not have an `entityType` field --- templates are entity-agnostic in the current model. The highlighting would need to be based on category or some heuristic. **Note:** The locked decision says "visually highlights ones matching the workflow's trigger entity type" but the template model has no entity type field. This means either: (a) we skip the highlighting since there's nothing to match on, or (b) we highlight based on merge field content analysis, or (c) we accept that all templates appear equal. **Recommendation:** Document this gap --- templates don't have an entity type property, so highlighting is not implementable without a model change. Skip it or add a `targetEntityType` field to the email template model.

### Stale Reference: Execution-Time Handling (Already Implemented)

**SendEmailAction.cs (lines 55-63):**
```csharp
var template = await _db.EmailTemplates
    .FirstOrDefaultAsync(t => t.Id == config.EmailTemplateId);

if (template is null)
{
    _logger.LogWarning(
        "SendEmail action: template {TemplateId} not found -- skipping",
        config.EmailTemplateId);
    return;  // Skip, don't throw
}
```

**EnrollInSequenceAction.cs (lines 71-78):**
```csharp
var sequence = await _sequenceRepository.GetByIdAsync(config.SequenceId);
if (sequence is null)
{
    _logger.LogWarning(
        "EnrollInSequence action: sequence {SequenceId} not found -- skipping",
        config.SequenceId);
    return;  // Skip, don't throw
}
```

Both already skip gracefully and log warnings. The execution-time stale reference handling is **already done**. No backend work needed for this part.

### Stale Reference: "Used By" Query for Deletion Warning

**New backend endpoint needed:** `GET /api/email-templates/{id}/usage` and `GET /api/sequences/{id}/usage`

The Workflow entity stores its definition as JSONB. The `WorkflowActionConfig.Config` field is a JSON string containing action-specific data. To find workflows using a specific template:

```csharp
// In the controller or a new service:
var templateIdStr = id.ToString();
var workflows = await _db.Workflows
    .Where(w => w.Definition.Actions.Any(a =>
        a.ActionType == WorkflowActionType.SendEmail
        && a.Config.Contains(templateIdStr)))
    .Select(w => new { w.Id, w.Name })
    .ToListAsync();
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `ngx-mat-select-search` package | Built-in mat-select + custom input + signal filtering | Angular Material 17+ | No third-party dependency needed; signals make reactive filtering trivial |
| Decorator-based inputs (`@Input()`) | Signal-based inputs (`input()`, `input.required()`) | Angular 17.1+ | Already adopted throughout codebase |

## Open Questions

1. **Template entity type matching for highlighting**
   - What we know: The locked decision says "visually highlights ones matching the workflow's trigger entity type"
   - What's unclear: `EmailTemplateListItem` has no `entityType` field. Templates are entity-agnostic in the current model.
   - Recommendation: Either skip highlighting (all templates appear equal) or add a note to the user that this needs a `targetEntityType` field on the email template model. A lightweight alternative is to match by category name if categories happen to align with entity types. Leave to planner to decide scope.

2. **Sequence picker: status badge vs active-only filter (Claude's discretion)**
   - Recommendation: Show all sequences with a status badge (chip showing "Active", "Draft", "Paused", "Archived"). Filtering to active-only would hide sequences the user might want to pick in advance of activation. The badge gives the user full context while keeping the list complete.

3. **Stale reference picker display (Claude's discretion)**
   - Recommendation: Clear to empty (null/empty string). Showing a "(Deleted)" greyed-out option requires tracking the deleted ID, which creates ghost state. Clearing to empty makes the broken reference obvious --- the field appears blank, prompting the user to pick a new template/sequence. Combined with the amber banner warning on builder open, the user gets clear feedback.

## Sources

### Primary (HIGH confidence)
- **Codebase analysis:** Direct reading of all affected files:
  - `src/GlobCRM.Infrastructure/Reporting/ReportingServiceExtensions.cs` (INT-01 target)
  - `src/GlobCRM.Infrastructure/Reporting/ReportCsvExportJob.cs` (dependency analysis)
  - `src/GlobCRM.Api/Program.cs` lines 58, 91, 94 (INT-03 targets)
  - `src/GlobCRM.Infrastructure/DependencyInjection.cs` lines 60, 184 (INT-03 canonical calls)
  - `src/GlobCRM.Infrastructure/DomainEvents/DomainEventServiceExtensions.cs` (INT-03 verification)
  - `src/GlobCRM.Infrastructure/EmailTemplates/EmailTemplateServiceExtensions.cs` (INT-03 verification)
  - `src/GlobCRM.Api/Controllers/DuplicatesController.cs` lines 130, 234-235 (TD-01 targets)
  - `src/GlobCRM.Domain/Interfaces/IDuplicateDetectionService.cs` lines 43-48 (DuplicateMatch record)
  - `src/GlobCRM.Infrastructure/Duplicates/DuplicateDetectionService.cs` lines 142-143 (company Email=Website)
  - `globcrm-web/src/app/features/workflows/workflow-builder/panels/action-config.component.ts` (INT-02 target)
  - `globcrm-web/src/app/features/workflows/workflow-builder/workflow-builder.component.ts` (parent component)
  - `globcrm-web/src/app/features/workflows/workflow-builder/workflow-builder.component.html` (parent template)
  - `globcrm-web/src/app/features/workflows/workflow.models.ts` (workflow types)
  - `globcrm-web/src/app/features/email-templates/email-template.models.ts` (template DTOs)
  - `globcrm-web/src/app/features/email-templates/email-template.service.ts` (template API)
  - `globcrm-web/src/app/features/sequences/sequence.models.ts` (sequence DTOs)
  - `globcrm-web/src/app/features/sequences/sequence.service.ts` (sequence API)
  - `src/GlobCRM.Infrastructure/Workflows/Actions/SendEmailAction.cs` (stale ref handling)
  - `src/GlobCRM.Infrastructure/Workflows/Actions/EnrollInSequenceAction.cs` (stale ref handling)
  - `src/GlobCRM.Infrastructure/Workflows/WorkflowActionExecutor.cs` (action dispatch)
  - `src/GlobCRM.Infrastructure/Workflows/WorkflowServiceExtensions.cs` (workflow DI)
  - `src/GlobCRM.Domain/Entities/Workflow.cs` (entity model + JSONB definition)
  - `src/GlobCRM.Domain/Interfaces/IWorkflowRepository.cs` (repository interface)

### Secondary (MEDIUM confidence)
- `.planning/v1.1-MILESTONE-AUDIT.md` --- gap definitions and severity ratings for INT-01, INT-02, INT-03, TD-01

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH --- all libraries already in use, no new dependencies needed
- Architecture: HIGH --- all affected files located, patterns well-understood from codebase analysis
- Pitfalls: HIGH --- pitfalls derived from direct code reading, not speculation
- Stale reference execution handling: HIGH --- already implemented in backend actions, verified by reading source

**Research date:** 2026-02-19
**Valid until:** 2026-03-19 (stable --- no moving targets, all fixes against current codebase)

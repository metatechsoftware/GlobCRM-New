# Phase 28: Localization String Extraction - Research

**Researched:** 2026-02-21
**Domain:** Angular i18n / Transloco string extraction and CI enforcement
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Claude produces all Turkish translations -- no user review step required
- Formal / business Turkish tone -- professional CRM vocabulary (e.g., "Kisi" for Contact, "Anlasma" for Deal, "Gorev" for Task)
- Common English loanwords stay in English: "Pipeline", "Dashboard", "Lead", "CRM", etc.
- One scope per feature -- each of the 18+ feature areas gets its own translation scope folder
- Shared component strings go in the global file (en.json / tr.json root)
- Common labels deduplicated to global under a `common` section
- Nested JSON structure matching Phase 27 patterns
- CI script validates: key parity, hardcoded string detection, unused key detection

### Claude's Discretion
- "siz" (formal) vs "sen" (informal) for user-facing text -- pick based on CRM industry conventions
- Where validation error messages live (global vs per-feature)
- Where snackbar/toast messages live (global vs per-feature)
- Grouping within feature scopes -- by page section (list/detail/form/dialog) vs by string type
- Key casing (camelCase vs kebab-case) -- follow Phase 27 precedent
- CI strictness level (hard fail vs warning)
- CI script location (npm script vs Angular builder)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| LOCL-03 | All UI strings render in selected language via translation pipe | Transloco pipe pattern established in Phase 27 navbar; this phase extends to all ~80+ templates and ~125 inline-template components. Scope-per-feature with lazy loading via provideTranslocoScope. |
| LOCL-09 | CI check validates EN and TR translation files have matching key sets | Node.js script approach: recursively walk all JSON files in assets/i18n/, deep-compare key trees, report mismatches. npm script in package.json. |
| LOCL-10 | All existing v1.0-v1.2 hardcoded strings extracted to translation files | ~415+ hardcoded strings across templates (HTML and inline TS), plus ~243 snackBar.open() calls with hardcoded messages in 59 TS files. |
</phase_requirements>

## Summary

This phase is a large-scale but mechanically repetitive extraction task: every hardcoded English string across all Angular component templates must be replaced with Transloco translation pipe references, with corresponding EN and TR JSON entries created for each feature scope. Phase 27 established all the infrastructure (Transloco config, TranslocoHttpLoader, LanguageService, scope loading via provideTranslocoScope, global translation files with `common`, `nav`, `auth`, `userMenu`, `validation`, `table`, `paginator` sections). Only the `contacts` and `settings` feature scopes are currently wired.

The codebase has 25 feature directories with route files, approximately 70 HTML template files and 125 inline-template TS components. There are roughly 243 `snackBar.open()` calls across 59 files with hardcoded English messages. The total string count is estimated at 800-1000+ unique strings when accounting for templates, snackbar messages, tooltips, aria-labels, placeholders, error messages, empty states, and form labels.

**Primary recommendation:** Organize work by feature scope (one plan per logical feature group), starting with shared/global components, then CRM entity features, then utility features. Each plan creates the scope JSON files (EN + TR), wires provideTranslocoScope in routes, adds TranslocoPipe to component imports, and replaces all hardcoded strings. CI enforcement script is a separate final plan.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @jsverse/transloco | ^8.2.1 | Translation pipe, scope loading, language switching | Already installed and configured in Phase 27 |
| @jsverse/transloco-locale | ^8.2.1 | Locale-aware formatting | Already installed, used for date/number formatting |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Node.js (built-in) | N/A | CI validation script | Key parity checking, unused key detection, hardcoded string scanning |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom Node.js CI script | transloco-keys-manager | transloco-keys-manager extracts keys from templates but doesn't handle the reverse validation (unused keys, key parity across languages) as flexibly. A custom script gives full control over the 3 validation rules required. |
| TranslocoPipe in templates | translate() in TS | Phase 27 established that OnPush components must use the pipe for proper reactivity. translate() doesn't trigger change detection. Only use selectTranslateObject() in services. |

**No new installations required.** Everything needed is already in the project.

## Architecture Patterns

### Recommended Project Structure
```
assets/i18n/
  en.json                    # Global (common, nav, auth, userMenu, validation, table, paginator + NEW shared sections)
  tr.json                    # Global Turkish
  contacts/en.json           # Already exists (Phase 27)
  contacts/tr.json           # Already exists (Phase 27)
  settings/en.json           # Already exists (Phase 27)
  settings/tr.json           # Already exists (Phase 27)
  deals/en.json              # NEW
  deals/tr.json              # NEW
  companies/en.json          # NEW
  companies/tr.json          # NEW
  leads/en.json              # NEW
  leads/tr.json              # NEW
  activities/en.json         # NEW
  activities/tr.json         # NEW
  products/en.json           # NEW
  products/tr.json           # NEW
  quotes/en.json             # NEW
  quotes/tr.json             # NEW
  requests/en.json           # NEW
  requests/tr.json           # NEW
  notes/en.json              # NEW
  notes/tr.json              # NEW
  emails/en.json             # NEW
  emails/tr.json             # NEW
  email-templates/en.json    # NEW
  email-templates/tr.json    # NEW
  sequences/en.json          # NEW
  sequences/tr.json          # NEW
  workflows/en.json          # NEW
  workflows/tr.json          # NEW
  dashboard/en.json          # NEW
  dashboard/tr.json          # NEW
  my-day/en.json             # NEW
  my-day/tr.json             # NEW
  calendar/en.json           # NEW
  calendar/tr.json           # NEW
  reports/en.json            # NEW
  reports/tr.json            # NEW
  auth/en.json               # NEW
  auth/tr.json               # NEW
  onboarding/en.json         # NEW
  onboarding/tr.json         # NEW
  profile/en.json            # NEW
  profile/tr.json            # NEW
  import/en.json             # NEW
  import/tr.json             # NEW
  duplicates/en.json         # NEW
  duplicates/tr.json         # NEW
  feed/en.json               # NEW
  feed/tr.json               # NEW
scripts/
  check-translations.js      # NEW CI validation script
```

### Pattern 1: Feature Scope Wiring (from Phase 27 contacts reference)

**What:** Each feature gets a Transloco scope via its route configuration.
**When to use:** Every feature route file that doesn't already have provideTranslocoScope.

```typescript
// feature.routes.ts
import { provideTranslocoScope } from '@jsverse/transloco';

export const FEATURE_ROUTES: Routes = [
  {
    path: '',
    providers: [provideTranslocoScope('feature-name')],
    children: [
      // ... child routes
    ],
  },
];
```

The scope name must match the directory name under `assets/i18n/`. Transloco's default TranslocoHttpLoader loads `assets/i18n/{scope}/{lang}.json` automatically -- no custom scope loader needed.

### Pattern 2: Template String Replacement (Transloco Pipe)

**What:** Replace hardcoded text with transloco pipe references.
**When to use:** All HTML templates and inline templates.

```html
<!-- BEFORE -->
<h1>Contacts</h1>
<button>New Contact</button>
<span class="field-label">First Name</span>

<!-- AFTER (global keys use dotted path) -->
<h1>{{ 'contacts.list.title' | transloco }}</h1>
<button>{{ 'contacts.list.addContact' | transloco }}</button>
<span class="field-label">{{ 'contacts.detail.fields.firstName' | transloco }}</span>
```

For scoped translations, the scope prefix is automatic within the scope's components:
```html
<!-- Inside a component under the 'deals' scope -->
<h1>{{ 'list.title' | transloco }}</h1>
<!-- Transloco resolves to deals.list.title -->
```

**Important:** Scoped keys accessed from outside the scope (e.g., shared components) must use the full path with scope prefix: `'deals.list.title'`.

### Pattern 3: Snackbar Messages in TypeScript

**What:** Replace hardcoded snackbar strings with translated values.
**When to use:** All 243 snackBar.open() calls across 59 files.

```typescript
// BEFORE
this.snackBar.open('Contact saved successfully', 'OK', { duration: 3000 });

// AFTER - inject TranslocoService, use translate() for one-shot messages
private readonly translocoService = inject(TranslocoService);

this.snackBar.open(
  this.translocoService.translate('contacts.form.saveSuccess'),
  this.translocoService.translate('common.ok'),
  { duration: 3000 }
);
```

Note: `translate()` (synchronous) is acceptable for snackbar messages because they are triggered by user actions, by which time translations are already loaded. The pipe is only required for template bindings that need reactivity.

### Pattern 4: Parameterized Translations

**What:** Strings with dynamic values use Transloco's interpolation.
**When to use:** Messages like "Linked {name}", "{count} contacts selected", "Column '{label}' added".

```json
// en.json
{
  "linked": "Linked {{name}}",
  "selectedCount": "{{count}} contact(s) selected"
}
```

```typescript
this.translocoService.translate('deals.detail.linked', { name: contact.fullName });
```

```html
{{ 'contacts.list.selectedCount' | transloco:{ count: selectedContacts().length } }}
```

### Pattern 5: mat-label and Placeholder Translations

**What:** Form field labels and placeholders need translation.
**When to use:** All mat-form-field elements.

```html
<!-- BEFORE -->
<mat-form-field>
  <mat-label>First Name</mat-label>
  <input matInput placeholder="Search companies...">
</mat-form-field>

<!-- AFTER -->
<mat-form-field>
  <mat-label>{{ 'contacts.form.fields.firstName' | transloco }}</mat-label>
  <input matInput [placeholder]="'contacts.form.searchCompanies' | transloco">
</mat-form-field>
```

### Pattern 6: Attribute Translations (aria-labels, matTooltip)

**What:** Accessibility attributes and tooltips need translation.
**When to use:** All aria-label, matTooltip, and title attributes with user-visible text.

```html
<!-- BEFORE -->
<button aria-label="Back to deals" matTooltip="View details">

<!-- AFTER -->
<button [attr.aria-label]="'deals.detail.backToDeals' | transloco"
        [matTooltip]="'common.table.viewDetails' | transloco">
```

### Anti-Patterns to Avoid

- **Using translate() in templates:** Breaks OnPush change detection. Always use the `| transloco` pipe in templates.
- **Duplicating common strings per scope:** "Save", "Cancel", "Delete", "Edit", etc. belong in the global `common` section, not repeated in each feature scope.
- **Translating user-generated content:** Entity names, descriptions, notes -- these stay as-entered. Only translate UI chrome.
- **Translating enum display values from backend:** Enum labels like "Open", "Closed", "Won" that come from the API as strings -- these should be mapped to translation keys on the frontend, not sent as translated from the backend.

## Discretion Recommendations

### "siz" (formal) vs "sen" (informal)
**Recommendation: Use "siz" (formal) consistently.**

Turkish B2B SaaS convention is "siz" for all user-facing text. CRM products in Turkey (Salesforce TR, HubSpot TR, local tools like Parashift, BulutCRM) universally use formal address. This aligns with professional context where users interact with colleagues and clients.

Confidence: HIGH (standard industry practice)

### Validation Error Messages: Global
**Recommendation: Keep validation messages in the global file under `common.validation`.**

The existing global file already has `common.validation.required`, `common.validation.email`, etc. Form validation errors are identical across all features ("This field is required", "Minimum length is {{min}} characters"). Adding feature-specific validation messages (e.g., "First name cannot exceed 100 characters") can go under the feature scope's `form.validation` section since those are specific to the entity.

Pattern:
- Generic validators (`required`, `email`, `minLength`, `maxLength`, `min`, `max`, `pattern`) -> global `common.validation`
- Entity-specific validation messages -> feature scope `form.validation`

### Snackbar/Toast Messages: Per-Feature
**Recommendation: Place snackbar messages in the feature scope under a `messages` section.**

Snackbar messages are highly feature-specific ("Contact saved successfully", "Failed to link product", "Deal deleted"). While the action button text ("OK", "Close", "Dismiss", "Retry") should be in global `common`, the message bodies belong to feature scopes. The only truly shared snackbar patterns are in shared components (entity-form-dialog, entity-attachments) -- those use parameterized global keys.

Pattern:
- Snackbar action buttons ("OK", "Close", "Dismiss") -> global `common`
- Success/error messages -> feature scope `messages` section
- Shared component messages (entity-attachments, entity-form-dialog) -> global `common.messages`

### Key Grouping: By Page Section
**Recommendation: Group within feature scopes by page section (list/detail/form/dialog/messages).**

This matches the Phase 27 contacts reference implementation which uses `list`, `detail`, `form` sections. Page-section grouping maps naturally to component boundaries (contact-list uses `list.*`, contact-detail uses `detail.*`, contact-form uses `form.*`). It's more maintainable because when editing a component, you know exactly which JSON section to look at.

Structure per feature scope:
```json
{
  "title": "Feature Name",
  "list": { "title": "...", "subtitle": "...", "addButton": "...", "empty": "..." },
  "detail": {
    "title": "...",
    "tabs": { "summary": "...", "timeline": "..." },
    "fields": { "name": "...", "email": "..." },
    "sections": { "info": "...", "dates": "..." }
  },
  "form": {
    "createTitle": "...",
    "editTitle": "...",
    "fields": { "firstName": "...", "lastName": "..." },
    "validation": { "nameRequired": "..." }
  },
  "dialog": { "deleteConfirm": "...", "linkSearch": "..." },
  "messages": { "saveSuccess": "...", "deleteFail": "..." },
  "kanban": { "title": "...", "moveSuccess": "..." }
}
```

### Key Casing: camelCase
**Recommendation: Use camelCase, following Phase 27 precedent.**

Phase 27 established camelCase keys throughout: `addContact`, `saveSuccess`, `deleteConfirm`, `emptyDescription`, `itemsPerPage`, `clearFilters`. Continue this convention for consistency.

### CI Strictness: Hard Fail for Key Parity, Warning for Others
**Recommendation:**
- **Key parity (EN/TR mismatch):** Hard fail. This is the most critical check -- a missing translation means users see broken keys.
- **Hardcoded string detection:** Hard fail. This directly validates LOCL-10 success criteria.
- **Unused key detection:** Warning only. Unused keys don't break functionality and may be false positives (keys used via dynamic construction). Log them but don't fail the build.

### CI Script Location: npm Script
**Recommendation: Node.js script at `scripts/check-translations.js`, invoked via npm script.**

This is the simplest approach -- no build tool integration needed. Add to package.json:
```json
{
  "scripts": {
    "check:i18n": "node scripts/check-translations.js"
  }
}
```

Can be run locally during development and in CI pipeline. No dependencies needed beyond Node.js built-ins (fs, path).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Translation pipe | Custom pipe wrapping translate() | TranslocoPipe from @jsverse/transloco | Handles scope resolution, reactivity, OnPush compat, interpolation |
| Scope loading | Manual HTTP loading per feature | provideTranslocoScope() in route providers | Automatic lazy loading that follows Transloco conventions |
| Language-aware formatting | Custom date/number pipes | @jsverse/transloco-locale pipes or Intl.DateTimeFormat | Already configured in Phase 27 |
| Key extraction tooling | Custom AST parser | Simple regex-based CI script | Full AST parsing is overkill; regex catches 99% of hardcoded strings in Angular templates |

**Key insight:** The extraction task is mechanical, not architectural. Phase 27 built all the infrastructure. This phase is purely about applying the established patterns to every component.

## Common Pitfalls

### Pitfall 1: Scope Key Collision
**What goes wrong:** Using the same key name in a scoped file and the global file, leading to ambiguous resolution.
**Why it happens:** Developer uses `'title'` thinking it resolves to the scoped `deals.title`, but Transloco resolves it from the global file if the scope isn't properly activated.
**How to avoid:** Always verify the component is within a route that has `provideTranslocoScope()`. When using scoped keys from shared components that aren't under a scope, use the fully qualified path (`'deals.title'`).
**Warning signs:** Translation shows a value from the wrong file or shows the key path as text.

### Pitfall 2: Inline Template Components Missing TranslocoPipe Import
**What goes wrong:** 125 components use inline `template: \`...\`` in their TS files. Forgetting to add `TranslocoPipe` to their `imports` array causes template compilation errors.
**Why it happens:** Easy to forget when the template is in the TS file rather than a separate HTML file.
**How to avoid:** For every component that gets transloco pipe usage, add `TranslocoPipe` to the component's `imports` array. Batch-check with grep after each plan.
**Warning signs:** Angular compilation errors about unknown pipe `transloco`.

### Pitfall 3: Breaking String Interpolation
**What goes wrong:** Replacing `{{ deal()!.title }}` with transloco when it's actually dynamic user data, not a UI string.
**Why it happens:** Mechanical search-and-replace without distinguishing UI chrome from data display.
**How to avoid:** Only extract strings that are static UI text (labels, buttons, messages, placeholders). Never translate dynamic data values (`deal.title`, `contact.fullName`, `activity.subject`).
**Warning signs:** Entity names showing as translation keys instead of actual values.

### Pitfall 4: Pluralization Edge Cases
**What goes wrong:** English plurals like "1 contact" vs "2 contacts" don't work with simple key replacement.
**Why it happens:** Angular templates often use ternary expressions like `{{ count !== 1 ? 's' : '' }}` for plurals.
**How to avoid:** Use parameterized translations with conditional wording. For simple cases: `"contactCount": "{{count}} contact(s)"` in EN and `"contactCount": "{{count}} kisi"` in TR (Turkish doesn't have the same plural suffix pattern). For the current codebase, the ternary plural pattern appears in about 5-6 places -- convert each to a parameterized translation.
**Warning signs:** Broken grammar in Turkish for count-based strings.

### Pitfall 5: Missing Snackbar Scope Context
**What goes wrong:** Snackbar messages use `translocoService.translate('messages.saveSuccess')` but the translation scope isn't loaded because the snackbar fires from a dialog or a service outside the scoped route.
**Why it happens:** Transloco scopes are route-based. If a shared component or dialog triggers a snackbar, the scope may not be available.
**How to avoid:** For shared components (entity-form-dialog, entity-attachments, slide-in-panel), use global keys. For feature-specific components, verify they're within the scoped route tree. The translate() function requires the scope to be loaded; use the full qualified key (`'deals.messages.saveSuccess'`) if uncertain.
**Warning signs:** Snackbar shows the key path as text instead of translated message.

### Pitfall 6: Angular Material Component Labels
**What goes wrong:** Some Angular Material components have labels set via `label` attribute (e.g., `<mat-tab label="Dashboard">`), which doesn't support pipe binding.
**Why it happens:** Attribute binding requires `[label]` syntax, not interpolation inside string attributes.
**How to avoid:** Convert from attribute string to property binding: `<mat-tab [label]="'dashboard.tabs.dashboard' | transloco">`. Or use `<ng-template mat-tab-label>` for complex labels.
**Warning signs:** Tabs, step labels showing raw key paths.

### Pitfall 7: Conditional/Dynamic String Construction
**What goes wrong:** Strings like `{{ isEditMode ? 'Edit Contact' : 'New Contact' }}` need two separate translation keys.
**Why it happens:** Template uses JS ternary to select between strings.
**How to avoid:** Replace with: `{{ (isEditMode ? 'contacts.form.editTitle' : 'contacts.form.createTitle') | transloco }}`. Both keys must exist in the JSON.
**Warning signs:** Ternary expressions where one branch is translated but not the other.

## Code Examples

### Example 1: Complete Feature Scope Wiring (deals)

```typescript
// deals.routes.ts
import { provideTranslocoScope } from '@jsverse/transloco';

export const DEAL_ROUTES: Routes = [
  {
    path: '',
    providers: [provideTranslocoScope('deals')],
    children: [
      { path: '', component: DealListComponent },
      // ... other routes
    ],
  },
];
```

```json
// assets/i18n/deals/en.json
{
  "title": "Deals",
  "list": {
    "title": "Deals",
    "subtitle": "Track opportunities, pipeline stages, and revenue forecasts",
    "addDeal": "New Deal",
    "allPipelines": "All Pipelines"
  },
  "detail": {
    "title": "Deal Details",
    "tabs": {
      "summary": "Summary",
      "details": "Details",
      "contacts": "Contacts",
      "products": "Products",
      "activities": "Activities",
      "quotes": "Quotes",
      "timeline": "Timeline",
      "notes": "Notes",
      "attachments": "Attachments"
    },
    "fields": {
      "description": "Description",
      "pipeline": "Pipeline",
      "stage": "Stage",
      "value": "Value",
      "probability": "Probability",
      "expectedCloseDate": "Expected Close Date",
      "actualCloseDate": "Actual Close Date",
      "owner": "Owner",
      "company": "Company",
      "created": "Created",
      "lastUpdated": "Last Updated"
    },
    "sections": {
      "dealInfo": "Deal Info",
      "datesAssignment": "Dates & Assignment",
      "customFields": "Custom Fields",
      "timeline": "Timeline"
    },
    "empty": {
      "noDescription": "No description",
      "notSpecified": "Not specified",
      "unassigned": "Unassigned"
    },
    "linkedContacts": {
      "count": "{{count}} contacts linked",
      "linkContact": "Link Contact",
      "searchPlaceholder": "Type to search contacts...",
      "noContacts": "No contacts linked to this deal.",
      "searchContacts": "Search contacts"
    },
    "linkedProducts": {
      "count": "{{count}} products linked",
      "linkProduct": "Link Product",
      "searchPlaceholder": "Type to search products...",
      "noProducts": "No products linked to this deal.",
      "searchProducts": "Search products",
      "quantity": "Quantity",
      "unitPriceOverride": "Unit Price Override",
      "useProductDefault": "Use product default",
      "product": "Product",
      "qty": "Qty",
      "unitPrice": "Unit Price",
      "subtotal": "Subtotal",
      "total": "Total"
    },
    "linkedActivities": {
      "noActivities": "No activities linked to this deal.",
      "createActivity": "Create Activity"
    },
    "linkedQuotes": {
      "noQuotes": "No quotes linked to this deal.",
      "viewAllQuotes": "View All Quotes"
    },
    "linkedNotes": {
      "noNotes": "No notes for this deal.",
      "addNote": "Add Note"
    },
    "notFound": "Deal not found",
    "backToDeals": "Back to Deals"
  },
  "form": {
    "createTitle": "New Deal",
    "editTitle": "Edit Deal"
  },
  "messages": {
    "linked": "Linked {{name}}",
    "unlinked": "Unlinked {{name}}",
    "linkFailed": "Failed to link {{type}}",
    "unlinkFailed": "Failed to unlink {{type}}",
    "deleteConfirm": "Are you sure you want to delete this deal?",
    "deleteSuccess": "Deal deleted successfully",
    "deleteFailed": "Failed to delete deal",
    "saveSuccess": "Deal saved successfully",
    "saveFailed": "Failed to save deal"
  }
}
```

### Example 2: Snackbar Translation Pattern

```typescript
// BEFORE (deal-detail.component.ts)
this.snackBar.open(`Linked ${contact.fullName}`, 'OK', { duration: 3000 });
this.snackBar.open('Failed to link contact', 'OK', { duration: 3000 });

// AFTER
private readonly translocoService = inject(TranslocoService);

this.snackBar.open(
  this.translocoService.translate('deals.messages.linked', { name: contact.fullName }),
  this.translocoService.translate('common.ok'),
  { duration: 3000 }
);
this.snackBar.open(
  this.translocoService.translate('deals.messages.linkFailed', { type: 'contact' }),
  this.translocoService.translate('common.ok'),
  { duration: 3000 }
);
```

### Example 3: Shared Component Global Keys

```html
<!-- shared/components/dynamic-table/dynamic-table.component.html -->
<!-- BEFORE -->
<span class="record-count-pill">{{ totalCount() }} records</span>
<span class="empty-state__text">No records found</span>
<span class="empty-state__loading">Loading data...</span>
<th>Actions</th>
<input placeholder="Quick search...">

<!-- AFTER -->
<span class="record-count-pill">{{ totalCount() }} {{ 'common.table.records' | transloco }}</span>
<span class="empty-state__text">{{ 'common.table.noData' | transloco }}</span>
<span class="empty-state__loading">{{ 'common.loading' | transloco }}</span>
<th>{{ 'common.actions' | transloco }}</th>
<input [placeholder]="'common.search' | transloco">
```

### Example 4: CI Validation Script Structure

```javascript
// scripts/check-translations.js
const fs = require('fs');
const path = require('path');

const I18N_DIR = path.join(__dirname, '../src/assets/i18n');

// 1. Key parity check: compare EN and TR key trees
function getKeys(obj, prefix = '') {
  return Object.entries(obj).flatMap(([key, value]) => {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    return typeof value === 'object' && value !== null
      ? getKeys(value, fullKey)
      : [fullKey];
  });
}

// 2. Hardcoded string detection: scan .html and inline templates
// 3. Unused key detection: cross-reference JSON keys with template usage
```

### Example 5: Adding Global Keys for Shared Components

```json
// Additions to assets/i18n/en.json (global)
{
  "common": {
    "ok": "OK",
    "dismiss": "Dismiss",
    "table": {
      "records": "records",
      "viewDetails": "View details",
      "editRow": "Edit",
      "deleteRow": "Delete"
    },
    "dialog": {
      "confirmDelete": "Confirm Delete",
      "deleteWarning": "Are you sure you want to delete the {{type}} \"{{name}}\"?",
      "cannotBeUndone": "This action cannot be undone."
    },
    "attachments": {
      "uploaded": "Uploaded {{name}}",
      "uploadFailed": "Failed to upload file",
      "downloadFailed": "Failed to download file",
      "deleted": "Attachment deleted",
      "deleteFailed": "Failed to delete attachment",
      "previewFailed": "Failed to load image preview"
    },
    "preview": {
      "openFullRecord": "Open full record",
      "closePreview": "Close preview (Esc)",
      "customFields": "Custom Fields"
    },
    "views": {
      "saveView": "Save View"
    },
    "filters": {
      "advancedFilters": "Advanced Filters",
      "noFilters": "No filters applied",
      "addFiltersHint": "Add filters to narrow down your results",
      "field": "Field",
      "operator": "Operator",
      "value": "Value",
      "addFilter": "Add Filter",
      "clearAll": "Clear All",
      "applyFilters": "Apply Filters"
    },
    "messages": {
      "createdSuccess": "{{type}} created successfully",
      "createdFailed": "Failed to create {{type}}"
    }
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| ngx-translate | @jsverse/transloco | 2023+ | Transloco is the modern Angular i18n library with scope support, SSR compat, better API. ngx-translate is maintenance-mode. |
| translate() in templates | transloco pipe | Phase 27 finding | OnPush components require pipe for reactivity. translate() doesn't trigger CD. |
| langChanges$ subscription | selectTranslateObject() | Phase 27 finding | Avoids race condition where lang change fires before HTTP fetch completes. |

**Already up-to-date:** The project uses Transloco v8.2.1 with the latest patterns. No migration needed.

## Scope Inventory

### Feature Scopes to Create (21 new scopes)

| Scope Name | Route File | HTML Templates | Inline Templates | Estimated Strings |
|------------|-----------|----------------|-----------------|-------------------|
| deals | deals.routes.ts | 5 (list, detail, form, kanban, calendar) | 0 | ~80 |
| companies | companies.routes.ts | 3 (list, detail, form) | 0 | ~50 |
| leads | leads.routes.ts | 5 (list, detail, form, kanban, convert-dialog) | 0 | ~70 |
| activities | activities.routes.ts | 4 (list, detail, kanban, calendar) | 1 (form) | ~60 |
| products | products.routes.ts | 3 (list, detail, form) | 0 | ~40 |
| quotes | quotes.routes.ts | 2 (list, detail) | 1 (form) | ~50 |
| requests | requests.routes.ts | 0 | 3 (list, detail, form) | ~40 |
| notes | notes.routes.ts | 0 | 3 (list, detail, form) | ~30 |
| emails | emails.routes.ts | 0 | 3 (list, detail, compose) | ~40 |
| email-templates | email-templates.routes.ts | 4 (list, editor, preview, merge-panel) | 1 (clone dialog) | ~45 |
| sequences | sequences.routes.ts | 3 (list, detail, builder) | 4 (enrollment, picker, step-item, template-picker, analytics) | ~50 |
| workflows | workflows.routes.ts | 3 (list, detail, builder) | ~12 (nodes, panels, toolbar, canvas, logs, card, save-dialog) | ~80 |
| dashboard | dashboard.routes.ts | 1 | ~12 (grid, widgets, selectors, dialogs, target-mgmt) | ~70 |
| my-day | my-day.routes.ts | 1 | 8 (all widgets) | ~45 |
| calendar | calendar.routes.ts | 1 | 0 | ~15 |
| reports | reports.routes.ts | 2 (builder, gallery) | ~7 (viewer components, panels, card) | ~50 |
| auth | auth.routes.ts | 8 (login, signup x3, forgot, reset, 2FA, verify) | 0 | ~60 |
| onboarding | onboarding.routes.ts | 4 (wizard + 3 steps) | 0 | ~30 |
| profile | profile.routes.ts | 3 (view, edit, team-directory) | 0 | ~35 |
| import | import.routes.ts | 0 | 6 (wizard, steps, history) | ~40 |
| duplicates | duplicates.routes.ts | 0 | 2 (scan, merge-comparison) | ~25 |
| feed | feed.routes.ts | 0 | 4 (list, post-form, emoji-picker, mention) | ~25 |

### Already Done (Phase 27)
- contacts (scope created, translations wired in route, JSON files exist)
- settings (scope created, translations wired in route, JSON files exist, BUT only covers settings-hub and language-settings -- sub-pages like roles, teams, custom-fields, pipelines, webhooks, email-accounts, notification-preferences, duplicate-rules still have hardcoded strings)

### Shared Components (global keys)
~35 inline-template components under `shared/` need TranslocoPipe import and global key references. Key shared components:
- dynamic-table (HTML template + quick-add-field inline)
- filter-panel (HTML template)
- filter-chips (HTML template)
- entity-preview-sidebar (HTML template)
- entity-attachments (inline template)
- entity-form-dialog (inline template)
- entity-summary-tab (HTML template)
- entity-timeline (inline template)
- related-entity-tabs (inline template)
- saved-views/view-sidebar (HTML template)
- confirm-delete-dialog (inline template)
- global-search (inline template)
- notification-center (inline template)
- slide-in-panel (inline template)
- quick-action-bar (inline template)
- column-picker (inline template)
- avatar components (inline templates)
- preview components (6 entity previews + supporting components)

## Open Questions

1. **Contacts scope: already done or needs extension?**
   - What we know: contacts has scope JSON files and route wiring from Phase 27, but the contact-list template still has hardcoded strings ("Contacts", "Manage people...", "New Contact", bulk action text). The scope JSON has the keys but they're not being referenced in templates yet.
   - Recommendation: Treat contacts as partially done -- the JSON files exist but templates need transloco pipe wiring. Include in the plan but as lighter work.

2. **Settings sub-pages scope coverage**
   - What we know: settings scope exists with hub and language translations. But roles, teams, custom-fields, pipelines, webhooks, email-accounts, notification-preferences, duplicate-rules are all inline-template components under settings/ with extensive hardcoded strings.
   - Recommendation: Extend the existing settings scope JSON to cover all sub-pages. No new scope needed -- they're all under the settings route tree.

3. **Notifications feature**
   - What we know: notification-center is under shared/components, not features/notifications. Has inline template.
   - Recommendation: notification-center strings go in global file since it's a shared component. The features/notifications directory may have a route file but the main component is shared.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: 70+ HTML template files, 125 inline-template components, 59 files with snackbar calls
- Phase 27 summaries and established patterns (plans 01-06)
- Existing translation files (assets/i18n/en.json, tr.json, contacts/*, settings/*)
- Transloco configuration in app.config.ts

### Secondary (MEDIUM confidence)
- @jsverse/transloco v8.2.1 patterns (pipe usage, scope loading, interpolation) -- verified against Phase 27 working implementation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - already installed and configured, no new dependencies
- Architecture: HIGH - Phase 27 established all patterns, this is mechanical application
- Pitfalls: HIGH - identified from direct codebase analysis of 243 snackbar calls, 125 inline templates, and OnPush reactivity issues already encountered in Phase 27
- Scope estimation: MEDIUM - string counts are estimates based on template sampling; actual count may vary +/- 15%

**Research date:** 2026-02-21
**Valid until:** Indefinite (no external dependencies or evolving APIs involved)

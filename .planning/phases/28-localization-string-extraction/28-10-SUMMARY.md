---
phase: 28-localization-string-extraction
plan: 10
subsystem: i18n
tags: [transloco, angular, i18n, aria-label, localization]

# Dependency graph
requires:
  - phase: 28-08
    provides: Feature-scope i18n JSON files for all 18 features
  - phase: 28-09
    provides: 95 hardcoded strings extracted across 12 feature scopes
provides:
  - 54+ remaining hardcoded strings extracted across 13 feature scopes
  - i18n baseline reduced from 347 to 2 false-positive entries
  - Full EN/TR key parity across all translation scopes
affects: [29-localization-testing, any future feature development]

# Tech tracking
tech-stack:
  added: []
  patterns: [transloco scope-key binding for aria-label/title/placeholder/alt attributes]

key-files:
  created: []
  modified:
    - globcrm-web/src/assets/i18n/activities/en.json
    - globcrm-web/src/assets/i18n/activities/tr.json
    - globcrm-web/src/assets/i18n/deals/en.json
    - globcrm-web/src/assets/i18n/deals/tr.json
    - globcrm-web/src/assets/i18n/quotes/en.json
    - globcrm-web/src/assets/i18n/quotes/tr.json
    - globcrm-web/src/assets/i18n/requests/en.json
    - globcrm-web/src/assets/i18n/requests/tr.json
    - globcrm-web/src/assets/i18n/contacts/en.json
    - globcrm-web/src/assets/i18n/contacts/tr.json
    - globcrm-web/src/assets/i18n/companies/en.json
    - globcrm-web/src/assets/i18n/companies/tr.json
    - globcrm-web/src/assets/i18n/leads/en.json
    - globcrm-web/src/assets/i18n/leads/tr.json
    - globcrm-web/src/assets/i18n/products/en.json
    - globcrm-web/src/assets/i18n/products/tr.json
    - globcrm-web/src/assets/i18n/duplicates/en.json
    - globcrm-web/src/assets/i18n/duplicates/tr.json
    - globcrm-web/src/assets/i18n/auth/en.json
    - globcrm-web/src/assets/i18n/auth/tr.json
    - globcrm-web/src/assets/i18n/email-templates/en.json
    - globcrm-web/src/assets/i18n/email-templates/tr.json
    - globcrm-web/src/assets/i18n/sequences/en.json
    - globcrm-web/src/assets/i18n/sequences/tr.json
    - globcrm-web/src/assets/i18n/workflows/en.json
    - globcrm-web/src/assets/i18n/workflows/tr.json
    - globcrm-web/scripts/i18n-baseline.json

key-decisions:
  - "Refactored workflow-canvas getTriggerBadge/getActionBadge to use existing nodes.* translation keys instead of hardcoded switch-case strings"
  - "Lead kanban '14 && lead.daysInStage' confirmed as false positive (CSS class conditional, not translatable)"
  - "Baseline down to 2 entries, both false positives (numeric threshold expressions)"

patterns-established:
  - "aria-label extraction: static aria-label='X' -> [attr.aria-label]=\"'scope.key' | transloco\""
  - "title attribute extraction: title='X' -> [title]=\"'scope.key' | transloco\""
  - "Programmatic badge text uses transloco.translate() with existing nodes.* keys"

requirements-completed: [LOCL-09]

# Metrics
duration: 25min
completed: 2026-02-21
---

# Phase 28 Plan 10: Remaining Feature Template String Extraction Summary

**Extracted 54+ hardcoded strings from 16 template files across 13 feature scopes, reducing the i18n baseline from 347 to 2 false-positive entries**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-02-21T16:00:00Z
- **Completed:** 2026-02-21T16:29:57Z
- **Tasks:** 5 (1a, 1b, 1c, 1d, 2)
- **Files modified:** 28

## Accomplishments
- Extracted all remaining hardcoded strings from activities, deals, quotes, requests, contacts, companies, leads, products, duplicates, auth, email-templates, sequences, and workflows features
- Full EN/TR key parity maintained across all 18+ translation scopes
- i18n baseline reduced from 347 known exceptions to just 2 false positives
- CI validation passes with 0 errors

## Task Commits

Each task was committed atomically:

1. **Task 1a: Activities + Deals + Quotes** - `29d3db5` (feat) - 23 strings across 6 files
2. **Task 1b: Requests + Contacts + Companies + Leads** - `dd3e2fb` (feat) - 9 strings across 8 files
3. **Task 1c: Products + Duplicates + Auth** - `7c3e117` (feat) - 8 strings across 6 files
4. **Task 1d: Email-templates + Sequences + Workflows** - `4ff319f` (feat) - 14+ strings across 6 files
5. **Task 2: Regenerate baseline + CI verification** - `9a13f8f` (chore) - baseline file

## Files Created/Modified

### Translation JSON files (26 files)
- `assets/i18n/activities/{en,tr}.json` - Added detail.linkedEntity.*, detail.aria.*, form.aria.* keys
- `assets/i18n/deals/{en,tr}.json` - Added detail.aria.*, form.aria.* keys
- `assets/i18n/quotes/{en,tr}.json` - Added detail.aria.*, form.aria.*, form.fields.descriptionPlaceholder keys
- `assets/i18n/requests/{en,tr}.json` - Added detail.aria.*, form.aria.* keys
- `assets/i18n/contacts/{en,tr}.json` - Added form.aria.clearCompany, form.aria.dismissWarning
- `assets/i18n/companies/{en,tr}.json` - Added form.aria.dismissWarning
- `assets/i18n/leads/{en,tr}.json` - Added detail.sidebar.timeline
- `assets/i18n/products/{en,tr}.json` - Added detail.aria.*, form.aria.* keys
- `assets/i18n/duplicates/{en,tr}.json` - Added merge.aria.* keys
- `assets/i18n/auth/{en,tr}.json` - Added twoFactor.qrCodeAlt, twoFactor.aria.goBack
- `assets/i18n/email-templates/{en,tr}.json` - Added preview.aria.devicePreviewMode, preview.searchPlaceholder
- `assets/i18n/sequences/{en,tr}.json` - Added builder.stepItem.templatePreviewTitle, templatePicker.templatePreviewTitle
- `assets/i18n/workflows/{en,tr}.json` - Added builder.branchYes/No, builder.zoomIn/Out/fitToView, builder.entityTypes.*

### Angular component templates (16 files)
- `activity-detail.component.html` - 10 aria-label + mat-option text extractions
- `activity-form.component.ts` - 1 aria-label extraction
- `deal-detail.component.html` - 4 aria-label extractions
- `deal-form.component.html` - 1 aria-label extraction
- `quote-detail.component.html` - 1 aria-label extraction
- `quote-form.component.ts` - 6 aria-label + placeholder extractions
- `request-detail.component.ts` - 1 aria-label extraction
- `request-form.component.ts` - 3 aria-label extractions
- `contact-form.component.html` - 2 aria-label extractions
- `company-form.component.html` - 1 aria-label extraction
- `lead-detail.component.html` - 1 text content extraction
- `product-detail.component.html` - 1 aria-label extraction
- `product-form.component.html` - 1 aria-label extraction
- `merge-comparison.component.ts` - 4 aria-label extractions
- `two-factor.component.html` - 1 aria-label + 1 alt attribute extraction
- `email-template-preview.component.html` - 1 aria-label + 1 placeholder extraction
- `step-item.component.ts` - 1 title attribute extraction
- `template-picker-dialog.component.ts` - 1 title attribute extraction
- `branch-node.component.ts` - 2 text content extractions (Yes/No)
- `workflow-canvas.component.ts` - 2 text + 3 title + 3 method refactors
- `workflow-toolbar.component.ts` - 5 entity type label extractions

### Baseline
- `scripts/i18n-baseline.json` - Reduced from 347 to 2 entries

## Decisions Made
- Refactored `workflow-canvas.component.ts` `getTriggerBadge()`, `getActionBadge()`, and `getWaitSummary()` to use existing `nodes.*` translation keys via `transloco.translate()` instead of hardcoded English switch-case returns - cleaner than duplicating strings
- Confirmed lead kanban `14 && lead.daysInStage` is a false positive (CSS class conditional expression, not translatable text)
- Confirmed settings duplicate-rules `= 70 && config.similarityThreshold` is a false positive (numeric threshold expression)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Extracted additional workflow badge strings via transloco.translate()**
- **Found during:** Task 1d (workflows)
- **Issue:** `getTriggerBadge()`, `getActionBadge()`, and `getWaitSummary()` in workflow-canvas.component.ts returned hardcoded English strings (e.g., "Record Created", "Update Field", "Wait 3 days") that were not listed in the plan
- **Fix:** Refactored methods to use existing `nodes.*` translation keys via `this.transloco.translate()` instead of hardcoded switch-case
- **Files modified:** workflow-canvas.component.ts
- **Verification:** Build passes, existing nodes.* keys matched
- **Committed in:** 4ff319f (Task 1d commit)

---

**Total deviations:** 1 auto-fixed (Rule 2 - missing critical functionality)
**Impact on plan:** Essential for complete i18n coverage of workflow badge text. No scope creep - used existing translation keys.

## Issues Encountered
None - all tasks executed cleanly with no build errors.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 28 localization string extraction is complete
- All 18+ feature scopes have EN/TR translation files with full key parity
- i18n baseline at 2 false-positive entries (effectively zero real hardcoded strings)
- CI validation script passes with 0 errors
- Ready for Phase 29 localization testing or any subsequent feature development

## Self-Check: PASSED

- All 5 commits verified: 29d3db5, dd3e2fb, 7c3e117, 4ff319f, 9a13f8f
- SUMMARY.md exists at expected path

---
*Phase: 28-localization-string-extraction*
*Completed: 2026-02-21*

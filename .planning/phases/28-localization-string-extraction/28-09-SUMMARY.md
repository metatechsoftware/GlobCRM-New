---
phase: 28-localization-string-extraction
plan: 09
subsystem: ui
tags: [transloco, i18n, angular, shared-components, entity-preview, summary-tab]

# Dependency graph
requires:
  - phase: 27-localization-foundation
    provides: "TranslocoPipe, global EN/TR JSON, LanguageService"
  - phase: 28-localization-string-extraction
    provides: "common.preview and common.summary keys from plan 01"
provides:
  - "common.summaryTab.fields.* keys (30 field labels) for entity-summary-tab"
  - "common.summaryTab.dealPipelineChart.* and emailEngagement.* keys (9 strings)"
  - "common.preview.fields.* keys (24 field labels) for entity-preview components"
  - "common.preview.related, recentActivities, noActivities, noNotes keys"
  - "common.quickAddField.*, avatar.*, customFieldForm.*, userPreview.* keys"
  - "common.filters.activeFiltersAria and nav.toggleMenu/userMenu/expandSidebar/collapseSidebar keys"
affects: [28-10-gap-closure]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "common.summaryTab.fields.* namespace for entity-summary-tab field labels"
    - "common.preview.fields.* namespace for entity-preview field labels"
    - "Dedicated namespace per shared component (quickAddField, avatar, customFieldForm, userPreview)"

key-files:
  created: []
  modified:
    - "globcrm-web/src/assets/i18n/en.json"
    - "globcrm-web/src/assets/i18n/tr.json"
    - "globcrm-web/src/app/shared/components/summary-tab/entity-summary-tab.component.html"
    - "globcrm-web/src/app/shared/components/summary-tab/deal-pipeline-chart.component.ts"
    - "globcrm-web/src/app/shared/components/summary-tab/email-engagement-card.component.ts"
    - "globcrm-web/src/app/shared/components/entity-preview/contact-preview.component.ts"
    - "globcrm-web/src/app/shared/components/entity-preview/deal-preview.component.ts"
    - "globcrm-web/src/app/shared/components/entity-preview/lead-preview.component.ts"
    - "globcrm-web/src/app/shared/components/entity-preview/company-preview.component.ts"
    - "globcrm-web/src/app/shared/components/entity-preview/activity-preview.component.ts"
    - "globcrm-web/src/app/shared/components/entity-preview/product-preview.component.ts"
    - "globcrm-web/src/app/shared/components/entity-preview/association-chips.component.ts"
    - "globcrm-web/src/app/shared/components/entity-preview/mini-timeline.component.ts"
    - "globcrm-web/src/app/shared/components/entity-preview/preview-activities-tab.component.ts"
    - "globcrm-web/src/app/shared/components/entity-preview/preview-notes-tab.component.ts"
    - "globcrm-web/src/app/shared/components/entity-preview-sidebar/entity-preview-sidebar.component.html"
    - "globcrm-web/src/app/shared/components/entity-preview-sidebar/preview-breadcrumbs.component.ts"
    - "globcrm-web/src/app/shared/components/dynamic-table/quick-add-field.component.ts"
    - "globcrm-web/src/app/shared/components/avatar/avatar-crop-dialog.component.ts"
    - "globcrm-web/src/app/shared/components/avatar/avatar-upload.component.ts"
    - "globcrm-web/src/app/shared/components/custom-field-form/custom-field-form.component.ts"
    - "globcrm-web/src/app/shared/components/filter-chips/filter-chips.component.html"
    - "globcrm-web/src/app/shared/components/navbar/navbar.component.html"
    - "globcrm-web/src/app/shared/components/user-preview/user-preview-popover.component.ts"

key-decisions:
  - "common.summaryTab.fields.* dedicated namespace for entity-summary-tab field labels (not reusing common.preview.fields.*)"
  - "common.preview.fields.* dedicated namespace for entity-preview field labels (separate from summaryTab)"
  - "Added SKU key to preview.fields even though not in original plan — required for product-preview completeness"
  - "Added nav.expandSidebar/collapseSidebar keys for sidebar aria-labels beyond plan scope — Rule 2 (accessibility)"

patterns-established:
  - "Entity field label namespaces: common.summaryTab.fields.* for detail page summary, common.preview.fields.* for sidebar preview"
  - "Shared component translation namespaces: common.{componentName}.* for component-specific keys"

requirements-completed: [LOCL-03, LOCL-10]

# Metrics
duration: 17min
completed: 2026-02-21
---

# Phase 28 Plan 09: Shared Entity-Preview and Summary-Tab i18n Summary

**Extracted ~95 hardcoded strings from shared entity-preview, summary-tab, quick-add-field, avatar, custom-field-form, navbar, filter-chips, and user-preview components into global EN/TR translation files**

## Performance

- **Duration:** 17 min
- **Started:** 2026-02-21T13:46:10Z
- **Completed:** 2026-02-21T14:04:01Z
- **Tasks:** 3
- **Files modified:** 24

## Accomplishments
- Translated all 30 entity-summary-tab field labels (Name, Email, Phone, Stage, etc.) across 6 entity types (Company, Contact, Deal, Lead, Quote, Request)
- Translated all entity-preview field labels across 6 preview components (contact, deal, lead, company, activity, product) plus supporting components (association-chips, mini-timeline, preview-activities-tab, preview-notes-tab)
- Translated misc shared component strings: quick-add-field dialog, avatar crop dialog, custom-field-form placeholders, user-preview popover, filter-chips aria-labels, navbar aria-labels
- Global EN/TR JSON extended with ~95 new keys maintaining full key parity

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire transloco in entity-summary-tab and summary-tab sub-components** - `5c6fa55` (feat)
2. **Task 2a: Wire transloco in entity-preview family components** - `ba273b0` (feat)
3. **Task 2b: Wire transloco in misc shared components + preview sidebar** - `c0747c0` (feat)

## Files Created/Modified
- `globcrm-web/src/assets/i18n/en.json` - Extended with common.summaryTab.*, common.preview.fields.*, common.quickAddField.*, common.avatar.*, common.customFieldForm.*, common.userPreview.*, common.filters.activeFiltersAria, nav.toggleMenu/userMenu/expandSidebar/collapseSidebar
- `globcrm-web/src/assets/i18n/tr.json` - Matching Turkish translations for all new keys
- `globcrm-web/src/app/shared/components/summary-tab/entity-summary-tab.component.html` - 30 field labels translated via common.summaryTab.fields.* + 2 Status card titles
- `globcrm-web/src/app/shared/components/summary-tab/deal-pipeline-chart.component.ts` - 3 strings (noDeals, totalValue, winRate) + TranslocoPipe import
- `globcrm-web/src/app/shared/components/summary-tab/email-engagement-card.component.ts` - 6 strings (sent, received, total, lastSent, lastReceived, noActivity) + TranslocoPipe import
- `globcrm-web/src/app/shared/components/entity-preview/contact-preview.component.ts` - 5 field labels (Email, Phone, Job Title, Company, City) + TranslocoPipe import
- `globcrm-web/src/app/shared/components/entity-preview/deal-preview.component.ts` - 7 field labels (Pipeline, Stage, Value, Probability, Expected Close, Company) + TranslocoPipe import
- `globcrm-web/src/app/shared/components/entity-preview/lead-preview.component.ts` - 6 field labels (Stage, Email, Phone, Company, Temperature, Source) + TranslocoPipe import
- `globcrm-web/src/app/shared/components/entity-preview/company-preview.component.ts` - 6 field labels (Industry, Phone, Website, Size, City, Country) + TranslocoPipe import
- `globcrm-web/src/app/shared/components/entity-preview/activity-preview.component.ts` - 4 field labels (Type, Status, Priority, Due Date) + TranslocoPipe import
- `globcrm-web/src/app/shared/components/entity-preview/product-preview.component.ts` - 4 field labels (Unit Price, SKU, Category, Description) + TranslocoPipe import
- `globcrm-web/src/app/shared/components/entity-preview/association-chips.component.ts` - 1 string (Related) + TranslocoPipe import
- `globcrm-web/src/app/shared/components/entity-preview/mini-timeline.component.ts` - 2 strings (Recent Activities, View all activities) + TranslocoPipe import
- `globcrm-web/src/app/shared/components/entity-preview/preview-activities-tab.component.ts` - 1 string (No activities yet) + TranslocoPipe import
- `globcrm-web/src/app/shared/components/entity-preview/preview-notes-tab.component.ts` - 1 string (No notes yet) + TranslocoPipe import
- `globcrm-web/src/app/shared/components/entity-preview-sidebar/entity-preview-sidebar.component.html` - 1 owner alt attribute translated
- `globcrm-web/src/app/shared/components/entity-preview-sidebar/preview-breadcrumbs.component.ts` - 1 aria-label translated + TranslocoPipe import
- `globcrm-web/src/app/shared/components/dynamic-table/quick-add-field.component.ts` - 5 strings (title, fieldLabel, fieldType, configureHint, addButton) + TranslocoPipe import
- `globcrm-web/src/app/shared/components/avatar/avatar-crop-dialog.component.ts` - 3 strings (cropTitle, cancel, loadError) + TranslocoPipe import
- `globcrm-web/src/app/shared/components/avatar/avatar-upload.component.ts` - 1 string (changePhoto) + TranslocoPipe import
- `globcrm-web/src/app/shared/components/custom-field-form/custom-field-form.component.ts` - 2 strings (fileUploadSoon, relatedEntityPlaceholder) + TranslocoPipe import
- `globcrm-web/src/app/shared/components/filter-chips/filter-chips.component.html` - 1 aria-label translated
- `globcrm-web/src/app/shared/components/navbar/navbar.component.html` - 4 aria-labels translated (toggleMenu, userMenu x2, expandSidebar/collapseSidebar)
- `globcrm-web/src/app/shared/components/user-preview/user-preview-popover.component.ts` - 4 strings (couldNotLoad, deals, tasksToday, lastActive) + TranslocoPipe import

## Decisions Made
- Used `common.summaryTab.fields.*` as a dedicated namespace for entity-summary-tab field labels, separate from `common.preview.fields.*` for entity-preview labels, to avoid coupling between these two rendering contexts
- Added `common.preview.fields.sku` key not in original plan but required for product-preview component completeness
- Added `nav.expandSidebar` and `nav.collapseSidebar` keys for sidebar collapse button aria-labels (Rule 2 - accessibility)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added sidebar expand/collapse aria-label translations**
- **Found during:** Task 2b (navbar component)
- **Issue:** Sidebar collapse button had hardcoded aria-labels "Expand sidebar"/"Collapse sidebar" — accessibility strings should also be translated
- **Fix:** Added nav.expandSidebar and nav.collapseSidebar keys to EN/TR JSON and wired transloco pipe
- **Files modified:** en.json, tr.json, navbar.component.html
- **Verification:** Build compiles successfully
- **Committed in:** c0747c0

**2. [Rule 1 - Bug] Fixed unclosed button tag in navbar after aria-label translation**
- **Found during:** Task 2b verification build
- **Issue:** Replacing static aria-label with [attr.aria-label] binding accidentally dropped the closing `>` of the button tag
- **Fix:** Added missing `>` to close the button opening tag
- **Files modified:** navbar.component.html
- **Verification:** Build compiles successfully
- **Committed in:** c0747c0

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 bug)
**Impact on plan:** Both fixes necessary for correctness. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All shared component field labels now translated, enabling Turkish language rendering across entity-preview sidebars and summary tabs on every page
- Plan 28-10 can proceed to close remaining gaps in other areas
- Global EN/TR JSON key parity maintained

---
## Self-Check: PASSED

- FOUND: 28-09-SUMMARY.md
- FOUND: 5c6fa55 (Task 1 commit)
- FOUND: ba273b0 (Task 2a commit)
- FOUND: c0747c0 (Task 2b commit)

---
*Phase: 28-localization-string-extraction*
*Completed: 2026-02-21*

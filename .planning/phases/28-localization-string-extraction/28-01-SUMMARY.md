---
phase: 28-localization-string-extraction
plan: 01
subsystem: ui
tags: [transloco, i18n, angular, translations, shared-components]

# Dependency graph
requires:
  - phase: 27-localization-foundation
    provides: "Transloco infrastructure, TranslocoPipe, LanguageService, global en.json/tr.json with initial keys"
provides:
  - "Extended global EN/TR JSON files with 235 leaf translation keys covering all shared components"
  - "17+ shared components wired with TranslocoPipe and transloco pipe references replacing hardcoded English strings"
  - "All snackBar.open() calls in shared components use TranslocoService.translate() for messages and action buttons"
affects: [28-02-PLAN, 28-03-PLAN, 28-04-PLAN, 28-05-PLAN, 28-06-PLAN, 28-07-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Global keys prefixed with common.* for shared components used across all features"
    - "Nested JSON key structure: common.table.*, common.filters.*, common.dialog.*, etc."
    - "snackBar.open() uses translocoService.translate() for messages and action text"
    - "Parameterized translations with Transloco {{param}} syntax for dynamic values"

key-files:
  created: []
  modified:
    - "globcrm-web/src/assets/i18n/en.json"
    - "globcrm-web/src/assets/i18n/tr.json"
    - "globcrm-web/src/app/shared/components/dynamic-table/dynamic-table.component.html"
    - "globcrm-web/src/app/shared/components/dynamic-table/dynamic-table.component.ts"
    - "globcrm-web/src/app/shared/components/dynamic-table/column-picker.component.ts"
    - "globcrm-web/src/app/shared/components/filter-panel/filter-panel.component.html"
    - "globcrm-web/src/app/shared/components/filter-panel/filter-panel.component.ts"
    - "globcrm-web/src/app/shared/components/filter-chips/filter-chips.component.html"
    - "globcrm-web/src/app/shared/components/filter-chips/filter-chips.component.ts"
    - "globcrm-web/src/app/shared/components/entity-preview-sidebar/entity-preview-sidebar.component.html"
    - "globcrm-web/src/app/shared/components/entity-preview-sidebar/entity-preview-sidebar.component.ts"
    - "globcrm-web/src/app/shared/components/entity-attachments/entity-attachments.component.ts"
    - "globcrm-web/src/app/shared/components/entity-form-dialog/entity-form-dialog.component.ts"
    - "globcrm-web/src/app/shared/components/summary-tab/entity-summary-tab.component.html"
    - "globcrm-web/src/app/shared/components/summary-tab/entity-summary-tab.component.ts"
    - "globcrm-web/src/app/shared/components/entity-timeline/entity-timeline.component.ts"
    - "globcrm-web/src/app/shared/components/related-entity-tabs/related-entity-tabs.component.ts"
    - "globcrm-web/src/app/shared/components/saved-views/view-sidebar.component.html"
    - "globcrm-web/src/app/shared/components/saved-views/view-sidebar.component.ts"
    - "globcrm-web/src/app/shared/components/confirm-delete-dialog/confirm-delete-dialog.component.ts"
    - "globcrm-web/src/app/shared/components/global-search/global-search.component.ts"
    - "globcrm-web/src/app/features/notifications/notification-center/notification-center.component.ts"
    - "globcrm-web/src/app/shared/services/slide-in-panel/slide-in-panel.component.ts"
    - "globcrm-web/src/app/shared/components/quick-action-bar/quick-action-bar.component.ts"

key-decisions:
  - "Entity-specific property labels (Name, Email, Phone in summary tab) deferred to feature-scoped plans since they belong to feature scopes not global"
  - "RichTextEditor placeholder kept as input default -- TranslocoPipe not needed in its template since placeholder is passed from parent"
  - "Filter operator labels in filter-panel.component.ts remain hardcoded for now since they are computed in TS, not template strings -- will be addressed in a future plan or left as-is since operators are technical terms"
  - "Summary tab section titles translated but entity-specific property labels left for feature-scoped plans"

patterns-established:
  - "common.table.* for DynamicTable labels, tooltips, empty states, page range summary"
  - "common.filters.* for FilterPanel/FilterChips labels and buttons"
  - "common.dialog.* for ConfirmDeleteDialog and EntityFormDialog"
  - "common.attachments.* for EntityAttachments labels and snackbar messages"
  - "common.preview.* for EntityPreviewSidebar labels"
  - "common.views.* for ViewSidebar labels"
  - "common.timeline.* for EntityTimeline empty state"
  - "common.notifications.* for NotificationCenter labels"
  - "common.search.* for GlobalSearch placeholder and states"
  - "common.messages.* for parameterized success/error snackbar messages"
  - "common.quickActions.* for QuickActionBar button labels"
  - "common.summary.* for EntitySummaryTab section headers"
  - "common.slideInPanel.* for SlideInPanel labels"
  - "common.tabs.* for RelatedEntityTabs coming soon labels"

requirements-completed: [LOCL-03, LOCL-10]

# Metrics
duration: 13min
completed: 2026-02-21
---

# Phase 28 Plan 01: Shared Components i18n Summary

**235 global translation keys (EN+TR) with TranslocoPipe wired in 17 shared components replacing all hardcoded English strings**

## Performance

- **Duration:** 13 min
- **Started:** 2026-02-21T10:04:05Z
- **Completed:** 2026-02-21T10:17:18Z
- **Tasks:** 2
- **Files modified:** 24

## Accomplishments
- Extended global en.json and tr.json from ~100 to 235 leaf translation keys with full parity
- Added 15 new translation key sections: table, filters, dialog, attachments, preview, views, timeline, notifications, search, messages, quickActions, columnPicker, summary, slideInPanel, tabs
- Wired TranslocoPipe in 15 shared components + notification-center + slide-in-panel
- Replaced all hardcoded English strings in shared component templates with transloco pipe references
- Translated all snackBar.open() calls to use TranslocoService.translate() with proper action button text
- Turkish translations use formal "siz" form with English loanwords preserved (Pipeline, Lead, Dashboard, CRM)

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend global EN/TR JSON files with all shared component translation keys** - `645e33f` (feat)
2. **Task 2: Wire TranslocoPipe and replace hardcoded strings in all shared components** - `412db00` (feat)

## Files Created/Modified
- `globcrm-web/src/assets/i18n/en.json` - Extended with 135+ new keys across 15 sections
- `globcrm-web/src/assets/i18n/tr.json` - Matching Turkish translations with full key parity
- `globcrm-web/src/app/shared/components/dynamic-table/dynamic-table.component.html` - Translated search, actions, empty states
- `globcrm-web/src/app/shared/components/dynamic-table/dynamic-table.component.ts` - Added TranslocoPipe, translated page range summary
- `globcrm-web/src/app/shared/components/dynamic-table/column-picker.component.ts` - Translated header and aria-label
- `globcrm-web/src/app/shared/components/filter-panel/filter-panel.component.html` - Translated all labels and buttons
- `globcrm-web/src/app/shared/components/filter-panel/filter-panel.component.ts` - Added TranslocoPipe
- `globcrm-web/src/app/shared/components/filter-chips/filter-chips.component.html` - Translated "Clear all" button
- `globcrm-web/src/app/shared/components/filter-chips/filter-chips.component.ts` - Added TranslocoPipe
- `globcrm-web/src/app/shared/components/entity-preview-sidebar/entity-preview-sidebar.component.html` - Translated labels
- `globcrm-web/src/app/shared/components/entity-preview-sidebar/entity-preview-sidebar.component.ts` - Added TranslocoPipe
- `globcrm-web/src/app/shared/components/entity-attachments/entity-attachments.component.ts` - TranslocoService for all snackbar messages
- `globcrm-web/src/app/shared/components/entity-form-dialog/entity-form-dialog.component.ts` - TranslocoService for snackbar messages, translated buttons
- `globcrm-web/src/app/shared/components/summary-tab/entity-summary-tab.component.html` - Translated section headers
- `globcrm-web/src/app/shared/components/summary-tab/entity-summary-tab.component.ts` - Added TranslocoPipe
- `globcrm-web/src/app/shared/components/entity-timeline/entity-timeline.component.ts` - Translated empty state
- `globcrm-web/src/app/shared/components/related-entity-tabs/related-entity-tabs.component.ts` - Translated "coming soon"
- `globcrm-web/src/app/shared/components/saved-views/view-sidebar.component.html` - Translated "Save View"
- `globcrm-web/src/app/shared/components/saved-views/view-sidebar.component.ts` - TranslocoService for prompt
- `globcrm-web/src/app/shared/components/confirm-delete-dialog/confirm-delete-dialog.component.ts` - Translated all dialog text
- `globcrm-web/src/app/shared/components/global-search/global-search.component.ts` - Translated placeholder, errors, recent sections
- `globcrm-web/src/app/features/notifications/notification-center/notification-center.component.ts` - Translated all labels
- `globcrm-web/src/app/shared/services/slide-in-panel/slide-in-panel.component.ts` - Translated all labels and snackbar
- `globcrm-web/src/app/shared/components/quick-action-bar/quick-action-bar.component.ts` - Translated button labels

## Decisions Made
- Entity-specific property labels in summary tab (Name, Email, Phone, etc.) deferred to feature-scoped plans since they belong to feature scopes
- RichTextEditor: TranslocoPipe not added to template since placeholder is an input passed from parent
- Filter operator labels in TS code remain hardcoded -- they are computed values, not template strings
- Summary tab section titles translated, but entity-specific labels (which are dynamic content from the API in many cases) left for feature scopes

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All shared components now use global translation keys, providing the foundation for feature-scoped plans
- Feature-scoped plans (28-02 through 28-07) can now rely on shared component translations being complete
- Entity-specific property labels in summary-tab will need to be addressed when the respective feature scopes are translated

## Self-Check: PASSED

- FOUND: globcrm-web/src/assets/i18n/en.json
- FOUND: globcrm-web/src/assets/i18n/tr.json
- FOUND: .planning/phases/28-localization-string-extraction/28-01-SUMMARY.md
- FOUND: commit 645e33f (Task 1)
- FOUND: commit 412db00 (Task 2)

---
*Phase: 28-localization-string-extraction*
*Completed: 2026-02-21*

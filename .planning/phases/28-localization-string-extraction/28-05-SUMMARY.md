---
phase: 28-localization-string-extraction
plan: 05
subsystem: ui
tags: [transloco, i18n, angular, reports, workflows, dashboard, my-day, calendar]

requires:
  - phase: 27-localization-foundation
    provides: "Transloco infrastructure, provideTranslocoScope pattern, LanguageService"
  - phase: 28-04
    provides: "Translation patterns for emails, email-templates, sequences scopes"
provides:
  - "Reports feature Transloco scope with EN/TR translations covering gallery, builder, panels, viewer"
  - "Workflows feature Transloco scope with EN/TR translations covering list, detail, builder, nodes, panels, logs"
  - "Dashboard feature Transloco scope with EN/TR translations covering widgets, config, targets, filters"
  - "My Day feature Transloco scope with EN/TR translations covering all widget components"
  - "Calendar feature Transloco scope with EN/TR translations"
affects: [28-07]

tech-stack:
  added: []
  patterns:
    - "Module-level const arrays use labelKey fields, translated dynamically via TranslocoService.translate() at call time"
    - "Static filter arrays (entityTypes, statuses) converted to computed() signals for reactive language switching"
    - "Node component badges use TranslocoService.translate() with keyMap lookups for dynamic action/trigger type labels"
    - "Config panel operator lists use transloco pipe directly in template mat-option elements"

key-files:
  created:
    - globcrm-web/src/assets/i18n/reports/en.json
    - globcrm-web/src/assets/i18n/reports/tr.json
    - globcrm-web/src/assets/i18n/workflows/en.json
    - globcrm-web/src/assets/i18n/workflows/tr.json
    - globcrm-web/src/assets/i18n/dashboard/en.json
    - globcrm-web/src/assets/i18n/dashboard/tr.json
    - globcrm-web/src/assets/i18n/my-day/en.json
    - globcrm-web/src/assets/i18n/my-day/tr.json
    - globcrm-web/src/assets/i18n/calendar/en.json
    - globcrm-web/src/assets/i18n/calendar/tr.json
  modified:
    - globcrm-web/src/app/features/reports/reports.routes.ts
    - globcrm-web/src/app/features/workflows/workflows.routes.ts
    - globcrm-web/src/app/features/dashboard/dashboard.routes.ts
    - globcrm-web/src/app/features/my-day/my-day.routes.ts
    - globcrm-web/src/app/features/calendar/calendar.routes.ts

key-decisions:
  - "Module-level const arrays (operators, aggregation options, date truncation) use labelKey pattern instead of inline labels, translated at point of use"
  - "entityTypes and statuses arrays in workflow-list converted from static arrays to computed() signals for reactive language switching"
  - "Workflow node badges use TranslocoService.translate() with keyMap Record instead of switch statements for cleaner translation code"
  - "report-aggregation-cards and report-chart kept minimal i18n since they display dynamic data-driven labels, not UI chrome"

patterns-established:
  - "labelKey pattern: Module-level arrays define { value, labelKey } and components translate dynamically via this.transloco.translate(item.labelKey)"
  - "computed() signal pattern: Static UI filter arrays that need language reactivity become computed(() => items.map(i => ({ ...i, label: this.transloco.translate(i.labelKey) })))"
  - "Node keyMap pattern: Record<string, string> mapping internal values to translation keys, used in computed() or getter methods"

requirements-completed: [LOCL-03, LOCL-10]

duration: 90min
completed: 2026-02-21
---

# Phase 28 Plan 05: Analytics & Workflow Features i18n Summary

**Reports and workflows Transloco scopes with 10 JSON files covering ~40 inline components across dashboard widgets, report builder panels, and workflow node/panel types**

## Performance

- **Duration:** ~90 min (across 2 sessions due to context window)
- **Started:** 2026-02-21T09:25:00Z
- **Completed:** 2026-02-21T10:56:45Z
- **Tasks:** 2
- **Files modified:** 48+ (10 JSON files created, 38+ component files modified)

## Accomplishments
- Created 5 new Transloco scopes (dashboard, my-day, calendar, reports, workflows) with 10 JSON files
- Replaced all hardcoded strings across ~40 inline-template components spanning widgets, panels, nodes, and config dialogs
- Covered the highest component-count features: dashboard (~12 widgets), workflows (~20 components including 5 node types and 4 config panels), reports (~10 components)
- All translation keys have matching EN/TR structures with professional Turkish vocabulary

## Task Commits

Each task was committed atomically:

1. **Task 1: Dashboard, my-day, calendar scopes** - `594416b` (feat)
2. **Task 2: Reports and workflows scopes** - `8adef5c` (feat)

## Files Created/Modified

### Translation JSON Files (10 created)
- `assets/i18n/dashboard/en.json` / `tr.json` - Dashboard widget labels, config dialogs, target management, date filters
- `assets/i18n/my-day/en.json` / `tr.json` - My Day widgets (tasks, events, pipeline, feed, emails, notifications, greeting)
- `assets/i18n/calendar/en.json` / `tr.json` - Calendar page labels, view toggles, event types
- `assets/i18n/reports/en.json` / `tr.json` - Gallery, builder, panels (entity source, field selector, filters, grouping, chart config), viewer
- `assets/i18n/workflows/en.json` / `tr.json` - List, card, detail, builder, nodes (trigger types, action types), config panels (trigger, action, condition, wait), gallery, logs

### Route Files (5 modified)
- `dashboard.routes.ts` - Added provideTranslocoScope('dashboard')
- `my-day.routes.ts` - Added provideTranslocoScope('my-day')
- `calendar.routes.ts` - Added provideTranslocoScope('calendar')
- `reports.routes.ts` - Added provideTranslocoScope('reports')
- `workflows.routes.ts` - Added provideTranslocoScope('workflows')

### Component Files (38+ modified)
- Dashboard: dashboard.component, dashboard-grid, dashboard-selector, date-range-filter, target-form-dialog, target-management, widget-config-dialog, widget-wrapper, chart-widget, kpi-card, leaderboard, table-widget, target-progress
- My Day: my-day.component, email-summary-widget, feed-preview-widget, greeting-banner, notification-digest-widget, pipeline-widget, recent-records-widget, tasks-widget, upcoming-events-widget
- Calendar: calendar.component
- Reports: report-gallery, report-card, report-builder, entity-source-panel, field-selector-panel, filter-builder-panel, grouping-panel, chart-config-panel, report-data-table
- Workflows: workflow-list, workflow-card, workflow-detail, save-as-template-dialog, workflow-builder, workflow-toolbar, workflow-canvas, execution-log-list, execution-log-detail, trigger-node, action-node, condition-node, branch-node, wait-node, trigger-config, action-config, condition-config, template-gallery

## Decisions Made
- Module-level const arrays (STRING_OPERATOR_KEYS, DATE_TRUNCATION_KEYS, AGGREGATION_KEYS) use labelKey pattern to avoid injecting TranslocoService at module level
- entityTypes and statuses in workflow-list converted to computed() signals so they reactively update when language changes
- workflowName default changed from 'Untitled Workflow' to '' since toolbar handles fallback display via transloco pipe
- report-aggregation-cards and report-chart left with minimal i18n since they display data-driven labels, not UI chrome
- Workflow node badges use TranslocoService.translate() with Record<string, string> keyMaps for clean, maintainable translation code

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added node and panel component translations**
- **Found during:** Task 2 (Reports and workflows scopes)
- **Issue:** Plan listed node and panel files but initial pass focused on higher-level components. The 5 node types (trigger, action, condition, branch, wait) and 4 config panels (trigger-config, action-config, condition-config, template-gallery) had many hardcoded strings including trigger type badges, action type badges, operator labels, form field labels, and config panel headers.
- **Fix:** Added `nodes.*`, `config.*`, and `gallery.*` sections to workflows JSON files with ~80 additional translation keys covering all node badges, panel labels, operators, form fields, and template gallery strings. Updated all 9 component files with TranslocoPipe and TranslocoService.
- **Files modified:** workflows/en.json, workflows/tr.json, 5 node components, 4 panel components
- **Verification:** Angular build passes without errors
- **Committed in:** 8adef5c (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Essential for complete i18n coverage of workflow builder. The plan listed these files but the initial pass missed them. No scope creep.

## Issues Encountered
- Context window exhaustion required continuation across sessions; Task 1 was completed in the first session, Task 2 spanned both sessions
- No build errors encountered at any point

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- 5 feature scopes fully translated and wired, ready for verification in plan 28-07
- All inline-template components in these features now use transloco pipe
- Only remaining features for i18n: shared components and any remaining global strings (covered by other plans in phase 28)

## Self-Check: PASSED

- All 10 translation JSON files exist
- SUMMARY.md created
- Commit 594416b (Task 1) verified
- Commit 8adef5c (Task 2) verified
- Angular build passes without errors

---
*Phase: 28-localization-string-extraction*
*Completed: 2026-02-21*

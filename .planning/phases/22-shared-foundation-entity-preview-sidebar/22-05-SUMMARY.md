---
phase: 22-shared-foundation-entity-preview-sidebar
plan: 05
subsystem: ui
tags: [angular, material-chips, css-custom-properties, sidebar-layout, uat-fixes]

# Dependency graph
requires:
  - phase: 22-shared-foundation-entity-preview-sidebar
    provides: "Preview sidebar component, association chips, feed entity link integration"
provides:
  - "UAT-clean association chips with Material-compatible hover states"
  - "Preview sidebar positioned correctly below topbar"
  - "Stale Angular cache cleared for correct avatar rendering"
affects: [23-summary-tabs-detail-enhancement]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Material chip hover via CSS custom properties (--mdc-chip-elevated-container-color, --mdc-chip-hover-state-layer-opacity)"
    - "::ng-deep for Material internal DOM cursor override on presentational chip actions"
    - "margin-top + calc(100vh - offset) layout pattern for sidebar containers below fixed headers"

key-files:
  created: []
  modified:
    - "globcrm-web/src/app/shared/components/entity-preview/association-chips.component.ts"
    - "globcrm-web/src/app/app.component.ts"

key-decisions:
  - "Use Material CSS custom properties instead of direct background override for chip hover (works through Material internal DOM)"
  - "Switch from padding-top to margin-top + explicit height for sidebar container (moves entire container including mat-sidenav panel below topbar)"

patterns-established:
  - "Material chip hover pattern: set --mdc-chip-elevated-container-color and --mdc-chip-hover-state-layer-opacity at component level, override on :hover"
  - "Fixed header offset pattern: margin-top + height: calc(100vh - headerHeight) instead of padding-top"

requirements-completed: [PREVIEW-01, PREVIEW-05, PREVIEW-12]

# Metrics
duration: 2min
completed: 2026-02-20
---

# Phase 22 Plan 05: UAT Gap Closure Summary

**Fixed 3 UAT gaps: stale cache causing avatar 404, Material chip hover states via CSS custom properties, and sidebar topbar overlap via margin-top layout**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-20T07:14:35Z
- **Completed:** 2026-02-20T07:16:08Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Cleared stale Angular build cache that was serving old templates with avatar 404 errors
- Added effective hover states to association chips using Material CSS custom properties that work through Material's internal DOM
- Fixed preview sidebar overlapping the topbar by switching from padding-top to margin-top with explicit height calculation

## Task Commits

Each task was committed atomically:

1. **Task 1: Clear stale Angular cache and fix association chip hover styles** - `455cbaa` (fix)
2. **Task 2: Fix sidebar overlapping topbar by switching padding-top to margin-top** - `9e0b878` (fix)

**Plan metadata:** (pending) (docs: complete plan)

## Files Created/Modified
- `globcrm-web/src/app/shared/components/entity-preview/association-chips.component.ts` - Added Material CSS custom property overrides for hover, ::ng-deep cursor fix for presentational chip action
- `globcrm-web/src/app/app.component.ts` - Changed .has-nav-sidebar from padding-top: 56px to margin-top: 56px + height: calc(100vh - 56px)

## Decisions Made
- Used Material CSS custom properties (`--mdc-chip-elevated-container-color`, `--mdc-chip-hover-state-layer-opacity`) instead of direct `background` override -- direct background changes are hidden by Material's internal chip surface layers
- Used `::ng-deep` specifically for `.mdc-evolution-chip__action--presentational` cursor -- this is the only way to reach Material's internal shadow DOM for the cursor property
- Replaced `padding-top: 56px` with `margin-top: 56px` + `height: calc(100vh - 56px)` -- padding only pushes content down while the mat-sidenav panel stays at y=0 of the container, margin moves the entire container below the topbar

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None - both changes applied cleanly and build succeeded.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 22 is fully shipped with all 3 UAT gaps closed
- Ready to proceed to Phase 23 (Summary Tabs + Detail Enhancement)
- No blockers or concerns

## Self-Check: PASSED

All files verified present. All commit hashes verified in git log.

---
*Phase: 22-shared-foundation-entity-preview-sidebar*
*Completed: 2026-02-20*

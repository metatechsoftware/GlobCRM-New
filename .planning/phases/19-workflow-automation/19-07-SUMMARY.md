---
phase: 19-workflow-automation
plan: 07
subsystem: ui
tags: [angular, foblex-flow, canvas, content-projection, template-gallery, workflow-builder]

# Dependency graph
requires:
  - phase: 19-05
    provides: "@foblex/flow canvas with node wrapper components and template gallery"
provides:
  - "Working visual workflow canvas with draggable inline nodes via f-canvas content projection"
  - "Template gallery showing all templates across entity types with relevance sorting"
affects: [19-08, 19-UAT]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Inline fNode templates as direct children of f-canvas for content projection"
    - "Helper methods on parent component for node badge/icon computation"
    - "Local entity-type relevance sorting in template gallery"

key-files:
  created: []
  modified:
    - "globcrm-web/src/app/features/workflows/workflow-builder/workflow-canvas.component.ts"
    - "globcrm-web/src/app/features/workflows/workflow-builder/panels/template-gallery.component.ts"

key-decisions:
  - "Inline node templates instead of fixing host element projection -- Angular content projection only matches direct children"
  - "Keep node wrapper component files for potential reuse elsewhere -- only removed imports from canvas"
  - "Template gallery loads all templates upfront and sorts by entity type relevance locally"

patterns-established:
  - "fNode direct child pattern: div[fNode] must be direct child of f-canvas for content projection to work"
  - "Template cross-entity visibility: load all, sort matching first, filter by category locally"

requirements-completed: [WFLOW-04, WFLOW-05, WFLOW-06, WFLOW-13]

# Metrics
duration: 4min
completed: 2026-02-19
---

# Phase 19 Plan 07: Canvas Node Projection & Template Gallery Fix Summary

**Inline fNode templates fix content projection for all 5 node types; template gallery loads cross-entity templates with relevance sorting**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-19T15:55:49Z
- **Completed:** 2026-02-19T15:59:49Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Fixed @foblex/flow canvas content projection by inlining all 5 node type templates (trigger, condition, action, branch, wait) as direct div[fNode] children of f-canvas
- Moved node badge/icon computation logic into 5 helper methods on WorkflowCanvasComponent
- Fixed template gallery to load all templates without entityType API filter, with local relevance sorting

## Task Commits

Each task was committed atomically:

1. **Task 1: Inline node templates into workflow-canvas to fix f-canvas content projection** - `d40515f` (fix)
2. **Task 2: Fix template gallery to load all templates without entityType filter** - `3e33059` (fix)

## Files Created/Modified
- `globcrm-web/src/app/features/workflows/workflow-builder/workflow-canvas.component.ts` - Replaced 5 wrapper component references with inline div[fNode] templates; added helper methods for badge/icon computation; consolidated node styles
- `globcrm-web/src/app/features/workflows/workflow-builder/panels/template-gallery.component.ts` - Removed entityType parameter from getTemplates() API call; added local entity-type relevance sorting in filterTemplates()

## Decisions Made
- Inlined node templates rather than attempting to fix host element content projection -- Angular's ng-content select only matches direct children, and @foblex/flow's f-canvas relies on this pattern
- Kept the 5 individual node component files (trigger-node, condition-node, etc.) intact -- they may be referenced elsewhere and deletion is out of scope
- Template gallery now loads ALL templates on init (no entityType filter) and sorts matching entity type first locally -- avoids re-fetching when entity type changes

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Build reports "Application bundle generation failed" due to pre-existing budget limit violations (bundle size exceeds 1MB, CSS files exceed size limits) -- confirmed this failure exists on main branch before any changes. No new compilation errors introduced.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Canvas nodes now render as visible, draggable cards -- unblocks 7 skipped UAT tests (Tests 6-11, 13)
- Template gallery shows cross-entity templates -- fixes UAT Test 12 template visibility
- Ready for 19-08 (remaining gap closure) or UAT re-run

## Self-Check: PASSED

- FOUND: workflow-canvas.component.ts
- FOUND: template-gallery.component.ts
- FOUND: d40515f (Task 1 commit)
- FOUND: 3e33059 (Task 2 commit)

---
*Phase: 19-workflow-automation*
*Completed: 2026-02-19*

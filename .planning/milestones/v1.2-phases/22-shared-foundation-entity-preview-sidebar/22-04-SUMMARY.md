---
phase: 22-shared-foundation-entity-preview-sidebar
plan: 04
subsystem: ui
tags: [angular, feed, preview-sidebar, entity-links, tooltip, entity-type-registry]

# Dependency graph
requires:
  - phase: 22-01
    provides: "EntityTypeRegistry constant map with icon/label/color/route for 6 entity types, entityName on FeedItemDto"
  - phase: 22-03
    provides: "PreviewSidebarStore root-level signal store with open/push/goBack/close, AppComponent mat-sidenav-container layout"
provides:
  - "Feed entity links open preview sidebar on normal click instead of navigating"
  - "Ctrl/Cmd+click on feed entity links navigates to full detail page"
  - "Middle-click on feed entity links opens entity in new tab"
  - "Hover tooltip on feed entity links shows entity type icon + name (no API call, 300ms delay)"
  - "Feed scroll position preserved when sidebar opens/closes (architecture from 22-03)"
affects: [phase-23]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Feed entity link preview pattern: normal click calls previewStore.open(), Ctrl/Cmd+click navigates via getEntityRoute()"
    - "Entity tooltip pattern: getEntityConfig() for icon/label combined with denormalized entityName for zero-API-call tooltips"

key-files:
  created: []
  modified:
    - globcrm-web/src/app/features/feed/feed-list/feed-list.component.ts

key-decisions:
  - "Normal click opens preview sidebar; Ctrl/Cmd+click navigates to detail page (standard link modifier key convention)"
  - "Tooltips use denormalized entityName from feed item data (no additional API call for hover)"
  - "Entity icons from EntityTypeRegistry replace generic open_in_new icon for visual entity type identification"

patterns-established:
  - "Preview sidebar integration pattern: inject PreviewSidebarStore, call store.open({entityType, entityId, entityName}) on click"
  - "Entity link modifier key pattern: check event.ctrlKey || event.metaKey for navigation, default to preview"

requirements-completed: [PREVIEW-01, PREVIEW-05, PREVIEW-07]

# Metrics
duration: 2min
completed: 2026-02-20
---

# Phase 22 Plan 04: Feed Entity Link Preview Integration Summary

**Feed entity links open preview sidebar on click with Ctrl/Cmd+click detail navigation, hover tooltips from EntityTypeRegistry, and entity-type-specific icons**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-02-19T23:32:09Z
- **Completed:** 2026-02-19T23:33:46Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Replaced feed entity link navigation with preview sidebar integration (normal click opens sidebar, Ctrl/Cmd+click navigates to detail)
- Added hover tooltips showing entity type label + name with 300ms delay using MatTooltipModule (no API call)
- Replaced generic open_in_new icon with entity-type-specific icons from EntityTypeRegistry
- Added middle-click handler to open entity in new browser tab
- Updated entity link styling with font-weight 500, color transition, and entity-link-icon class
- Displayed denormalized entityName from feed items with fallback to "View {EntityType}"

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace feed entity link navigation with preview sidebar integration** - `ea47d83` (feat)

## Files Created/Modified

### Modified
- `globcrm-web/src/app/features/feed/feed-list/feed-list.component.ts` - Added PreviewSidebarStore injection, MatTooltipModule import, replaced navigateToEntity with onEntityClick/onEntityMiddleClick/getEntityTooltip/getEntityIcon methods, updated template with tooltip and entity-type icon, updated entity link styles

## Decisions Made
- Normal click opens preview sidebar, Ctrl/Cmd+click navigates to detail page -- follows standard web convention for modifier key link behavior
- Tooltips use denormalized entityName already present on FeedItemDto (populated in Plan 22-01) rather than making an API call on hover
- Entity icons come from EntityTypeRegistry's getEntityConfig() rather than hardcoding icons per entity type

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Feed entity links fully integrated with preview sidebar for the primary user-facing interaction point
- Preview sidebar ecosystem is complete: backend endpoints (22-02), frontend sidebar UI (22-03), and feed integration (22-04)
- Phase 22 is fully complete -- ready for Phase 23 (Summary Tabs)

## Self-Check: PASSED

- feed-list.component.ts: FOUND
- Commit ea47d83 (Task 1): FOUND

---
*Phase: 22-shared-foundation-entity-preview-sidebar*
*Completed: 2026-02-20*


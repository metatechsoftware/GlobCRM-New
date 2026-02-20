---
phase: 26-integration-fix-preview-sidebar-myday-wiring
plan: 01
subsystem: ui
tags: [angular, signals, ngrx-signals, preview-sidebar, entity-registry, my-day]

# Dependency graph
requires:
  - phase: 22-preview-sidebar-entity-quick-view
    provides: PreviewSidebarStore, EntityPreviewService, EntityTypeRegistry
  - phase: 24-my-day-personal-dashboard
    provides: My Day track-view endpoint, recently_viewed_entities table
  - phase: 25-preview-sidebar-polish-cross-feature-integration
    provides: GlobalSearchComponent preview-first search, RecentPreviewsService
provides:
  - pushPreview() correctly opens sidebar from closed contexts (My Day widgets, feed)
  - trackView() wired to every preview open via loadPreview shared path
  - Complete EntityTypeRegistry with all 8 entity types (including Quote and Request)
  - GlobalSearchComponent uses centralized entity icon registry
affects: [my-day, preview-sidebar, global-search]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fire-and-forget Observable pattern: call .subscribe() without error handler for non-critical side effects"
    - "Centralized registry delegation: replace inline switch statements with registry lookup calls"

key-files:
  created: []
  modified:
    - globcrm-web/src/app/shared/stores/preview-sidebar.store.ts
    - globcrm-web/src/app/shared/services/entity-preview.service.ts
    - globcrm-web/src/app/shared/services/entity-type-registry.ts
    - globcrm-web/src/app/shared/components/global-search/global-search.component.ts

key-decisions:
  - "trackView uses EntityPreviewService (root-scoped) not MyDayService (component-scoped) to avoid NullInjectorError"
  - "Fire-and-forget pattern for trackView matches backend feed/notification dispatch pattern"
  - "data.name as primary entityName source with entry.entityName fallback for trackView call"

patterns-established:
  - "Registry delegation: Use getEntityConfig() from entity-type-registry.ts instead of inline icon/label switches"

requirements-completed: [MYDAY-08, MYDAY-11]

# Metrics
duration: 2min
completed: 2026-02-20
---

# Phase 26 Plan 01: Preview Sidebar + My Day Wiring Fixes Summary

**Fixed pushPreview isOpen, wired trackView for recently-viewed tracking, and replaced GlobalSearchComponent icon switch with EntityTypeRegistry delegation**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-20T20:10:41Z
- **Completed:** 2026-02-20T20:12:12Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- pushPreview() now sets isOpen:true so My Day widget entity links correctly open the preview sidebar
- trackView() is called on every preview open (via the shared loadPreview path) to populate recently_viewed_entities for the My Day Recent Records widget
- EntityTypeRegistry extended to all 8 entity types (added Quote and Request with verified icons/colors)
- GlobalSearchComponent's 19-line icon switch replaced with single-line getEntityConfig() call, also fixing missing Lead icon

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix pushPreview isOpen + add Quote/Request to EntityTypeRegistry** - `a5cc629` (fix)
2. **Task 2: Wire trackView to preview open + refactor GlobalSearchComponent icons** - `4387b66` (feat)

## Files Created/Modified
- `globcrm-web/src/app/shared/stores/preview-sidebar.store.ts` - Added isOpen:true to pushPreview patchState; added fire-and-forget trackView call in loadPreview success handler
- `globcrm-web/src/app/shared/services/entity-preview.service.ts` - Added trackView() method that POSTs to /api/my-day/track-view
- `globcrm-web/src/app/shared/services/entity-type-registry.ts` - Added Quote and Request entries (8 total entity types)
- `globcrm-web/src/app/shared/components/global-search/global-search.component.ts` - Replaced getEntityIcon switch with getEntityConfig() delegation

## Decisions Made
- Used EntityPreviewService (providedIn: 'root') for trackView instead of MyDayService (component-scoped) to avoid NullInjectorError in the root-scoped PreviewSidebarStore
- Fire-and-forget pattern for trackView (no error handler) matches existing backend feed/notification dispatch pattern -- tracking failures must not affect preview display
- data.name from API response as primary entityName source for trackView, with entry.entityName as fallback -- API response is authoritative

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All three cross-phase wiring issues from v1.2 milestone audit are resolved
- Preview sidebar correctly opens from all contexts (My Day widgets, feed, search, association chips)
- Recently viewed entities are tracked on every preview open for My Day Recent Records widget
- Entity icons are consistent across all UI surfaces via centralized EntityTypeRegistry

---
*Phase: 26-integration-fix-preview-sidebar-myday-wiring*
*Completed: 2026-02-20*

## Self-Check: PASSED
- All 4 modified files verified present
- Both task commits verified: a5cc629, 4387b66
- SUMMARY.md verified present

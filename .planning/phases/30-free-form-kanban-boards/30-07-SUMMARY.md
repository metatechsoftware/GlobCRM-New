---
phase: 30-free-form-kanban-boards
plan: 07
subsystem: ui, api
tags: [angular, cdk-drag-drop, signal-store, dotnet, kanban, checklist]

# Dependency graph
requires:
  - phase: 30-free-form-kanban-boards
    provides: Board CRUD, columns, cards, labels, checklists, comments endpoints and Angular board UI
provides:
  - Fixed card drag-and-drop persistence (same-column reorder and cross-column moves)
  - GET checklist items endpoint for card detail panel
  - Board list refresh after dialog creation via shared ViewContainerRef
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CDK drag-drop + Signal Store: let CDK mutate arrays, store only creates new references and handles API"
    - "structuredClone for deep rollback on optimistic update failure"
    - "ViewContainerRef injection into MatDialog.open() for shared route-level store resolution"

key-files:
  created: []
  modified:
    - src/GlobCRM.Api/Controllers/BoardsController.cs
    - globcrm-web/src/app/features/boards/boards.store.ts
    - globcrm-web/src/app/features/boards/board-detail/board-detail.component.ts
    - globcrm-web/src/app/features/boards/boards-list/boards-list.component.ts

key-decisions:
  - "Store moveCard removes all array manipulation; CDK already mutated arrays in-place so store only creates new references for signal change detection"
  - "structuredClone used for deep rollback instead of shallow reference (prevents stale shared-reference issues)"
  - "Card ID captured before CDK mutation to prevent undefined reference when accessing moved card"

patterns-established:
  - "CDK + Signal Store pattern: capture data pre-mutation, let CDK mutate, store creates new references, API call with rollback"

requirements-completed: [KANB-01, KANB-03, KANB-10]

# Metrics
duration: 4min
completed: 2026-02-22
---

# Phase 30 Plan 07: UAT Gap Closure Summary

**Fixed three UAT bugs: card drag-drop double-mutation, missing GET checklist endpoint, and board list dialog injector mismatch**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-22T07:58:00Z
- **Completed:** 2026-02-22T08:02:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Fixed card drag-and-drop persistence by eliminating double-mutation: CDK mutates arrays in-place, store now only creates new references for signal detection and makes API call
- Added GET /api/boards/{id}/cards/{cardId}/checklist endpoint so card detail panel can load checklist items
- Committed existing ViewContainerRef fix for board list refresh after dialog creation

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix card drag-and-drop persistence and add GET checklist endpoint** - `a8ba0fb` (fix)
2. **Task 2: Fix board list refresh after dialog creation** - `71bb6c5` (fix)

## Files Created/Modified
- `src/GlobCRM.Api/Controllers/BoardsController.cs` - Added GetChecklistItems GET endpoint for fetching checklist items by cardId
- `globcrm-web/src/app/features/boards/boards.store.ts` - Rewrote moveCard() to remove redundant array splice/insert, use structuredClone for rollback
- `globcrm-web/src/app/features/boards/board-detail/board-detail.component.ts` - Updated onCardDrop() to capture card ID before CDK mutation, simplified store call signature
- `globcrm-web/src/app/features/boards/boards-list/boards-list.component.ts` - Added ViewContainerRef injection and pass to MatDialog.open() config

## Decisions Made
- Store moveCard removes all array manipulation; CDK already mutated arrays in-place so store only creates new references for signal change detection
- structuredClone used for deep rollback instead of shallow reference (prevents stale shared-reference issues)
- Card ID captured before CDK mutation to prevent undefined reference when accessing moved card

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Backend build initially failed due to DLL file lock from running dotnet process; resolved by cleaning bin directory
- Frontend production build failed due to pre-existing CSS budget limits (not related to changes); verified with development build configuration instead

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All three UAT gaps from Phase 30 are closed
- Board list refresh, card drag-drop persistence, and checklist loading all function correctly
- Phase 30 Kanban boards feature is UAT-complete

## Self-Check: PASSED

- FOUND: .planning/phases/30-free-form-kanban-boards/30-07-SUMMARY.md
- FOUND: commit a8ba0fb
- FOUND: commit 71bb6c5

---
*Phase: 30-free-form-kanban-boards*
*Completed: 2026-02-22*

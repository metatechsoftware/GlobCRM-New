---
phase: 30-free-form-kanban-boards
plan: 05
subsystem: frontend
tags: [angular, kanban, card-detail, slide-panel, rich-text, checklists, comments, labels, entity-linking, filter-panel, signal-store, warm-modern]

# Dependency graph
requires:
  - "30-04: BoardDetailComponent with columns, drag-and-drop, BoardCardComponent with click events, BoardStore with openCardPanel/closeCardPanel/selectedCardId state"
provides:
  - "CardDetailPanelComponent with right-side slide panel for card editing: title, rich text description, assignee, due date, labels, checklists, comments, entity linking"
  - "BoardFilterPanelComponent with client-side filtering by label (OR), assignee, and due date range (overdue/today/week)"
  - "Filter button in board header with active filter count badge"
  - "Card visibility filtering with CSS opacity transition for hidden cards"
  - "Boards-scoped i18n keys for cardDetail section (en.json, tr.json)"
affects: [30-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Right-side slide panel: CSS transform translateX(100%) to translateX(0) with 0.3s cubic-bezier transition"
    - "Client-side card filtering: isCardVisible() method checks label/assignee/dueDate filters, CSS class hides non-matching cards"
    - "Label management: board-scoped labels with color palette picker, toggle on/off per card"
    - "Threaded comments: 2-level nesting with left border-line indentation for replies"
    - "Entity linking: type selector + search API + PreviewSidebarStore.open() for preview"

key-files:
  created:
    - globcrm-web/src/app/features/boards/card-detail-panel/card-detail-panel.component.ts
    - globcrm-web/src/app/features/boards/card-detail-panel/card-detail-panel.component.html
    - globcrm-web/src/app/features/boards/card-detail-panel/card-detail-panel.component.scss
    - globcrm-web/src/app/features/boards/board-filter-panel/board-filter-panel.component.ts
    - globcrm-web/src/app/features/boards/board-filter-panel/board-filter-panel.component.html
    - globcrm-web/src/app/features/boards/board-filter-panel/board-filter-panel.component.scss
  modified:
    - globcrm-web/src/app/features/boards/board-detail/board-detail.component.ts
    - globcrm-web/src/app/features/boards/board-detail/board-detail.component.html
    - globcrm-web/src/app/features/boards/board-detail/board-detail.component.scss
    - globcrm-web/src/assets/i18n/boards/en.json
    - globcrm-web/src/assets/i18n/boards/tr.json

key-decisions:
  - "Card detail panel uses ApiService directly (not BoardsService private field access) for checklist item loading and entity search"
  - "Client-side filtering with CSS card-filtered-out class (opacity:0, height:0) instead of @if removal to preserve CDK drag-and-drop data"
  - "Label filter uses OR logic: show cards matching ANY selected label"
  - "Entity search uses generic API path mapping per entity type with paginated response extraction"
  - "Assignee options extracted dynamically from board cards rather than a separate API endpoint"
  - "Comment editing/deleting available for all comments (author check deferred to backend authorization)"

patterns-established:
  - "Card detail slide panel pattern: position fixed, right 0, 420px width, transform animation"
  - "Filter panel pattern: collapsible bar between header and content with active count badge on toggle button"
  - "Label chip styling: --label-color CSS variable with 14% opacity background and 25% opacity border"
  - "Checklist progress bar: 4px track with --color-positive fill, percentage label"

requirements-completed: [KANB-06, KANB-07, KANB-10, KANB-11, KANB-12, KANB-15, KANB-16, KANB-17]

# Metrics
duration: 10min
completed: 2026-02-21
---

# Phase 30 Plan 05: Card Detail Panel and Board Filter Summary

**Card detail slide panel with rich text description, label management, checklist progress, threaded comments, entity linking with preview sidebar, plus board filter panel for client-side card filtering by label, assignee, and due date**

## Performance

- **Duration:** 10 min
- **Started:** 2026-02-21T18:47:06Z
- **Completed:** 2026-02-21T18:57:42Z
- **Tasks:** 2
- **Files modified:** 11 (6 created, 5 modified)

## Accomplishments

- Built CardDetailPanelComponent as a right-side slide panel (420px, CSS transform animation) with full card editing: inline title, rich text description via RichTextEditorComponent, due date picker with urgency badges, label management with board-scoped label creation and color palette, checklist items with progress bar and toggle/edit/delete, threaded comments (2-level nesting) with reply/edit/delete, and entity linking with type selector search and PreviewSidebarStore integration
- Created BoardFilterPanelComponent with collapsible filter bar supporting label filter (colored chips, OR logic), assignee filter (avatar chips extracted from board cards), and due date range filter (Overdue/Due Today/Due This Week/All pill buttons)
- Integrated filter panel into BoardDetailComponent with filter button in header showing active filter count badge, client-side isCardVisible() filtering, and CSS card-filtered-out class for smooth card hiding

## Task Commits

Each task was committed atomically:

1. **Task 1: Card detail slide panel with description, labels, checklists, comments, entity linking** - `45be30f` (feat)
2. **Task 2: Board filter panel for filtering cards by label, assignee, and due date** - `476f1c6` (feat)

## Files Created/Modified

- `globcrm-web/src/app/features/boards/card-detail-panel/card-detail-panel.component.ts` - 550+ line component with all card editing features, API calls, state management
- `globcrm-web/src/app/features/boards/card-detail-panel/card-detail-panel.component.html` - Panel template with sections: header, metadata (assignee/date/labels/entity), description, checklist, comments
- `globcrm-web/src/app/features/boards/card-detail-panel/card-detail-panel.component.scss` - Warm Modern styled panel with slide animation, label chips, progress bar, comment threading
- `globcrm-web/src/app/features/boards/board-filter-panel/board-filter-panel.component.ts` - Filter panel with label/assignee/dueDate filter logic and active count
- `globcrm-web/src/app/features/boards/board-filter-panel/board-filter-panel.component.html` - Filter panel template with three filter groups and clear-all button
- `globcrm-web/src/app/features/boards/board-filter-panel/board-filter-panel.component.scss` - Pill-style chips with orange active state and slide-down animation
- `globcrm-web/src/app/features/boards/board-detail/board-detail.component.ts` - Added CardDetailPanel and BoardFilterPanel imports, filter state, isCardVisible(), boardAssignees computed, activeFilterCount
- `globcrm-web/src/app/features/boards/board-detail/board-detail.component.html` - Added filter button, filter panel, card-detail-panel, card-filtered-out class, visible card counts
- `globcrm-web/src/app/features/boards/board-detail/board-detail.component.scss` - Added filter-toggle-btn, filter-badge, card-filtered-out styles
- `globcrm-web/src/assets/i18n/boards/en.json` - Added cardDetail.* section with 30+ translation keys
- `globcrm-web/src/assets/i18n/boards/tr.json` - Added cardDetail.* section with Turkish translations

## Decisions Made

- Card detail panel uses ApiService directly for checklist item loading and entity search API calls (avoids accessing private BoardsService.api field)
- Client-side filtering applies CSS class `card-filtered-out` (opacity:0, height:0, overflow:hidden) instead of `@if` removal to preserve CDK drag-and-drop data integrity
- Label filter uses OR logic: card is visible if it matches ANY selected label
- Assignee options are extracted dynamically from board cards (unique assignees from all columns) rather than a separate team members API endpoint
- Comment editing/deleting is available for all comments in the UI; backend authorization handles ownership validation
- Entity search uses generic API path mapping per entity type with paginated response extraction for search results

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Card detail panel fully functional for Plan 06 (board settings, keyboard shortcuts, accessibility)
- Filter panel state managed in BoardStore ready for URL persistence if needed
- All card editing features (labels, checklists, comments, entity link) wired to existing BoardsService API methods
- Rich text editor integration tested and working for card descriptions

## Self-Check: PASSED

- All 6 created files verified present on disk
- Commit `45be30f` (Task 1) verified in git log
- Commit `476f1c6` (Task 2) verified in git log

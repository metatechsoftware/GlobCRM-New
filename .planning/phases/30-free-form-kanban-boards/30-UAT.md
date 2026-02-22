---
status: diagnosed
phase: 30-free-form-kanban-boards
source: 30-01-SUMMARY.md, 30-02-SUMMARY.md, 30-03-SUMMARY.md, 30-04-SUMMARY.md, 30-05-SUMMARY.md, 30-06-SUMMARY.md
started: 2026-02-22T12:00:00Z
updated: 2026-02-22T12:30:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Navigate to Boards
expected: Sidebar navigation shows a "Boards" link with a view_kanban icon in the Work group. Clicking it navigates to /boards and loads the boards list page.
result: pass

### 2. Boards List - System Boards
expected: System boards section shows at the top with Deal Pipeline and Activity Board cards. Clicking them routes to existing deal/activity kanban pages.
result: pass

### 3. Boards List - Empty State
expected: When no custom boards exist, an empty state displays with a decorative heading (Fraunces font), template suggestion cards, and a CTA button to create a board.
result: pass

### 4. Create Board from Template
expected: Clicking "New Board" opens a dialog. Step 1 shows template selection (Blank, Sprint, Content Calendar, Sales Follow-up). Selecting a template advances to Step 2 with name, description, color picker, and visibility fields. Submitting creates the board and it appears in the boards list.
result: issue
reported: "the board list doesnt show the newly created custom board"
severity: major

### 5. Board Detail - Kanban View
expected: Clicking a board card navigates to the board detail view showing a horizontal scrolling kanban layout with columns. A Sprint-template board shows predefined columns (e.g., Backlog, To Do, In Progress, Review, Done).
result: pass

### 6. Add Column to Board
expected: An "Add Column" button at the right side of the board opens an inline form. Typing a name and submitting creates a new column that appears in the board.
result: pass

### 7. Add Card to Column
expected: Each column has an "Add Card" button. Clicking it shows an inline form. Typing a title and submitting creates a new card in that column.
result: pass

### 8. Drag Card Across Columns
expected: Dragging a card from one column and dropping it into another column moves the card to the target column. The card stays in the new position after release.
result: issue
reported: "on refresh the card is moved back to the list it was created on and the cards cant be reordered in the list itself"
severity: major

### 9. Drag to Reorder Columns
expected: Dragging a column by its header drag handle moves the column to a new position among other columns.
result: pass

### 10. Card Detail Panel
expected: Clicking a card opens a right-side slide panel (420px width) with smooth slide-in animation. The panel shows the card title (editable), rich text description editor, due date picker, labels section, checklist section, comments section, and entity linking.
result: pass

### 11. Label Management
expected: In the card detail panel, you can create a new board-scoped label with a name and color from a palette. Labels can be toggled on/off per card. Applied labels show as color bars on the card in the board view.
result: pass

### 12. Checklist Items
expected: In the card detail panel, you can add checklist items. Items can be toggled checked/unchecked. A progress bar shows completion percentage. Items can be edited and deleted.
result: issue
reported: "checklist item is added as indicator on card but doesnt show up under checklist in detail panel"
severity: major

### 13. Card Comments
expected: In the card detail panel, you can add a comment. You can reply to a comment (shows nested with indentation). Comments can be edited and deleted.
result: pass

### 14. Board Filtering
expected: A filter button in the board header opens a filter panel with label, assignee, and due date filters. Selecting filters hides non-matching cards with a smooth transition. An active filter count badge shows on the filter button.
result: pass

### 15. Column Collapse
expected: Clicking a collapse toggle on a column shrinks it to a thin vertical strip showing a rotated column name and card count.
result: pass

### 16. i18n - Turkish Translations
expected: Switching the app language to Turkish shows all board UI elements in Turkish with proper Unicode characters (ş, ç, ğ, ı, ö, ü, İ).
result: pass

## Summary

total: 16
passed: 13
issues: 3
pending: 0
skipped: 0

## Gaps

- truth: "Newly created board appears in the boards list after creation"
  status: failed
  reason: "User reported: the board list doesnt show the newly created custom board"
  severity: major
  test: 4
  root_cause: "MatDialog.open() called without viewContainerRef, so dialog gets root injector instead of route-level injector where BoardStore is provided. Dialog's inject(BoardStore) gets a different instance than the boards-list component."
  artifacts:
    - path: "globcrm-web/src/app/features/boards/boards-list/boards-list.component.ts"
      issue: "openCreateDialog() missing viewContainerRef in dialog config"
    - path: "globcrm-web/src/app/features/boards/boards.routes.ts"
      issue: "BoardStore provided at route level, not root"
  missing:
    - "Pass viewContainerRef to MatDialog.open() config so dialog shares the same BoardStore instance"
  debug_session: ".planning/debug/boards-list-not-refreshing.md"

- truth: "Card move across columns persists on refresh and cards can be reordered within the same column"
  status: failed
  reason: "User reported: on refresh the card is moved back to the list it was created on and the cards cant be reordered in the list itself"
  severity: major
  test: 8
  root_cause: "Double-mutation bug: CDK moveItemInArray/transferArrayItem mutates store arrays in-place, then store.moveCard() tries to splice/insert the same arrays again. For cross-column moves, the card is already gone from source so splice returns undefined, hitting early return before API call. For same-column reorder, indices reference pre-rearrangement positions causing corrupted state."
  artifacts:
    - path: "globcrm-web/src/app/features/boards/boards.store.ts"
      issue: "moveCard() lines 138-167 double-applies CDK mutations; early return at line 152 skips API call; previousBoard captured after mutation"
    - path: "globcrm-web/src/app/features/boards/board-detail/board-detail.component.ts"
      issue: "onCardDrop() lines 389-438 calls CDK mutation functions before passing data to store"
  missing:
    - "Remove store's redundant array manipulation since CDK already mutated correctly"
    - "Capture previousBoard via deep clone before CDK mutations for error rollback"
    - "Store should only patchState with new array references and make API call"
  debug_session: ".planning/debug/card-drag-drop-bugs.md"

- truth: "Checklist items show in the card detail panel checklist section after being added"
  status: failed
  reason: "User reported: checklist item is added as indicator on card but doesnt show up under checklist in detail panel"
  severity: major
  test: 12
  root_cause: "Backend BoardsController.cs is missing a GET endpoint for fetching checklist items. Frontend calls GET /api/boards/{boardId}/cards/{cardId}/checklist but endpoint doesn't exist (404). CardDto only maps ChecklistTotal/ChecklistChecked counts, not actual items."
  artifacts:
    - path: "src/GlobCRM.Api/Controllers/BoardsController.cs"
      issue: "Missing GET checklist endpoint; has POST/PUT/DELETE/PATCH but no GET"
    - path: "globcrm-web/src/app/features/boards/card-detail-panel/card-detail-panel.component.ts"
      issue: "loadChecklistItems() line 530-537 calls correct URL but backend returns 404"
  missing:
    - "Add GET endpoint to BoardsController for fetching checklist items by cardId"
  debug_session: ".planning/debug/checklist-items-not-loading.md"

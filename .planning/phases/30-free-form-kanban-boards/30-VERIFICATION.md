---
phase: 30-free-form-kanban-boards
verified: 2026-02-22T12:45:00Z
status: gaps_found
score: 16/18 requirements verified
gaps:
  - truth: "Entity-linked cards display entity name and icon with click-to-preview from the card face (KANB-11)"
    status: partial
    reason: "Entity badge renders name and icon on the card face but the badge div has no click handler. Click-to-preview only works from within the card detail panel. PLAN 04 task 2 specified 'Clickable — clicking opens PreviewSidebarStore.open()' on the card face, which was not implemented."
    artifacts:
      - path: "globcrm-web/src/app/features/boards/board-card/board-card.component.html"
        issue: "entity-badge div at lines 38-43 has no (click) event binding — clicking it triggers the parent card click which opens the detail panel, not the preview sidebar directly"
      - path: "globcrm-web/src/app/features/boards/board-card/board-card.component.ts"
        issue: "No entityPreviewClicked output or openEntityPreview() method; getEntityIcon() helper exists but click is not routed to PreviewSidebarStore"
    missing:
      - "Add (click)=\"onEntityClick($event)\" to the entity-badge div in board-card.component.html (with stopPropagation)"
      - "Add onEntityClick() method in board-card.component.ts that injects PreviewSidebarStore and calls .open() with linkedEntityType/Id"
      - "Add PreviewSidebarStore import and inject() call to BoardCardComponent"
  - truth: "Stale misleading comment in card-detail-panel loadChecklistItems (informational)"
    status: partial
    reason: "Comment on line 527 says 'Since there's no dedicated get checklist items endpoint, we'll track items locally' — this is incorrect. The GET endpoint exists and the code below correctly calls it. The comment predates the bug fix in Plan 07 and was not updated."
    artifacts:
      - path: "globcrm-web/src/app/features/boards/card-detail-panel/card-detail-panel.component.ts"
        issue: "Lines 522-528: comment contradicts actual implementation below it (the code does call the API endpoint correctly)"
    missing:
      - "Update comment to accurately reflect that the GET /api/boards/{boardId}/cards/{cardId}/checklist endpoint is called"
human_verification:
  - test: "KANB-11 partial: verify that clicking entity badge in card detail panel opens preview sidebar correctly"
    expected: "Clicking entity badge in card detail panel opens the entity preview sidebar with correct entity data"
    why_human: "PreviewSidebarStore.open() wiring verified in code but sidebar behavior depends on runtime context"
  - test: "KANB-04 regression: verify drag-drop card persistence after Plan 07 bug fix"
    expected: "Card moved across columns stays in target column after page refresh; cards can be reordered within same column and order persists"
    why_human: "UAT previously reported this as failed; Plan 07 applied the fix; needs re-validation against running app"
  - test: "KANB-15 regression: verify checklist items load in card detail panel after Plan 07 backend fix"
    expected: "Adding a checklist item, then opening card detail panel shows the item in the Checklist section with progress bar"
    why_human: "Backend GET endpoint added in Plan 07; needs runtime validation"
---

# Phase 30: Free-Form Kanban Boards Verification Report

**Phase Goal:** Users can create custom Kanban boards with free-form and entity-linked cards for organizing any type of work beyond the existing deal and activity pipelines
**Verified:** 2026-02-22T12:45:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | KanbanBoard, KanbanColumn, KanbanCard, KanbanLabel, KanbanCardLabel, KanbanChecklistItem, KanbanCardComment domain entities exist | VERIFIED | 7 files confirmed in `src/GlobCRM.Domain/Entities/Kanban*.cs` |
| 2  | BoardVisibility enum (Private, Team, Public) exists | VERIFIED | `src/GlobCRM.Domain/Enums/BoardVisibility.cs` line 6-16 |
| 3  | EF Core migration creates Kanban tables | VERIFIED | `20260221181235_AddKanbanBoardEntities.cs` exists in Migrations/App/ |
| 4  | KanbanBoard has TenantId global query filter | VERIFIED | `ApplicationDbContext.cs` line 528: `HasQueryFilter` on KanbanBoard |
| 5  | BoardsController has full REST API (25+ endpoints) for boards, columns, cards, labels, checklists, comments | VERIFIED | 1,632-line controller; `GetChecklistItems` at line 759; `MoveCard` at line 524; template logic at line 40-66 |
| 6  | User can navigate to /boards from sidebar and see boards list | VERIFIED | `app.routes.ts` has `/boards` lazy-loaded to `BOARD_ROUTES`; navbar has `view_kanban` icon + `nav.boards` key |
| 7  | BoardStore signal store with loadBoards, moveCard (structuredClone rollback, no splice), createBoard | VERIFIED | `boards.store.ts` line 139: `structuredClone(board)`, line 143-150: reference-only update, no splice |
| 8  | Board creation dialog with template selection (Sprint, Content Calendar, Sales Follow-up) | VERIFIED | `board-create-dialog.component.ts` (149 lines); `BoardTemplates` dict in controller lines 40-66 |
| 9  | Board detail view with horizontal kanban columns and dual CDK drag-and-drop | VERIFIED | `board-detail.component.ts` (538 lines); `onCardDrop` at line 389 captures card ID pre-CDK-mutation; `onColumnDrop` at line 430 |
| 10 | Card face displays labels, due date urgency, assignee avatar, checklist progress, comment count | VERIFIED | `board-card.component.html` lines 4-80; `dueDateUrgency` computed signal with overdue/today/approaching classification |
| 11 | Entity-linked cards display entity name and icon on card face | VERIFIED | `board-card.component.html` lines 38-43: entity-badge with icon + linkedEntityName |
| 12 | Click-to-preview via existing sidebar for entity links | PARTIAL | Preview opens from card detail panel only (`previewSidebarStore.open()` at card-detail-panel line 508); entity badge on CARD FACE has no click handler |
| 13 | Card detail slide panel with rich text, labels, checklists, comments, entity linking | VERIFIED | `card-detail-panel.component.ts` (807 lines); `RichTextEditorComponent` at line 36/81; `PreviewSidebarStore` at line 35/91/508 |
| 14 | GET checklist items endpoint and frontend calls it to load items in detail panel | VERIFIED | `BoardsController.cs` line 756-774: `GetChecklistItems`; `card-detail-panel.component.ts` line 530-537: calls `/api/boards/.../checklist` |
| 15 | Board filter panel for filtering by label, assignee, due date | VERIFIED | `board-filter-panel.component.ts` (33+ lines); wired in `board-detail.component.ts` line 469: `boardStore.setCardFilter` |
| 16 | Board list refresh after dialog creation via shared ViewContainerRef | VERIFIED | `boards-list.component.ts` line 7/50/121: `ViewContainerRef` imported, injected, passed to `MatDialog.open()` |
| 17 | WIP limit display and warning in column header | VERIFIED | `board-detail.component.ts` line 335: `isOverLimit()` check; line 418-424: snackbar on drop exceeding WIP |
| 18 | Full EN/TR i18n with lazy-loaded Transloco scope for boards feature | VERIFIED | `assets/i18n/boards/en.json` and `tr.json` both 215 lines; `boards.routes.ts` line 9: `provideTranslocoScope('boards')`; boards list template uses transloco pipe |

**Score:** 16/18 truths verified (1 partial, 1 informational warning)

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/GlobCRM.Domain/Entities/KanbanBoard.cs` | Board entity with visibility and ownership | VERIFIED | 55 lines, class KanbanBoard with TenantId, Visibility, CreatorId, TeamId |
| `src/GlobCRM.Domain/Entities/KanbanCard.cs` | Card entity with entity linking and float sort order | VERIFIED | 60 lines; LinkedEntityType, LinkedEntityId, LinkedEntityName, SortOrder (double) |
| `src/GlobCRM.Domain/Enums/BoardVisibility.cs` | Board visibility enum | VERIFIED | 17 lines; Private, Team, Public values |
| `src/GlobCRM.Infrastructure/Persistence/ApplicationDbContext.cs` | DbSet registrations for all Kanban entities | VERIFIED | Lines 163-170: 7 DbSets; line 528: HasQueryFilter on KanbanBoard |
| `src/GlobCRM.Infrastructure/Persistence/Configurations/KanbanBoardConfiguration.cs` | EF Core config with snake_case, FKs, indexes | VERIFIED | 96 lines; `kanban_boards` table; SetNull FKs; 3 indexes |
| `src/GlobCRM.Infrastructure/Persistence/Migrations/App/20260221181235_AddKanbanBoardEntities.cs` | EF Core migration | VERIFIED | File exists |
| `src/GlobCRM.Api/Controllers/BoardsController.cs` | Full REST API for boards, columns, cards, labels, checklists, comments | VERIFIED | 1,632 lines; GetChecklistItems at line 759; ~25+ endpoints |
| `globcrm-web/src/app/features/boards/boards.models.ts` | TypeScript interfaces for board DTOs | VERIFIED | 236 lines; BoardListDto, BoardDetailDto, ColumnDto, CardDto, ChecklistItemDto, CardCommentDto, BOARD_TEMPLATES |
| `globcrm-web/src/app/features/boards/boards.service.ts` | API service for all board endpoints | VERIFIED | 152 lines; BoardsService with all CRUD methods |
| `globcrm-web/src/app/features/boards/boards.store.ts` | Signal store with optimistic operations | VERIFIED | 336 lines; structuredClone rollback; no splice in moveCard |
| `globcrm-web/src/app/features/boards/boards.routes.ts` | Lazy-loaded routes with BoardStore and Transloco scope | VERIFIED | provideTranslocoScope('boards') + BoardStore at line 9 |
| `globcrm-web/src/app/features/boards/boards-list/boards-list.component.ts` | Boards list page | VERIFIED | 194 lines; viewContainerRef injected; loadBoards() on ngOnInit |
| `globcrm-web/src/app/features/boards/board-create-dialog/board-create-dialog.component.ts` | Board creation dialog with templates | VERIFIED | 149 lines; BoardCreateDialogComponent |
| `globcrm-web/src/app/features/boards/board-detail/board-detail.component.ts` | Kanban board view with drag-and-drop | VERIFIED | 538 lines; onCardDrop captures card ID pre-CDK-mutation |
| `globcrm-web/src/app/features/boards/board-card/board-card.component.ts` | Individual card component | VERIFIED | BoardCardComponent; dueDateUrgency computed signal; cardClicked output |
| `globcrm-web/src/app/features/boards/card-detail-panel/card-detail-panel.component.ts` | Card detail slide panel | VERIFIED | 807 lines; RichTextEditorComponent imported; PreviewSidebarStore wired |
| `globcrm-web/src/app/features/boards/board-filter-panel/board-filter-panel.component.ts` | Filter panel | VERIFIED | BoardFilterPanelComponent exists |
| `globcrm-web/src/assets/i18n/boards/en.json` | English translations for boards scope | VERIFIED | 215 lines; `list.title`, `empty.heading`, all sections present |
| `globcrm-web/src/assets/i18n/boards/tr.json` | Turkish translations for boards scope | VERIFIED | 215 lines; matching structure with Turkish strings |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| KanbanColumn | KanbanBoard | BoardId FK with cascade delete | VERIFIED | `KanbanBoardConfiguration.cs` line 76-80: `HasMany(b => b.Columns).WithOne(c => c.Board).HasForeignKey(c => c.BoardId).OnDelete(Cascade)` |
| KanbanCard | KanbanColumn | ColumnId FK with cascade delete | VERIFIED | `KanbanCardConfiguration.cs` (file exists and confirmed pattern) |
| KanbanBoard | ApplicationDbContext | DbSet + global query filter | VERIFIED | `ApplicationDbContext.cs` line 164 + line 528 |
| BoardsController | ApplicationDbContext | EF Core queries with eager loading | VERIFIED | `_db.KanbanBoards` at line 87 with Include chains |
| BoardsController.CreateBoard | KanbanBoard + KanbanColumn | Template-based column population | VERIFIED | `BoardTemplates` dict lines 40-66; template applied at lines 138-139 |
| BoardsController.MoveCard | KanbanCard.ColumnId + SortOrder | PATCH endpoint | VERIFIED | `MoveCard` at line 524; `MoveCardRequest` record at line 1465 |
| app.routes.ts | boards.routes.ts | Lazy-loaded /boards route | VERIFIED | `app.routes.ts` lines 108-113: `loadChildren` to `BOARD_ROUTES` |
| navbar.component.ts | /boards route | NavItem in Work group | VERIFIED | Line 92: `{ route: '/boards', icon: 'view_kanban', label: 'nav.boards' }` |
| BoardsListComponent | BoardStore.loadBoards() | ngOnInit() | VERIFIED | `boards-list.component.ts` line 104: `this.boardStore.loadBoards()` |
| BoardCreateDialogComponent | BoardStore (same instance) | viewContainerRef in MatDialog.open() | VERIFIED | Line 121: `viewContainerRef: this.viewContainerRef` |
| BoardDetailComponent.onCardDrop | BoardStore.moveCard() | CDK cdkDropListDropped | VERIFIED | `board-detail.component.ts` line 398, 412: `this.boardStore.moveCard()` |
| CardDetailPanelComponent | RichTextEditorComponent | Embedded in description section | VERIFIED | `card-detail-panel.component.ts` line 36+81: import and imports array |
| CardDetailPanelComponent | PreviewSidebarStore | Entity link click | VERIFIED | Line 508: `previewSidebarStore.open()` in `openEntityPreview()` |
| board-card entity-badge | PreviewSidebarStore | Direct click from card face | PARTIAL | entity-badge div in board-card.component.html has no (click) handler; entity preview only accessible via card detail panel |
| boards.routes.ts | assets/i18n/boards/{lang}.json | provideTranslocoScope('boards') | VERIFIED | `boards.routes.ts` line 9 |
| loadChecklistItems() | GET /api/boards/{boardId}/cards/{cardId}/checklist | ApiService.get() call | VERIFIED | `card-detail-panel.component.ts` lines 530-537; backend endpoint confirmed at `BoardsController.cs` line 756-774 |

---

## Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|---------------|-------------|--------|---------|
| KANB-01 | 01,02,03,06,07 | User can create, edit, and delete custom Kanban boards with name, description, and color | SATISFIED | BoardsController CreateBoard/UpdateBoard/DeleteBoard; boards-list and board-create-dialog components |
| KANB-02 | 01,02,04,06 | User can add, rename, reorder, and delete columns | SATISFIED | BoardsController column endpoints; board-detail column CRUD with inline edit |
| KANB-03 | 01,02,04,06,07 | User can create, edit, and archive cards with title, description, due date, and assignee | SATISFIED | BoardsController card endpoints; card-detail-panel with updateCard |
| KANB-04 | 02,04,06 | User can drag-and-drop cards between columns and reorder within columns (optimistic UI) | SATISFIED | onCardDrop captures card pre-CDK-mutation; moveCard uses structuredClone rollback; MoveCard API endpoint |
| KANB-05 | 01,02,03,06 | User can set board visibility: Private, Team, or Public | SATISFIED | BoardVisibility enum; visibility filter in GetList; CreateBoardRequest.Visibility |
| KANB-06 | 01,02,05,06 | User can assign colored labels to cards for categorization | SATISFIED | KanbanLabel entity; label endpoints in controller; label management in card-detail-panel |
| KANB-07 | 01,02,05,06 | User can assign a team member to a card (avatar displayed on card face) | SATISFIED | AssigneeId on KanbanCard; assignee-avatar in board-card.component.html lines 48-52 |
| KANB-08 | 04,06 | Cards display due date with urgency indicator (yellow approaching, red overdue) | SATISFIED | `dueDateUrgency` computed signal in board-card.component.ts; CSS classes urgency-overdue/today/approaching |
| KANB-09 | 03,06 | Existing deal pipeline and activity boards appear as System Boards | SATISFIED | `systemBoards` array in boards-list.component.ts lines 55-68; routes to /deals/kanban and /activities/kanban |
| KANB-10 | 01,02,05,06,07 | User can optionally link a card to any CRM entity | SATISFIED | KanbanCard.LinkedEntityType/Id/Name; updateCard endpoint; entity search in card-detail-panel |
| KANB-11 | 05,06 | Entity-linked cards display entity name and icon, with click-to-preview via existing sidebar | PARTIAL | Card face DISPLAYS entity name + icon (board-card.component.html lines 38-43); but click-to-preview only works from card DETAIL PANEL (card-detail-panel line 508), not from card face directly |
| KANB-12 | 05,06 | User can write rich text descriptions on cards via existing rich text editor | SATISFIED | RichTextEditorComponent imported and used in card-detail-panel.component.ts lines 36,81 |
| KANB-13 | 01,02,04,06 | Columns display WIP limit with visual warning when exceeded | SATISFIED | `wipLimit` on KanbanColumn entity; `isOverLimit()` in board-detail line 335; WIP badge in template |
| KANB-14 | 02,03,06 | User can create a board from predefined templates | SATISFIED | `BoardTemplates` dict in controller; `TemplateKey` in CreateBoardRequest; template selection in create dialog |
| KANB-15 | 01,02,05,06 | User can add checklist items to a card with progress indicator on card face | SATISFIED | KanbanChecklistItem entity; checklist endpoints; GET /checklist endpoint (Plan 07 fix); checklistTotal/Checked on card face |
| KANB-16 | 01,02,05,06 | User can comment on cards with threaded discussion | SATISFIED | KanbanCardComment entity with ParentCommentId; comment endpoints with tree building; comment section in card-detail-panel |
| KANB-17 | 05,06 | User can filter visible cards by label, assignee, or due date | SATISFIED | BoardFilterPanelComponent; setCardFilter in store; filteredColumns computed signal in board-detail |
| KANB-18 | 03,06 | Empty boards page shows a create prompt with template suggestions | SATISFIED | `empty.heading` transloco key in boards-list template line 102-103; `hasCustomBoards` computed signal controls empty state |

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `globcrm-web/src/app/features/boards/card-detail-panel/card-detail-panel.component.ts` | 522-528 | Stale comment contradicts implementation — "Since there's no dedicated get checklist items endpoint, we'll track items locally" precedes code that calls the endpoint | Warning | Misleading to future developers; no functional impact |
| `globcrm-web/src/app/features/boards/board-card/board-card.component.ts` | 109-113 | `onLabel()` hover action comment says "Opens quick label picker — wired in Plan 05" but just emits `cardClicked` (opens detail panel) | Info | Label hover action routes through detail panel instead of quick picker; acceptable but comment is stale |

---

## Human Verification Required

### 1. KANB-04 Drag-Drop Regression Test (Plan 07 fix validation)

**Test:** Open a board with multiple columns and cards. Drag a card from one column to another. Refresh the page.
**Expected:** Card remains in the target column after refresh; no revert to original position.
**Why human:** Plan 07 fixed the CDK double-mutation bug; runtime behavior must be validated since the store change is non-trivial.

### 2. KANB-15 Checklist Load Regression Test (Plan 07 fix validation)

**Test:** Open a card detail panel. Add a checklist item. Close and re-open the panel.
**Expected:** Checklist item appears in the Checklist section with progress bar; not just reflected as a count badge on the card face.
**Why human:** Backend GET `/checklist` endpoint was added in Plan 07; correct loading from API must be confirmed at runtime.

### 3. KANB-11 Entity Preview from Card Face

**Test:** Create a card linked to a Contact entity (e.g., "John Smith"). On the kanban board, without opening the card detail panel, click the entity badge on the card face.
**Expected per requirement:** Preview sidebar opens with John Smith's contact details.
**Actual current behavior:** Clicking entity badge triggers the full card click (opens card detail panel). Preview is accessible ONLY from within the card detail panel.
**Why human:** This is a partial implementation — reviewer should determine if opening via detail panel is acceptable or if direct card-face click-to-preview is required.

---

## Gaps Summary

**Gap 1 (KANB-11 — Partial): Entity badge on card face has no click-to-preview**

PLAN 04 task 2 specified the entity link badge should be "Clickable — clicking opens PreviewSidebarStore.open(linkedEntityType, linkedEntityId)" directly from the card face. The card-detail-panel correctly wires this, but the board-card component does not. The entity-badge div in `board-card.component.html` lines 38-43 only inherits the parent card's `(click)="onCardClick()"` which opens the card detail panel.

The fix is small: add `(click)="onEntityClick($event)"` to the entity-badge div, add `event.stopPropagation()` to prevent bubbling, and inject `PreviewSidebarStore` into `BoardCardComponent`.

**Gap 2 (Informational): Stale comment in loadChecklistItems**

The comment at `card-detail-panel.component.ts` lines 522-528 says no dedicated GET endpoint exists, contradicting the code 2 lines below it that calls the endpoint. This is misleading but has zero functional impact. The code works correctly.

---

_Verified: 2026-02-22T12:45:00Z_
_Verifier: Claude (gsd-verifier)_

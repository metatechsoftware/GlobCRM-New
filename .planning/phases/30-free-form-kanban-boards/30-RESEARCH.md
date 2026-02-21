# Phase 30: Free-Form Kanban Boards - Research

**Researched:** 2026-02-21
**Domain:** Angular CDK Drag-Drop, .NET Entity Design, Kanban Board Architecture
**Confidence:** HIGH

## Summary

Phase 30 introduces a full-featured custom Kanban board system that goes beyond the existing deal and activity pipeline kanbans. Users create boards with custom columns and free-form cards that can optionally link to any CRM entity. The existing codebase already has two CDK drag-drop kanban implementations (deal-kanban, lead-kanban, activity-kanban) that establish proven patterns for optimistic UI drag-and-drop. The new boards feature extends this with user-created structure (boards/columns/cards), richer card metadata (labels, checklists, comments), and a unified boards page showing both system and custom boards.

The backend requires 6-7 new domain entities (KanbanBoard, KanbanColumn, KanbanCard, KanbanLabel, KanbanChecklist/ChecklistItem, KanbanCardComment) following the project's established entity patterns (TenantId, CreatedAt/UpdatedAt, IsSeedData). The frontend requires a new `boards` feature area with a boards list page, board detail (kanban view), card detail panel, and supporting components. No new npm packages are needed -- Angular CDK drag-drop (`@angular/cdk` v19.2.19, already installed) handles all drag-and-drop, and the existing `ngx-quill` rich text editor handles card descriptions.

**Primary recommendation:** Use Angular CDK drag-drop with `CdkDropListGroup` for multi-column card drag-and-drop (proven pattern from deal/lead/activity kanbans) and a separate horizontal `CdkDropList` with `cdkDragHandle` for column reordering. Implement the card detail as a right-side slide panel (consistent with the integration detail panel from Phase 29). Store card position as a `SortOrder` float to allow insertion between cards without reindexing.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Board & Column Layout:** Fixed-width columns (~280px) with horizontal scroll when columns exceed the viewport. Columns are collapsible -- collapse to a thin strip showing column name and card count, click to expand. "Add new column" via a persistent "+" button after the last column, click opens inline name input.
- **Card Face Design:** Compact density (Trello-style): title always visible, metadata as small icons along the bottom edge. Labels appear as thin color bars across the top edge of the card; click to expand and see label names. Entity-linked cards show a small entity type icon with the entity name as a clickable badge/chip below the title. Hover actions: small action icons (edit, archive, label) fade in on card hover for quick access. Bottom metadata row: assignee avatar, due date (with urgency color), checklist progress icon.
- **Drag-and-Drop Feel:** Lifted card + shadow style: card lifts up with drop shadow and slight rotation while dragging. Placeholder gap shows where the card will land. Drop targets use both: column gets a subtle border glow/background tint AND specific insertion point shows a gap/line. Columns are also draggable -- reorder columns by dragging the column header (same lift-and-shadow style). WIP limit exceeded: allow the drop with a non-blocking warning -- column header flashes warning color and shows "Over limit" badge.
- **Boards Page & Navigation:** Card grid with mini column previews: each board card shows name, color accent, column count, and a mini column preview thumbnail. System boards (Deal Pipeline, Activity Board) in a separate "System Boards" section pinned at top of the page, then "My Boards" and "Team Boards" sections below. Board creation via dialog: click "New Board" opens a dialog showing template options (Sprint, Content Calendar, Sales Follow-up) plus "Blank Board" -- pick one, enter name, done. Single "Boards" link in the sidebar navigation (no individual boards listed in the nav). Empty boards page shows create prompt with template suggestions (KANB-18).

### Claude's Discretion
- Board header layout (compact toolbar vs rich header -- balance space with useful info)
- Card spacing and exact padding within columns
- Animation timing and easing for drag-and-drop
- Column collapse/expand animation
- Template preview content in the creation dialog
- Filter panel design for card filtering (label, assignee, due date)
- Card detail panel/dialog layout (for editing card description, checklists, comments)
- Checklist progress indicator style on card face
- Comment threading UI inside card detail

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| KANB-01 | User can create, edit, and delete custom Kanban boards with name, description, and color | Backend: KanbanBoard entity with TenantId, Name, Description, Color, Visibility, CreatorId. Frontend: Board CRUD dialog, BoardsController API |
| KANB-02 | User can add, rename, reorder, and delete columns on a board | Backend: KanbanColumn entity with BoardId, Name, SortOrder, WipLimit, Color. CDK drag-drop with horizontal orientation for column reorder |
| KANB-03 | User can create, edit, and archive cards with title, description, due date, and assignee | Backend: KanbanCard entity with ColumnId, Title, Description (HTML), DueDate, AssigneeId, SortOrder, IsArchived. Card CRUD endpoints |
| KANB-04 | User can drag-and-drop cards between columns and reorder within columns (optimistic UI) | CDK CdkDropListGroup + CdkDropList per column + CdkDrag per card. Optimistic transferArrayItem/moveItemInArray with API revert on failure (existing pattern from deal-kanban) |
| KANB-05 | User can set board visibility: Private, Team, Public | Backend: BoardVisibility enum (Private/Team/Public). Query filtering: Private = CreatorId match, Team = TeamId match, Public = all tenant users |
| KANB-06 | User can assign colored labels to cards for categorization | Backend: KanbanLabel entity (board-scoped) + KanbanCardLabel join table. Frontend: label color picker + label management in board settings |
| KANB-07 | User can assign a team member to a card (avatar displayed on card face) | Backend: KanbanCard.AssigneeId (nullable FK to ApplicationUser). Frontend: assignee picker dropdown, avatar initials display on card |
| KANB-08 | Cards display due date with urgency indicator (yellow approaching, red overdue) | Reuse urgency calculation pattern from deal-kanban (getDaysToClose/getCloseUrgency). Same CSS urgency classes |
| KANB-09 | Existing deal pipeline and activity boards appear as System Boards on unified boards page | Frontend: boards page shows "System Boards" section with hardcoded Deal Pipeline and Activity Board cards that route to existing kanban pages |
| KANB-10 | User can optionally link a card to any CRM entity | Backend: KanbanCard.LinkedEntityType (string) + LinkedEntityId (Guid?). Uses same polymorphic pattern as Note entity |
| KANB-11 | Entity-linked cards display entity name and icon, with click-to-preview via existing sidebar | Frontend: use ENTITY_TYPE_REGISTRY for icon/color lookup, PreviewSidebarStore.open() for click handler |
| KANB-12 | User can write rich text descriptions on cards via existing rich text editor | Frontend: embed existing RichTextEditorComponent (ngx-quill wrapper) in card detail panel. Backend stores HTML in Description field |
| KANB-13 | Columns display WIP limit with visual warning when exceeded | Backend: KanbanColumn.WipLimit (int?, nullable = no limit). Frontend: column header shows count/limit badge, warning color when count > limit |
| KANB-14 | User can create a board from predefined templates | Frontend: template definitions (Sprint, Content Calendar, Sales Follow-up) as const arrays of column configurations. Backend: board creation with pre-populated columns |
| KANB-15 | User can add checklist items to a card with progress indicator on card face | Backend: KanbanChecklist + KanbanChecklistItem entities. Frontend: checklist editor in card detail, progress bar/fraction on card face |
| KANB-16 | User can comment on cards with threaded discussion | Backend: KanbanCardComment entity (follows FeedComment/ActivityComment pattern). Frontend: comment list in card detail with add/reply |
| KANB-17 | User can filter visible cards by label, assignee, or due date | Frontend: filter panel with label chips, assignee dropdown, due date selector. Client-side filtering on loaded board data |
| KANB-18 | Empty boards page shows create prompt with template suggestions | Frontend: empty state component with Fraunces font heading, template suggestion cards, "Create Board" CTA |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @angular/cdk/drag-drop | 19.2.19 | Card and column drag-and-drop | Already used by deal-kanban, lead-kanban, activity-kanban. CdkDropListGroup + CdkDropList + CdkDrag proven pattern |
| @angular/material | 19.2.19 | Dialogs, menus, tooltips, buttons, chips, form fields | Already used throughout the project. MatDialog for board create/edit, MatMenu for card actions, MatChips for labels |
| @ngrx/signals | 19.2.1 | Board state management (BoardStore) | Project standard for per-page stores. signalStore + withState + withMethods pattern |
| ngx-quill | 27.1.2 | Rich text editor for card descriptions | Already wrapped in RichTextEditorComponent. Reuse existing component |
| @jsverse/transloco | 8.2.1 | i18n for all board UI strings | Project standard for translations. Lazy-loaded scope for boards feature |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @angular/cdk/scrolling | 19.2.19 | Virtual scrolling for boards with many cards | Use if columns with 50+ cards cause performance issues (can be deferred) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CDK drag-drop | @ng-dnd/core or ngx-drag-drop | CDK is already proven in 3 kanban views in this codebase; no reason to switch |
| Float-based SortOrder | Integer-based SortOrder | Float allows inserting between positions without reindexing; integer requires shifting all subsequent items. Float recommended for card positions |

**Installation:**
No new packages needed. All dependencies already installed.

## Architecture Patterns

### Recommended Backend Structure (New Entities)
```
src/GlobCRM.Domain/Entities/
├── KanbanBoard.cs              # Board with TenantId, Name, Description, Color, Visibility, CreatorId
├── KanbanColumn.cs             # Column with BoardId, Name, SortOrder, WipLimit, Color, IsCollapsed
├── KanbanCard.cs               # Card with ColumnId, Title, Description, DueDate, AssigneeId, SortOrder
├── KanbanLabel.cs              # Board-scoped label with Name, Color
├── KanbanCardLabel.cs          # Join table: CardId + LabelId
├── KanbanChecklistItem.cs      # Checklist item with CardId, Text, IsChecked, SortOrder
└── KanbanCardComment.cs        # Comment with CardId, Content, AuthorId, ParentCommentId (threading)

src/GlobCRM.Domain/Enums/
└── BoardVisibility.cs          # Private, Team, Public

src/GlobCRM.Api/Controllers/
└── BoardsController.cs         # Full REST API for boards, columns, cards, labels, checklists, comments
```

### Recommended Frontend Structure
```
globcrm-web/src/app/features/boards/
├── boards.routes.ts                 # Lazy-loaded routes: list + detail
├── boards.service.ts                # API service for all board endpoints
├── boards.models.ts                 # DTOs and interfaces
├── boards.store.ts                  # Per-page signal store for board detail state
├── boards-list/
│   ├── boards-list.component.ts     # Grid of board cards + system boards
│   ├── boards-list.component.html
│   └── boards-list.component.scss
├── board-detail/
│   ├── board-detail.component.ts    # Kanban board view with columns and cards
│   ├── board-detail.component.html
│   └── board-detail.component.scss
├── board-create-dialog/
│   ├── board-create-dialog.component.ts  # Create/edit board dialog with templates
│   └── board-create-dialog.component.html
├── card-detail-panel/
│   ├── card-detail-panel.component.ts    # Right-side slide panel for card editing
│   ├── card-detail-panel.component.html
│   └── card-detail-panel.component.scss
├── board-card/
│   └── board-card.component.ts      # Individual card component on the board
└── board-filter-panel/
    └── board-filter-panel.component.ts   # Filter by label/assignee/due date
```

### Pattern 1: Dual-Level Drag-and-Drop (Cards + Columns)
**What:** Two separate CdkDropList systems operating simultaneously -- one for cards within/across columns (vertical lists), one for columns themselves (horizontal list).
**When to use:** When both cards and columns need to be draggable.
**Implementation approach:**

For **card drag-drop** (within and across columns):
```typescript
// Board detail component
// CdkDropListGroup wraps all column bodies
// Each column body is a CdkDropList with vertical orientation
// Each card is a CdkDrag

@Component({
  imports: [CdkDropListGroup, CdkDropList, CdkDrag, CdkDragHandle, CdkDragPreview, CdkDragPlaceholder],
})
export class BoardDetailComponent {
  onCardDrop(event: CdkDragDrop<KanbanCardDto[]>, targetColumnId: string): void {
    if (event.previousContainer === event.container) {
      // Reorder within same column
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
      // API: PATCH /api/boards/{boardId}/cards/{cardId}/reorder
    } else {
      // Transfer between columns
      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex
      );
      // API: PATCH /api/boards/{boardId}/cards/{cardId}/move
      // Check WIP limit and show warning if exceeded
    }
  }
}
```

For **column drag-drop** (reordering columns):
```typescript
// Separate CdkDropList wrapping the column array
// orientation="horizontal", lockAxis="x"
// cdkDragHandle on the column header to initiate column drag

onColumnDrop(event: CdkDragDrop<KanbanColumnDto[]>): void {
  moveItemInArray(this.columns, event.previousIndex, event.currentIndex);
  // API: PATCH /api/boards/{boardId}/columns/reorder
}
```

**Key CDK properties used:**
- `CdkDropListGroup` -- groups all card drop lists so cards can transfer between columns
- `CdkDropList` with `orientation="horizontal"` -- for column reordering
- `CdkDragHandle` -- column header acts as drag handle for column reordering
- `CdkDragPreview` -- custom drag preview with rotation and shadow
- `CdkDragPlaceholder` -- gap/line placeholder showing insertion point
- `cdkDragLockAxis="x"` -- constrain column drag to horizontal axis

### Pattern 2: Float-Based SortOrder for Cards
**What:** Store card position as a `double` (float) instead of integer to allow insertion between existing cards without reindexing all subsequent cards.
**When to use:** High-frequency card reordering (drag-and-drop).
**Example:**
```csharp
// Cards at positions: 1.0, 2.0, 3.0
// Insert between 1.0 and 2.0: new position = 1.5
// Insert between 1.0 and 1.5: new position = 1.25
// After many insertions, run a periodic rebalance (normalize to integers)

public static double CalculateInsertPosition(double before, double after)
{
    return (before + after) / 2.0;
}

// Edge cases:
// Insert at start: position = firstCard.SortOrder / 2.0
// Insert at end: position = lastCard.SortOrder + 1.0
```

### Pattern 3: Board Visibility Filtering
**What:** Board visibility follows the Dashboard ownership pattern (Private/Team/Public) with query-level filtering.
**When to use:** All board list queries.
**Example:**
```csharp
// Similar to DashboardRepository.GetAllAsync pattern
public async Task<List<KanbanBoard>> GetBoardsForUser(Guid userId, Guid? teamId)
{
    return await _db.KanbanBoards
        .Where(b =>
            b.Visibility == BoardVisibility.Public ||
            (b.Visibility == BoardVisibility.Private && b.CreatorId == userId) ||
            (b.Visibility == BoardVisibility.Team && b.TeamId == teamId))
        .OrderBy(b => b.Name)
        .ToListAsync();
}
```

### Pattern 4: Optimistic Card Move with API Revert
**What:** Move card immediately in the UI, then call API. On error, revert the move.
**When to use:** All card drag-and-drop operations.
**Source:** Existing deal-kanban.component.ts pattern, verified in codebase.
```typescript
onCardDrop(event: CdkDragDrop<CardDto[]>, targetColumnId: string): void {
  const card = event.previousContainer.data[event.previousIndex];
  const sourceColumnId = event.previousContainer.id;

  // Optimistic: move immediately
  transferArrayItem(
    event.previousContainer.data,
    event.container.data,
    event.previousIndex,
    event.currentIndex,
  );

  // Calculate new sort order
  const newSortOrder = this.calculateSortOrder(event.container.data, event.currentIndex);

  // API call
  this.boardService.moveCard(card.id, targetColumnId, newSortOrder).subscribe({
    error: () => {
      // Revert on failure
      transferArrayItem(
        event.container.data,
        event.previousContainer.data,
        event.currentIndex,
        event.previousIndex,
      );
      this.snackBar.open('Failed to move card', 'Dismiss', { duration: 3000 });
    },
  });

  // WIP limit warning (non-blocking)
  this.checkWipLimit(targetColumnId);
}
```

### Pattern 5: Card Detail as Right-Side Slide Panel
**What:** Card editing opens a slide-in panel from the right (not a modal dialog) to maintain board context.
**When to use:** Opening a card for editing description, checklists, comments.
**Design choice rationale:** Phase 29 used a template-driven right-side drawer with CSS transform slide animation for the integration detail panel. This same pattern works for card detail. The board remains visible behind the panel, providing context.
```typescript
// Card detail panel slides in from right, similar to integration-detail-panel
// Contains: title editor, description (RichTextEditorComponent), labels, due date,
//           assignee, checklists, comments, entity link, archive button
```

### Pattern 6: Entity Linking (Polymorphic Reference)
**What:** Cards link to any CRM entity via EntityType (string) + EntityId (Guid) -- same pattern used by Note entity.
**When to use:** KANB-10, KANB-11.
**Source:** Note.cs entity in codebase.
```csharp
// On KanbanCard entity:
public string? LinkedEntityType { get; set; }  // "Contact", "Company", "Deal", etc.
public Guid? LinkedEntityId { get; set; }
public string? LinkedEntityName { get; set; }   // Denormalized for display

// Frontend: use ENTITY_TYPE_REGISTRY for icon/color, PreviewSidebarStore.open() for click
```

### Anti-Patterns to Avoid
- **Anti-pattern: Nested CdkDropListGroup for both card and column drag.** CDK does not support nested CdkDropListGroups well. Use a single CdkDropListGroup for cards and a separate CdkDropList (not in a group) for columns. Column drag and card drag operate on different levels.
- **Anti-pattern: Integer SortOrder with OFFSET-based reindexing.** Every card move would require updating SortOrder for all subsequent cards in the target column. Use float-based positions instead.
- **Anti-pattern: Loading full board data on every card move.** Use targeted PATCH endpoints that return only the affected card/column, not the entire board.
- **Anti-pattern: Real-time SignalR sync for multi-user board editing.** This is a v1 implementation. Multi-user real-time sync adds significant complexity. Use last-write-wins with optimistic refresh instead. Real-time can be added later.
- **Anti-pattern: Storing label colors as hex strings on cards.** Labels are board-scoped entities with their own color. Cards reference labels via a join table (KanbanCardLabel). This allows renaming/recoloring a label to update all cards.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Drag-and-drop | Custom mouse/touch event handlers | Angular CDK drag-drop | Already proven in 3 kanban views in this codebase. Handles touch, accessibility, auto-scroll, animations |
| Rich text editing | Custom contenteditable implementation | Existing RichTextEditorComponent (ngx-quill) | Already built and integrated with Angular forms |
| Entity preview sidebar | New preview component | Existing PreviewSidebarStore + EntityPreviewSidebarComponent | Already handles all entity types with breadcrumb navigation |
| Card sort order calculation | Manual position tracking | Float-based midpoint calculation | Simple math, avoids N+1 updates on reorder |
| Column collapse animation | Manual height animation | CSS transition on max-height or Angular animation | CSS transitions are simpler and more performant for height collapse |

**Key insight:** The project already has 80%+ of the building blocks: CDK drag-drop (3 kanban views), rich text editor, entity preview sidebar, signal stores, transloco i18n, and the "Warm Modern" design system. This phase is primarily about composing these existing pieces into a new feature domain.

## Common Pitfalls

### Pitfall 1: CDK Drag-Drop Performance with Many Cards
**What goes wrong:** With 100+ cards visible across columns, CDK drag-drop calculations slow down, causing jank during drag operations.
**Why it happens:** CDK recalculates positions for all items in connected drop lists during drag.
**How to avoid:** 1) Lazy-load cards per column (load first 20, expand on scroll). 2) Use `trackBy` with card ID in `@for` loops. 3) Consider virtual scrolling within columns if boards grow very large (defer to future optimization if not immediately needed).
**Warning signs:** Drag operations feel sluggish, frame drops during drag-over animations.

### Pitfall 2: Float SortOrder Precision Loss
**What goes wrong:** After many insertions between the same two cards, floating-point precision becomes insufficient (positions like 1.000000000001 and 1.000000000002).
**Why it happens:** Repeatedly halving the gap between two floats.
**How to avoid:** Implement a "rebalance" operation that renormalizes sort orders to integers (1, 2, 3, ...) when the minimum gap drops below a threshold (e.g., 0.001). Trigger automatically server-side after moves, or as a periodic cleanup.
**Warning signs:** Cards appearing in wrong order, sort instability.

### Pitfall 3: Column-Level vs Card-Level Drag Conflicts
**What goes wrong:** CDK interprets a card drag as a column drag, or vice versa, when both are draggable.
**Why it happens:** Without explicit drag handles, any click-drag on a column header could trigger either column drag or card drag.
**How to avoid:** Use `cdkDragHandle` on the column header area for column dragging. Card `cdkDrag` elements are inside the column body (not the header). The column header has a dedicated drag grip icon as the handle.
**Warning signs:** Attempting to drag a card near the column header triggers column movement.

### Pitfall 4: Orphaned Cards on Column Delete
**What goes wrong:** Deleting a column leaves cards in the database with no parent column.
**Why it happens:** Cascade delete not configured, or API doesn't handle card reassignment.
**How to avoid:** Two options: 1) Cascade delete all cards in the column (simpler), or 2) Require moving cards to another column before deletion (better UX). For v1, require the column to be empty before deletion, or move all cards to the first remaining column. Configure EF Core cascade delete as a safety net.
**Warning signs:** 404 errors when loading cards that reference deleted columns.

### Pitfall 5: Board Visibility Leaking Data
**What goes wrong:** Users see cards/boards they shouldn't have access to.
**Why it happens:** Visibility filter not applied consistently across all endpoints (board list, board detail, card operations).
**How to avoid:** Apply visibility check at the repository level (not just the list endpoint). Every endpoint that accepts a boardId should verify the calling user has access via visibility rules. Use a shared `CanAccessBoard(boardId, userId)` method.
**Warning signs:** Users seeing "Forbidden" errors after navigating to a shared link, or worse, seeing private boards.

### Pitfall 6: Optimistic UI Desync on Rapid Moves
**What goes wrong:** User drags cards rapidly, creating a queue of API calls. If an early call fails while later calls succeed, the UI state becomes inconsistent.
**Why it happens:** Multiple concurrent optimistic updates to the same data structure.
**How to avoid:** For card moves, serialize API calls (wait for one to complete before processing the next) OR use a debounce/batch approach for rapid sequential moves. The existing deal-kanban uses simple subscribe without serialization, which works for infrequent moves. For Kanban boards where rapid drag-and-drop is more common, consider a queue.
**Warning signs:** Cards appearing in unexpected positions after rapid drag-and-drop.

## Code Examples

### Entity Design: KanbanBoard
```csharp
// Follows Dashboard entity pattern for ownership/visibility
public class KanbanBoard
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Color { get; set; }  // Hex color for board accent
    public BoardVisibility Visibility { get; set; } = BoardVisibility.Private;
    public Guid CreatorId { get; set; }
    public Guid? TeamId { get; set; }   // Required when Visibility == Team
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    public bool IsSeedData { get; set; }

    // Navigation
    public ApplicationUser? Creator { get; set; }
    public Team? Team { get; set; }
    public ICollection<KanbanColumn> Columns { get; set; } = new List<KanbanColumn>();
    public ICollection<KanbanLabel> Labels { get; set; } = new List<KanbanLabel>();
}
```

### Entity Design: KanbanColumn
```csharp
// Child entity of KanbanBoard -- inherits tenant isolation via BoardId FK
public class KanbanColumn
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid BoardId { get; set; }
    public string Name { get; set; } = string.Empty;
    public double SortOrder { get; set; }
    public int? WipLimit { get; set; }  // Null = no limit
    public string? Color { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    // Navigation
    public KanbanBoard Board { get; set; } = null!;
    public ICollection<KanbanCard> Cards { get; set; } = new List<KanbanCard>();
}
```

### Entity Design: KanbanCard
```csharp
// Child entity of KanbanColumn -- inherits tenant isolation via Column -> Board FK chain
public class KanbanCard
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ColumnId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }  // HTML from rich text editor
    public DateTimeOffset? DueDate { get; set; }
    public Guid? AssigneeId { get; set; }
    public double SortOrder { get; set; }  // Float-based for insertion
    public bool IsArchived { get; set; }

    // Polymorphic entity link (same pattern as Note entity)
    public string? LinkedEntityType { get; set; }
    public Guid? LinkedEntityId { get; set; }
    public string? LinkedEntityName { get; set; }  // Denormalized

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    // Navigation
    public KanbanColumn Column { get; set; } = null!;
    public ApplicationUser? Assignee { get; set; }
    public ICollection<KanbanCardLabel> Labels { get; set; } = new List<KanbanCardLabel>();
    public ICollection<KanbanChecklistItem> ChecklistItems { get; set; } = new List<KanbanChecklistItem>();
    public ICollection<KanbanCardComment> Comments { get; set; } = new List<KanbanCardComment>();
}
```

### Entity Design: KanbanLabel and KanbanCardLabel
```csharp
// Board-scoped label
public class KanbanLabel
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid BoardId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Color { get; set; } = "#F97316";  // Default orange
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    // Navigation
    public KanbanBoard Board { get; set; } = null!;
    public ICollection<KanbanCardLabel> CardLabels { get; set; } = new List<KanbanCardLabel>();
}

// Join table (no TenantId -- inherits via Label -> Board FK chain)
public class KanbanCardLabel
{
    public Guid CardId { get; set; }
    public Guid LabelId { get; set; }
    public KanbanCard Card { get; set; } = null!;
    public KanbanLabel Label { get; set; } = null!;
}
```

### Entity Design: KanbanChecklistItem
```csharp
// Child of KanbanCard -- inherits tenant isolation via Card -> Column -> Board chain
public class KanbanChecklistItem
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid CardId { get; set; }
    public string Text { get; set; } = string.Empty;
    public bool IsChecked { get; set; }
    public double SortOrder { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    // Navigation
    public KanbanCard Card { get; set; } = null!;
}
```

### Entity Design: KanbanCardComment
```csharp
// Follows FeedComment/ActivityComment pattern
// Child of KanbanCard -- inherits tenant isolation via Card -> Column -> Board chain
public class KanbanCardComment
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid CardId { get; set; }
    public string Content { get; set; } = string.Empty;
    public Guid? AuthorId { get; set; }
    public Guid? ParentCommentId { get; set; }  // For threading

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    // Navigation
    public KanbanCard Card { get; set; } = null!;
    public ApplicationUser? Author { get; set; }
    public KanbanCardComment? ParentComment { get; set; }
    public ICollection<KanbanCardComment> Replies { get; set; } = new List<KanbanCardComment>();
}
```

### Board Visibility Enum
```csharp
public enum BoardVisibility
{
    Private,  // Only the creator can see/edit
    Team,     // Team members can see/edit
    Public    // All tenant users can see/edit
}
```

### Frontend: Board Store Pattern
```typescript
// Per-page store (component-provided), follows DealStore pattern
export const BoardStore = signalStore(
  withState({
    board: null as BoardDetailDto | null,
    isLoading: false,
    cardFilter: { labels: [], assigneeId: null, dueDateRange: null } as CardFilter,
    isCardPanelOpen: false,
    selectedCardId: null as string | null,
  }),
  withMethods((store) => {
    const boardService = inject(BoardsService);
    return {
      loadBoard(boardId: string): void { /* ... */ },
      moveCard(cardId: string, targetColumnId: string, sortOrder: number): void { /* ... */ },
      reorderColumns(columnOrder: string[]): void { /* ... */ },
      openCard(cardId: string): void { /* ... */ },
      // etc.
    };
  })
);
```

### Frontend: CDK Drag Preview with Rotation
```html
<!-- Card drag preview (lifted with rotation) -->
<div *cdkDragPreview class="card-drag-preview">
  <div class="card-preview-title">{{ card.title }}</div>
  @if (card.dueDate) {
    <span class="card-preview-due">{{ card.dueDate | date:'MMM d' }}</span>
  }
</div>

<!-- Card drag placeholder (gap/line) -->
<div *cdkDragPlaceholder class="card-drag-placeholder"></div>
```
```scss
.card-drag-preview {
  background: var(--color-surface);
  border-radius: var(--radius-md);
  padding: var(--space-3);
  box-shadow: var(--shadow-xl);
  transform: scale(1.02) rotate(2deg);  // Lifted + slight rotation per user decision
  border: 1px solid var(--color-border);
  opacity: 0.95;
  max-width: 280px;
}

.card-drag-placeholder {
  background: color-mix(in srgb, var(--color-primary) 8%, transparent);
  border: 2px dashed color-mix(in srgb, var(--color-primary) 40%, transparent);
  border-radius: var(--radius-md);
  min-height: 40px;
  margin-bottom: var(--space-2);
}
```

### Frontend: Navigation Addition
```typescript
// In navbar.component.ts navGroups, add to "Work" group:
{
  label: 'nav.groups.work',
  items: [
    { route: '/activities', icon: 'task_alt', label: 'nav.activities' },
    { route: '/boards', icon: 'view_kanban', label: 'nav.boards' },  // NEW
    { route: '/quotes', icon: 'request_quote', label: 'nav.quotes' },
    { route: '/requests', icon: 'support_agent', label: 'nav.requests' },
    { route: '/notes', icon: 'note', label: 'nav.notes' },
  ]
},
```

### Backend: Board API Endpoints
```
GET    /api/boards                          → List boards (filtered by visibility)
POST   /api/boards                          → Create board (with optional template columns)
GET    /api/boards/{id}                     → Get board detail (columns + cards + labels)
PUT    /api/boards/{id}                     → Update board (name, description, color, visibility)
DELETE /api/boards/{id}                     → Delete board (cascade columns/cards)
POST   /api/boards/{id}/columns             → Add column
PUT    /api/boards/{id}/columns/{colId}     → Update column (name, WIP limit, color)
DELETE /api/boards/{id}/columns/{colId}     → Delete column (must be empty or cascade)
PATCH  /api/boards/{id}/columns/reorder     → Reorder columns (array of IDs)
POST   /api/boards/{id}/cards               → Create card
PUT    /api/boards/{id}/cards/{cardId}      → Update card
PATCH  /api/boards/{id}/cards/{cardId}/move → Move card (targetColumnId, sortOrder)
PATCH  /api/boards/{id}/cards/{cardId}/archive → Archive card
POST   /api/boards/{id}/labels              → Create label
PUT    /api/boards/{id}/labels/{labelId}    → Update label
DELETE /api/boards/{id}/labels/{labelId}    → Delete label
POST   /api/boards/{id}/cards/{cardId}/labels/{labelId}    → Add label to card
DELETE /api/boards/{id}/cards/{cardId}/labels/{labelId}    → Remove label from card
POST   /api/boards/{id}/cards/{cardId}/checklist           → Add checklist item
PUT    /api/boards/{id}/cards/{cardId}/checklist/{itemId}  → Update checklist item
DELETE /api/boards/{id}/cards/{cardId}/checklist/{itemId}  → Delete checklist item
PATCH  /api/boards/{id}/cards/{cardId}/checklist/{itemId}/toggle → Toggle checked
GET    /api/boards/{id}/cards/{cardId}/comments            → Get comments (threaded)
POST   /api/boards/{id}/cards/{cardId}/comments            → Add comment
PUT    /api/boards/{id}/cards/{cardId}/comments/{commentId} → Update comment
DELETE /api/boards/{id}/cards/{cardId}/comments/{commentId} → Delete comment
```

### Board Templates (Frontend Constants)
```typescript
export interface BoardTemplate {
  key: string;
  nameKey: string;      // transloco key
  descriptionKey: string;
  icon: string;
  columns: { name: string; wipLimit?: number }[];
}

export const BOARD_TEMPLATES: BoardTemplate[] = [
  {
    key: 'sprint',
    nameKey: 'boards.templates.sprint.name',
    descriptionKey: 'boards.templates.sprint.description',
    icon: 'sprint',
    columns: [
      { name: 'Backlog' },
      { name: 'To Do', wipLimit: 5 },
      { name: 'In Progress', wipLimit: 3 },
      { name: 'Review', wipLimit: 2 },
      { name: 'Done' },
    ],
  },
  {
    key: 'content',
    nameKey: 'boards.templates.content.name',
    descriptionKey: 'boards.templates.content.description',
    icon: 'edit_note',
    columns: [
      { name: 'Ideas' },
      { name: 'Writing' },
      { name: 'Editing' },
      { name: 'Scheduled' },
      { name: 'Published' },
    ],
  },
  {
    key: 'sales',
    nameKey: 'boards.templates.sales.name',
    descriptionKey: 'boards.templates.sales.description',
    icon: 'phone_callback',
    columns: [
      { name: 'To Contact' },
      { name: 'Contacted' },
      { name: 'Follow Up' },
      { name: 'Meeting Set' },
      { name: 'Closed' },
    ],
  },
];
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| sortablejs / ng2-dragula | Angular CDK drag-drop | Angular 7+ (2018) | CDK is the official Angular solution, maintained alongside Angular |
| Integer sort orders with full reindex | Float-based or lexicographic sort keys | 2020+ industry trend | Eliminates N+1 reorder updates |
| Full-page modals for card detail | Right-side slide panel / overlay | Trello/Notion trend 2021+ | Maintains board context while editing card |
| Separate kanban page per entity | Unified boards page with system + custom boards | Modern CRM pattern | Single entry point for all board-type views |

**Deprecated/outdated:**
- `@angular/cdk` sortable module (does not exist; drag-drop is the module to use)
- `ng2-dragula` / `sortablejs` for Angular -- CDK drag-drop is the standard

## Open Questions

1. **TeamId for Team visibility boards**
   - What we know: BoardVisibility.Team requires knowing which team to scope to. The Team entity already exists with TeamMember join table.
   - What's unclear: Should the creator pick a team when setting Team visibility, or should it default to their primary team?
   - Recommendation: Board creation dialog includes a team selector dropdown when Team visibility is selected. This is straightforward and explicit.

2. **Should archived cards be queryable?**
   - What we know: KANB-03 says cards can be archived. IsArchived boolean on the card entity.
   - What's unclear: Should there be an "Archived Cards" view per board, or are archived cards just hidden with no retrieval UI?
   - Recommendation: Archived cards are hidden from the board by default. A board-level toggle or filter option "Show archived" reveals them in a separate visual style (grayed out). Keep it simple for v1.

3. **Card position persistence granularity**
   - What we know: Cards need a SortOrder within their column. Moving a card to a different column changes both ColumnId and SortOrder.
   - What's unclear: Should the move API accept only the target column + position, or should it accept the full reordered card list?
   - Recommendation: PATCH endpoint accepts `{ targetColumnId, sortOrder }` for the moved card only. The float-based sort order means no other cards need updating. This is simpler and matches the optimistic UI pattern.

## Sources

### Primary (HIGH confidence)
- `/angular/components` via Context7 -- CDK drag-drop API (CdkDropList, CdkDrag, CdkDragHandle, CdkDragPreview, CdkDragPlaceholder, moveItemInArray, transferArrayItem, orientation, lockAxis, sortPredicate, enterPredicate)
- Existing codebase: `deal-kanban.component.ts`, `lead-kanban.component.ts`, `activity-kanban.component.ts` -- proven CDK drag-drop patterns with optimistic UI
- Existing codebase: `Note.cs` -- polymorphic entity linking pattern (EntityType + EntityId)
- Existing codebase: `Dashboard.cs` -- ownership/visibility pattern (OwnerId, team-wide)
- Existing codebase: `FeedComment.cs`, `ActivityComment.cs` -- comment entity patterns
- Existing codebase: `RichTextEditorComponent` -- ngx-quill rich text editor wrapper
- Existing codebase: `PreviewSidebarStore` -- entity preview sidebar for entity-linked cards
- Existing codebase: `entity-type-registry.ts` -- entity icon/color/route registry
- Existing codebase: `navbar.component.ts` -- navigation structure (NavGroup/NavItem)
- Existing codebase: `DashboardsController.cs` -- similar CRUD pattern with ownership

### Secondary (MEDIUM confidence)
- Float-based sort order pattern -- widely used in Trello, Notion, Linear. Well-documented approach for avoiding N+1 reindex on reorder operations.

### Tertiary (LOW confidence)
- None -- all findings verified through codebase patterns or official Angular CDK docs.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in use in the project, no new dependencies needed
- Architecture: HIGH -- entity patterns follow existing codebase conventions (Dashboard, Note, FeedComment), CDK drag-drop patterns verified in 3 existing kanban views
- Pitfalls: HIGH -- identified from CDK drag-drop experience in codebase and well-known issues with float sort orders and dual-level drag
- Frontend patterns: HIGH -- all based on existing project patterns (signal stores, transloco, design system tokens)

**Research date:** 2026-02-21
**Valid until:** 2026-03-21 (stable -- no fast-moving dependencies)

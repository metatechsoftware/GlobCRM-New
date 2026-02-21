import {
  Component,
  ChangeDetectionStrategy,
  inject,
  input,
  signal,
  effect,
  computed,
} from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import {
  CdkDropListGroup,
  CdkDropList,
  CdkDrag,
  CdkDragDrop,
  CdkDragHandle,
  CdkDragPreview,
  CdkDragPlaceholder,
  moveItemInArray,
  transferArrayItem,
} from '@angular/cdk/drag-drop';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { BoardStore } from '../boards.store';
import { BoardCardComponent } from '../board-card/board-card.component';
import { CardDetailPanelComponent } from '../card-detail-panel/card-detail-panel.component';
import { BoardFilterPanelComponent, AssigneeOption } from '../board-filter-panel/board-filter-panel.component';
import { ColumnDto, CardDto, CardFilter } from '../boards.models';

/**
 * Board detail component — the core kanban board view.
 * Displays columns with draggable cards and supports dual-level CDK drag-and-drop:
 * cards within/across columns and column reordering.
 */
@Component({
  selector: 'app-board-detail',
  standalone: true,
  imports: [
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatMenuModule,
    MatTooltipModule,
    MatProgressBarModule,
    CdkDropListGroup,
    CdkDropList,
    CdkDrag,
    CdkDragHandle,
    CdkDragPreview,
    CdkDragPlaceholder,
    TranslocoPipe,
    BoardCardComponent,
    CardDetailPanelComponent,
    BoardFilterPanelComponent,
  ],
  templateUrl: './board-detail.component.html',
  styleUrl: './board-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BoardDetailComponent {
  readonly boardStore = inject(BoardStore);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly transloco = inject(TranslocoService);

  /** Route param bound via withComponentInputBinding */
  readonly id = input.required<string>();

  /** Board data from store */
  readonly board = this.boardStore.board;
  readonly isLoading = this.boardStore.isLoading;

  /** Inline editing states */
  readonly editingBoardName = signal(false);
  readonly editBoardNameValue = signal('');
  readonly editingColumnId = signal<string | null>(null);
  readonly editColumnNameValue = signal('');

  /** New column inline input */
  readonly addingColumn = signal(false);
  readonly newColumnName = signal('');

  /** New card inline input per column */
  readonly addingCardColumnId = signal<string | null>(null);
  readonly newCardTitle = signal('');

  /** Description expanded state */
  readonly descriptionExpanded = signal(false);

  /** Collapsed columns (local UI state, also synced to store) */
  readonly collapsedColumns = signal<Set<string>>(new Set());

  /** Filter panel open state */
  readonly isFilterOpen = signal(false);

  /** Card filter from store */
  readonly cardFilter = this.boardStore.cardFilter;

  /** Active filter count for badge */
  readonly activeFilterCount = computed(() => {
    const f = this.cardFilter();
    let count = 0;
    if (f.labels.length > 0) count++;
    if (f.assigneeId !== null) count++;
    if (f.dueDateRange !== null && f.dueDateRange !== 'all') count++;
    return count;
  });

  /** Whether any filter is active */
  readonly hasActiveFilters = computed(() => this.activeFilterCount() > 0);

  /** Extract unique assignees from all board cards */
  readonly boardAssignees = computed<AssigneeOption[]>(() => {
    const board = this.board();
    if (!board) return [];
    const map = new Map<string, string>();
    let hasUnassigned = false;
    for (const col of board.columns) {
      for (const card of col.cards) {
        if (card.assigneeId && card.assigneeName) {
          map.set(card.assigneeId, card.assigneeName);
        } else if (!card.assigneeId) {
          hasUnassigned = true;
        }
      }
    }
    const options: AssigneeOption[] = [];
    if (hasUnassigned) {
      options.push({ id: null, name: this.transloco.translate('boards.cardDetail.unassigned') });
    }
    map.forEach((name, id) => options.push({ id, name }));
    return options;
  });

  /** Column IDs for CdkDropList connection */
  readonly columnDropListIds = computed(() => {
    const board = this.board();
    if (!board) return [];
    return board.columns.map((c) => 'col-' + c.id);
  });

  constructor() {
    // Load board when route param changes
    effect(() => {
      const boardId = this.id();
      if (boardId) {
        this.boardStore.loadBoard(boardId);
      }
    });

    // Sync collapsed state from board data
    effect(() => {
      const board = this.board();
      if (board) {
        const collapsed = new Set<string>();
        board.columns.forEach((col) => {
          if (col.isCollapsed) collapsed.add(col.id);
        });
        this.collapsedColumns.set(collapsed);
      }
    });
  }

  // ---- Navigation ----

  goBack(): void {
    this.router.navigate(['/boards']);
  }

  // ---- Board Name Inline Edit ----

  startEditBoardName(): void {
    const board = this.board();
    if (!board) return;
    this.editBoardNameValue.set(board.name);
    this.editingBoardName.set(true);
  }

  saveBoardName(): void {
    const board = this.board();
    const name = this.editBoardNameValue().trim();
    if (!board || !name || name === board.name) {
      this.editingBoardName.set(false);
      return;
    }
    this.boardStore.updateBoard(
      board.id,
      { name, description: board.description, color: board.color, visibility: board.visibility },
      () => this.editingBoardName.set(false),
      () => {
        this.snackBar.open(this.transloco.translate('boards.snackbar.error'), '', { duration: 3000 });
        this.editingBoardName.set(false);
      },
    );
  }

  cancelEditBoardName(): void {
    this.editingBoardName.set(false);
  }

  // ---- Delete Board ----

  deleteBoard(): void {
    const board = this.board();
    if (!board) return;
    const message = this.transloco.translate('boards.delete.message');
    if (!confirm(message)) return;
    this.boardStore.deleteBoard(
      board.id,
      () => {
        this.snackBar.open(this.transloco.translate('boards.snackbar.deleted'), '', { duration: 3000 });
        this.router.navigate(['/boards']);
      },
      () => {
        this.snackBar.open(this.transloco.translate('boards.snackbar.error'), '', { duration: 3000 });
      },
    );
  }

  // ---- Column Management ----

  startAddColumn(): void {
    this.addingColumn.set(true);
    this.newColumnName.set('');
  }

  saveNewColumn(): void {
    const board = this.board();
    const name = this.newColumnName().trim();
    if (!board || !name) {
      this.addingColumn.set(false);
      return;
    }
    this.boardStore.createColumn(
      board.id,
      { name },
      () => {
        this.addingColumn.set(false);
        this.newColumnName.set('');
      },
      () => {
        this.snackBar.open(this.transloco.translate('boards.snackbar.error'), '', { duration: 3000 });
      },
    );
  }

  cancelAddColumn(): void {
    this.addingColumn.set(false);
    this.newColumnName.set('');
  }

  startEditColumnName(col: ColumnDto): void {
    this.editingColumnId.set(col.id);
    this.editColumnNameValue.set(col.name);
  }

  saveColumnName(col: ColumnDto): void {
    const board = this.board();
    const name = this.editColumnNameValue().trim();
    if (!board || !name || name === col.name) {
      this.editingColumnId.set(null);
      return;
    }
    this.boardStore.updateColumn(
      board.id,
      col.id,
      { name, wipLimit: col.wipLimit, color: col.color },
      () => this.editingColumnId.set(null),
      () => {
        this.snackBar.open(this.transloco.translate('boards.snackbar.error'), '', { duration: 3000 });
        this.editingColumnId.set(null);
      },
    );
  }

  cancelEditColumnName(): void {
    this.editingColumnId.set(null);
  }

  deleteColumn(col: ColumnDto): void {
    const board = this.board();
    if (!board) return;
    const message = this.transloco.translate('boards.detail.deleteColumnConfirm');
    if (!confirm(message)) return;
    this.boardStore.deleteColumn(
      board.id,
      col.id,
      () => {},
      () => {
        this.snackBar.open(this.transloco.translate('boards.snackbar.error'), '', { duration: 3000 });
      },
    );
  }

  setWipLimit(col: ColumnDto): void {
    const input = prompt(this.transloco.translate('boards.detail.wipLimitPrompt'), col.wipLimit?.toString() ?? '');
    if (input === null) return;
    const board = this.board();
    if (!board) return;
    const wipLimit = input.trim() === '' ? null : parseInt(input, 10);
    if (wipLimit !== null && isNaN(wipLimit)) return;
    this.boardStore.updateColumn(
      board.id,
      col.id,
      { name: col.name, wipLimit, color: col.color },
      () => {},
      () => {
        this.snackBar.open(this.transloco.translate('boards.snackbar.error'), '', { duration: 3000 });
      },
    );
  }

  toggleColumnCollapse(col: ColumnDto): void {
    const collapsed = new Set(this.collapsedColumns());
    if (collapsed.has(col.id)) {
      collapsed.delete(col.id);
    } else {
      collapsed.add(col.id);
    }
    this.collapsedColumns.set(collapsed);
    this.boardStore.toggleColumnCollapse(col.id);
  }

  isColumnCollapsed(colId: string): boolean {
    return this.collapsedColumns().has(colId);
  }

  isWipExceeded(col: ColumnDto): boolean {
    return col.wipLimit != null && col.cards.length >= col.wipLimit;
  }

  // ---- Card Management ----

  startAddCard(colId: string): void {
    this.addingCardColumnId.set(colId);
    this.newCardTitle.set('');
  }

  saveNewCard(colId: string): void {
    const board = this.board();
    const title = this.newCardTitle().trim();
    if (!board || !title) {
      this.addingCardColumnId.set(null);
      return;
    }
    this.boardStore.createCard(
      board.id,
      { columnId: colId, title },
      () => {
        this.addingCardColumnId.set(null);
        this.newCardTitle.set('');
      },
      () => {
        this.snackBar.open(this.transloco.translate('boards.snackbar.error'), '', { duration: 3000 });
      },
    );
  }

  cancelAddCard(): void {
    this.addingCardColumnId.set(null);
    this.newCardTitle.set('');
  }

  onCardClicked(cardId: string): void {
    this.boardStore.openCardPanel(cardId);
  }

  onCardArchived(cardId: string): void {
    const board = this.board();
    if (!board) return;
    this.boardStore.archiveCard(
      board.id,
      cardId,
      () => {},
      () => {
        this.snackBar.open(this.transloco.translate('boards.snackbar.error'), '', { duration: 3000 });
      },
    );
  }

  // ---- Card Drag-and-Drop ----

  onCardDrop(event: CdkDragDrop<CardDto[]>, targetColumn: ColumnDto): void {
    const board = this.board();
    if (!board) return;

    if (event.previousContainer === event.container) {
      // Reorder within same column
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
      const newSortOrder = this.calculateSortOrder(event.container.data, event.currentIndex);
      const card = event.container.data[event.currentIndex];
      this.boardStore.moveCard(
        board.id,
        card.id,
        { targetColumnId: targetColumn.id, sortOrder: newSortOrder },
        targetColumn.id,
        event.previousIndex,
        event.currentIndex,
      );
    } else {
      // Move between columns
      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex,
      );
      const newSortOrder = this.calculateSortOrder(event.container.data, event.currentIndex);
      const card = event.container.data[event.currentIndex];

      // Extract source column ID
      const sourceColId = event.previousContainer.id.replace('col-', '');

      this.boardStore.moveCard(
        board.id,
        card.id,
        { targetColumnId: targetColumn.id, sortOrder: newSortOrder },
        sourceColId,
        event.previousIndex,
        event.currentIndex,
      );

      // WIP limit warning after drop
      if (targetColumn.wipLimit != null && event.container.data.length > targetColumn.wipLimit) {
        this.snackBar.open(
          this.transloco.translate('boards.detail.wipExceeded'),
          '',
          { duration: 3000 },
        );
      }
    }
  }

  // ---- Column Drag-and-Drop ----

  onColumnDrop(event: CdkDragDrop<ColumnDto[]>): void {
    const board = this.board();
    if (!board) return;
    if (event.previousIndex === event.currentIndex) return;

    const columns = [...board.columns];
    moveItemInArray(columns, event.previousIndex, event.currentIndex);
    const columnIds = columns.map((c) => c.id);
    this.boardStore.reorderColumns(board.id, { columnIds });
  }

  // ---- Helpers ----

  /**
   * Calculate sort order using float midpoint strategy.
   * Edge cases: first position = first/2, last position = last + 1.0
   */
  private calculateSortOrder(cards: CardDto[], index: number): number {
    if (cards.length <= 1) return 1.0;
    if (index === 0) {
      const next = cards[1];
      return next ? next.sortOrder / 2 : 1.0;
    }
    if (index === cards.length - 1) {
      const prev = cards[index - 1];
      return prev ? prev.sortOrder + 1.0 : 1.0;
    }
    const prev = cards[index - 1];
    const next = cards[index + 1];
    return prev && next ? (prev.sortOrder + next.sortOrder) / 2 : 1.0;
  }

  // ---- Filter Management ----

  toggleFilterPanel(): void {
    this.isFilterOpen.update((v) => !v);
  }

  onFilterChanged(filter: CardFilter): void {
    this.boardStore.setCardFilter(filter);
  }

  onClearFilters(): void {
    this.boardStore.clearCardFilter();
  }

  /** Check if a card matches the active filters */
  isCardVisible(card: CardDto): boolean {
    const filter = this.cardFilter();

    // Label filter (OR logic)
    if (filter.labels.length > 0) {
      const cardLabelIds = card.labels.map((l) => l.labelId);
      if (!filter.labels.some((id) => cardLabelIds.includes(id))) {
        return false;
      }
    }

    // Assignee filter
    if (filter.assigneeId !== undefined && filter.assigneeId !== null) {
      if (card.assigneeId !== filter.assigneeId) return false;
    } else if (filter.assigneeId === null && this.hasActiveFilters()) {
      // Only apply "unassigned" filter when explicitly selected
      // Since null is the default, we need to check if assignee filter is actually active
      // This is handled by the filter panel — null means "Unassigned" was explicitly picked
    }

    // Due date filter
    if (filter.dueDateRange && filter.dueDateRange !== 'all') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (filter.dueDateRange === 'overdue') {
        if (!card.dueDate) return false;
        const due = new Date(card.dueDate);
        due.setHours(0, 0, 0, 0);
        if (due >= today) return false;
      } else if (filter.dueDateRange === 'today') {
        if (!card.dueDate) return false;
        const due = new Date(card.dueDate);
        due.setHours(0, 0, 0, 0);
        if (due.getTime() !== today.getTime()) return false;
      } else if (filter.dueDateRange === 'week') {
        if (!card.dueDate) return false;
        const due = new Date(card.dueDate);
        due.setHours(0, 0, 0, 0);
        const weekEnd = new Date(today);
        weekEnd.setDate(weekEnd.getDate() + 7);
        if (due < today || due > weekEnd) return false;
      }
    }

    return true;
  }

  /** Get visible card count for a column */
  getVisibleCardCount(col: ColumnDto): number {
    if (!this.hasActiveFilters()) return col.cards.length;
    return col.cards.filter((c) => this.isCardVisible(c)).length;
  }

  trackColumnById(_index: number, col: ColumnDto): string {
    return col.id;
  }

  trackCardById(_index: number, card: CardDto): string {
    return card.id;
  }
}

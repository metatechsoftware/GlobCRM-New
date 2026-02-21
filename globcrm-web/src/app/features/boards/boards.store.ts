import { inject } from '@angular/core';
import {
  signalStore,
  withState,
  withMethods,
  patchState,
} from '@ngrx/signals';
import { BoardsService } from './boards.service';
import {
  BoardListDto,
  BoardDetailDto,
  CardFilter,
  CreateBoardRequest,
  UpdateBoardRequest,
  CreateColumnRequest,
  UpdateColumnRequest,
  CreateCardRequest,
  MoveCardRequest,
  ReorderColumnsRequest,
  ColumnDto,
  CardDto,
} from './boards.models';

interface BoardsState {
  boards: BoardListDto[];
  board: BoardDetailDto | null;
  isLoading: boolean;
  isCardPanelOpen: boolean;
  selectedCardId: string | null;
  cardFilter: CardFilter;
}

const initialState: BoardsState = {
  boards: [],
  board: null,
  isLoading: false,
  isCardPanelOpen: false,
  selectedCardId: null,
  cardFilter: { labels: [], assigneeId: null, dueDateRange: null },
};

/**
 * NgRx Signal Store for Kanban boards.
 * Provided at route level so list and detail pages share state.
 * Manages boards list, board detail, card panel, and optimistic operations.
 */
export const BoardStore = signalStore(
  withState(initialState),
  withMethods((store) => {
    const boardsService = inject(BoardsService);

    return {
      loadBoards(): void {
        patchState(store, { isLoading: true });
        boardsService.getBoards().subscribe({
          next: (boards) => {
            patchState(store, { boards, isLoading: false });
          },
          error: () => {
            patchState(store, { isLoading: false });
          },
        });
      },

      loadBoard(id: string): void {
        patchState(store, { isLoading: true });
        boardsService.getBoard(id).subscribe({
          next: (board) => {
            patchState(store, { board, isLoading: false });
          },
          error: () => {
            patchState(store, { isLoading: false });
          },
        });
      },

      createBoard(
        req: CreateBoardRequest,
        onSuccess?: (board: BoardListDto) => void,
        onError?: (err: unknown) => void,
      ): void {
        boardsService.createBoard(req).subscribe({
          next: (board) => {
            patchState(store, { boards: [...store.boards(), board] });
            onSuccess?.(board);
          },
          error: (err) => {
            onError?.(err);
          },
        });
      },

      updateBoard(
        id: string,
        req: UpdateBoardRequest,
        onSuccess?: () => void,
        onError?: (err: unknown) => void,
      ): void {
        boardsService.updateBoard(id, req).subscribe({
          next: (updated) => {
            patchState(store, {
              boards: store.boards().map((b) => (b.id === id ? updated : b)),
            });
            onSuccess?.();
          },
          error: (err) => {
            onError?.(err);
          },
        });
      },

      deleteBoard(
        id: string,
        onSuccess?: () => void,
        onError?: (err: unknown) => void,
      ): void {
        boardsService.deleteBoard(id).subscribe({
          next: () => {
            patchState(store, {
              boards: store.boards().filter((b) => b.id !== id),
            });
            onSuccess?.();
          },
          error: (err) => {
            onError?.(err);
          },
        });
      },

      moveCard(
        boardId: string,
        cardId: string,
        req: MoveCardRequest,
        sourceColumnId: string,
        sourceIndex: number,
        targetIndex: number,
      ): void {
        const board = store.board();
        if (!board) return;

        // Optimistic update: move card between columns in local state
        const updatedColumns = board.columns.map((col) => ({
          ...col,
          cards: [...col.cards],
        }));

        const sourceCol = updatedColumns.find((c) => c.id === sourceColumnId);
        const targetCol = updatedColumns.find((c) => c.id === req.targetColumnId);
        if (!sourceCol || !targetCol) return;

        const [movedCard] = sourceCol.cards.splice(sourceIndex, 1);
        if (!movedCard) return;

        const updatedCard = { ...movedCard, sortOrder: req.sortOrder };
        targetCol.cards.splice(targetIndex, 0, updatedCard);

        patchState(store, {
          board: { ...board, columns: updatedColumns },
        });

        // API call — revert on failure
        const previousBoard = board;
        boardsService.moveCard(boardId, cardId, req).subscribe({
          error: () => {
            patchState(store, { board: previousBoard });
          },
        });
      },

      reorderColumns(boardId: string, req: ReorderColumnsRequest): void {
        const board = store.board();
        if (!board) return;

        // Optimistic update: reorder columns locally
        const reordered = req.columnIds
          .map((id) => board.columns.find((c) => c.id === id))
          .filter((c): c is ColumnDto => c != null)
          .map((col, idx) => ({ ...col, sortOrder: idx }));

        patchState(store, {
          board: { ...board, columns: reordered },
        });

        const previousBoard = board;
        boardsService.reorderColumns(boardId, req).subscribe({
          error: () => {
            patchState(store, { board: previousBoard });
          },
        });
      },

      createColumn(
        boardId: string,
        req: CreateColumnRequest,
        onSuccess?: (col: ColumnDto) => void,
        onError?: (err: unknown) => void,
      ): void {
        boardsService.createColumn(boardId, req).subscribe({
          next: (col) => {
            const board = store.board();
            if (board) {
              patchState(store, {
                board: { ...board, columns: [...board.columns, col] },
              });
            }
            onSuccess?.(col);
          },
          error: (err) => onError?.(err),
        });
      },

      updateColumn(
        boardId: string,
        colId: string,
        req: UpdateColumnRequest,
        onSuccess?: () => void,
        onError?: (err: unknown) => void,
      ): void {
        boardsService.updateColumn(boardId, colId, req).subscribe({
          next: (updated) => {
            const board = store.board();
            if (board) {
              patchState(store, {
                board: {
                  ...board,
                  columns: board.columns.map((c) =>
                    c.id === colId ? { ...c, ...updated } : c,
                  ),
                },
              });
            }
            onSuccess?.();
          },
          error: (err) => onError?.(err),
        });
      },

      deleteColumn(
        boardId: string,
        colId: string,
        onSuccess?: () => void,
        onError?: (err: unknown) => void,
      ): void {
        boardsService.deleteColumn(boardId, colId).subscribe({
          next: () => {
            const board = store.board();
            if (board) {
              patchState(store, {
                board: {
                  ...board,
                  columns: board.columns.filter((c) => c.id !== colId),
                },
              });
            }
            onSuccess?.();
          },
          error: (err) => onError?.(err),
        });
      },

      createCard(
        boardId: string,
        req: CreateCardRequest,
        onSuccess?: (card: CardDto) => void,
        onError?: (err: unknown) => void,
      ): void {
        boardsService.createCard(boardId, req).subscribe({
          next: (card) => {
            const board = store.board();
            if (board) {
              patchState(store, {
                board: {
                  ...board,
                  columns: board.columns.map((col) =>
                    col.id === req.columnId
                      ? { ...col, cards: [...col.cards, card] }
                      : col,
                  ),
                },
              });
            }
            onSuccess?.(card);
          },
          error: (err) => onError?.(err),
        });
      },

      archiveCard(
        boardId: string,
        cardId: string,
        onSuccess?: () => void,
        onError?: (err: unknown) => void,
      ): void {
        boardsService.archiveCard(boardId, cardId).subscribe({
          next: () => {
            const board = store.board();
            if (board) {
              patchState(store, {
                board: {
                  ...board,
                  columns: board.columns.map((col) => ({
                    ...col,
                    cards: col.cards.filter((c) => c.id !== cardId),
                  })),
                },
              });
            }
            onSuccess?.();
          },
          error: (err) => onError?.(err),
        });
      },

      toggleColumnCollapse(colId: string): void {
        const board = store.board();
        if (!board) return;
        patchState(store, {
          board: {
            ...board,
            columns: board.columns.map((c) =>
              c.id === colId ? { ...c, isCollapsed: !c.isCollapsed } : c,
            ),
          },
        });
      },

      openCardPanel(cardId: string): void {
        patchState(store, { isCardPanelOpen: true, selectedCardId: cardId });
      },

      closeCardPanel(): void {
        patchState(store, { isCardPanelOpen: false, selectedCardId: null });
      },

      setCardFilter(filter: CardFilter): void {
        patchState(store, { cardFilter: filter });
      },

      clearCardFilter(): void {
        patchState(store, {
          cardFilter: { labels: [], assigneeId: null, dueDateRange: null },
        });
      },
    };
  }),
);

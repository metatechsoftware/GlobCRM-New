import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/api/api.service';
import {
  BoardListDto,
  BoardDetailDto,
  ColumnDto,
  CardDto,
  LabelDto,
  ChecklistItemDto,
  CardCommentDto,
  CreateBoardRequest,
  UpdateBoardRequest,
  CreateColumnRequest,
  UpdateColumnRequest,
  ReorderColumnsRequest,
  CreateCardRequest,
  UpdateCardRequest,
  MoveCardRequest,
  CreateLabelRequest,
  UpdateLabelRequest,
  CreateChecklistItemRequest,
  UpdateChecklistItemRequest,
  CreateCardCommentRequest,
  UpdateCardCommentRequest,
} from './boards.models';

/**
 * API service for Kanban boards, columns, cards, labels, checklists, and comments.
 * Uses ApiService for HTTP calls with centralized error handling.
 */
@Injectable({ providedIn: 'root' })
export class BoardsService {
  private readonly api = inject(ApiService);
  private readonly basePath = '/api/boards';

  // ---- Board CRUD ----

  getBoards(): Observable<BoardListDto[]> {
    return this.api.get<BoardListDto[]>(this.basePath);
  }

  getBoard(id: string): Observable<BoardDetailDto> {
    return this.api.get<BoardDetailDto>(`${this.basePath}/${id}`);
  }

  createBoard(req: CreateBoardRequest): Observable<BoardListDto> {
    return this.api.post<BoardListDto>(this.basePath, req);
  }

  updateBoard(id: string, req: UpdateBoardRequest): Observable<BoardListDto> {
    return this.api.put<BoardListDto>(`${this.basePath}/${id}`, req);
  }

  deleteBoard(id: string): Observable<void> {
    return this.api.delete<void>(`${this.basePath}/${id}`);
  }

  // ---- Column CRUD ----

  createColumn(boardId: string, req: CreateColumnRequest): Observable<ColumnDto> {
    return this.api.post<ColumnDto>(`${this.basePath}/${boardId}/columns`, req);
  }

  updateColumn(boardId: string, colId: string, req: UpdateColumnRequest): Observable<ColumnDto> {
    return this.api.put<ColumnDto>(`${this.basePath}/${boardId}/columns/${colId}`, req);
  }

  deleteColumn(boardId: string, colId: string): Observable<void> {
    return this.api.delete<void>(`${this.basePath}/${boardId}/columns/${colId}`);
  }

  reorderColumns(boardId: string, req: ReorderColumnsRequest): Observable<void> {
    return this.api.patch<void>(`${this.basePath}/${boardId}/columns/reorder`, req);
  }

  // ---- Card CRUD ----

  createCard(boardId: string, req: CreateCardRequest): Observable<CardDto> {
    return this.api.post<CardDto>(`${this.basePath}/${boardId}/cards`, req);
  }

  updateCard(boardId: string, cardId: string, req: UpdateCardRequest): Observable<CardDto> {
    return this.api.put<CardDto>(`${this.basePath}/${boardId}/cards/${cardId}`, req);
  }

  moveCard(boardId: string, cardId: string, req: MoveCardRequest): Observable<CardDto> {
    return this.api.patch<CardDto>(`${this.basePath}/${boardId}/cards/${cardId}/move`, req);
  }

  archiveCard(boardId: string, cardId: string): Observable<CardDto> {
    return this.api.patch<CardDto>(`${this.basePath}/${boardId}/cards/${cardId}/archive`, {});
  }

  // ---- Label Management ----

  createLabel(boardId: string, req: CreateLabelRequest): Observable<LabelDto> {
    return this.api.post<LabelDto>(`${this.basePath}/${boardId}/labels`, req);
  }

  updateLabel(boardId: string, labelId: string, req: UpdateLabelRequest): Observable<LabelDto> {
    return this.api.put<LabelDto>(`${this.basePath}/${boardId}/labels/${labelId}`, req);
  }

  deleteLabel(boardId: string, labelId: string): Observable<void> {
    return this.api.delete<void>(`${this.basePath}/${boardId}/labels/${labelId}`);
  }

  addLabelToCard(boardId: string, cardId: string, labelId: string): Observable<void> {
    return this.api.post<void>(`${this.basePath}/${boardId}/cards/${cardId}/labels/${labelId}`);
  }

  removeLabelFromCard(boardId: string, cardId: string, labelId: string): Observable<void> {
    return this.api.delete<void>(`${this.basePath}/${boardId}/cards/${cardId}/labels/${labelId}`);
  }

  // ---- Card Assignees ----

  addAssigneeToCard(boardId: string, cardId: string, userId: string): Observable<void> {
    return this.api.post<void>(`${this.basePath}/${boardId}/cards/${cardId}/assignees/${userId}`);
  }

  removeAssigneeFromCard(boardId: string, cardId: string, userId: string): Observable<void> {
    return this.api.delete<void>(`${this.basePath}/${boardId}/cards/${cardId}/assignees/${userId}`);
  }

  // ---- Checklist ----

  createChecklistItem(boardId: string, cardId: string, req: CreateChecklistItemRequest): Observable<ChecklistItemDto> {
    return this.api.post<ChecklistItemDto>(`${this.basePath}/${boardId}/cards/${cardId}/checklist`, req);
  }

  updateChecklistItem(boardId: string, cardId: string, itemId: string, req: UpdateChecklistItemRequest): Observable<ChecklistItemDto> {
    return this.api.put<ChecklistItemDto>(`${this.basePath}/${boardId}/cards/${cardId}/checklist/${itemId}`, req);
  }

  deleteChecklistItem(boardId: string, cardId: string, itemId: string): Observable<void> {
    return this.api.delete<void>(`${this.basePath}/${boardId}/cards/${cardId}/checklist/${itemId}`);
  }

  toggleChecklistItem(boardId: string, cardId: string, itemId: string): Observable<ChecklistItemDto> {
    return this.api.patch<ChecklistItemDto>(`${this.basePath}/${boardId}/cards/${cardId}/checklist/${itemId}/toggle`, {});
  }

  // ---- Comments ----

  getComments(boardId: string, cardId: string): Observable<CardCommentDto[]> {
    return this.api.get<CardCommentDto[]>(`${this.basePath}/${boardId}/cards/${cardId}/comments`);
  }

  createComment(boardId: string, cardId: string, req: CreateCardCommentRequest): Observable<CardCommentDto> {
    return this.api.post<CardCommentDto>(`${this.basePath}/${boardId}/cards/${cardId}/comments`, req);
  }

  updateComment(boardId: string, cardId: string, commentId: string, req: UpdateCardCommentRequest): Observable<CardCommentDto> {
    return this.api.put<CardCommentDto>(`${this.basePath}/${boardId}/cards/${cardId}/comments/${commentId}`, req);
  }

  deleteComment(boardId: string, cardId: string, commentId: string): Observable<void> {
    return this.api.delete<void>(`${this.basePath}/${boardId}/cards/${cardId}/comments/${commentId}`);
  }
}

import { Injectable, inject } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/api/api.service';
import {
  PagedResult,
  EntityQueryParams,
} from '../../shared/models/query.models';
import {
  NoteListDto,
  NoteDetailDto,
  CreateNoteRequest,
  UpdateNoteRequest,
} from './note.models';

/**
 * API service for Note entity CRUD operations and entity-scoped queries.
 * Uses ApiService for all JSON endpoints (matching QuoteService pattern).
 */
@Injectable({ providedIn: 'root' })
export class NoteService {
  private readonly api = inject(ApiService);
  private readonly basePath = '/api/notes';

  // ─── Core CRUD ──────────────────────────────────────────────────────────

  getList(
    params: EntityQueryParams & { entityType?: string; entityId?: string },
  ): Observable<PagedResult<NoteListDto>> {
    const httpParams = this.buildQueryParams(params);
    return this.api.get<PagedResult<NoteListDto>>(this.basePath, httpParams);
  }

  getById(id: string): Observable<NoteDetailDto> {
    return this.api.get<NoteDetailDto>(`${this.basePath}/${id}`);
  }

  create(request: CreateNoteRequest): Observable<NoteDetailDto> {
    return this.api.post<NoteDetailDto>(this.basePath, request);
  }

  update(id: string, request: UpdateNoteRequest): Observable<NoteDetailDto> {
    return this.api.put<NoteDetailDto>(`${this.basePath}/${id}`, request);
  }

  delete(id: string): Observable<void> {
    return this.api.delete<void>(`${this.basePath}/${id}`);
  }

  // ─── Entity-Scoped Query ────────────────────────────────────────────────

  /**
   * Gets all notes for a specific entity (for entity detail tabs).
   * Uses the dedicated entity-scoped endpoint.
   */
  getEntityNotes(
    entityType: string,
    entityId: string,
  ): Observable<NoteListDto[]> {
    return this.api.get<NoteListDto[]>(
      `${this.basePath}/entity/${entityType}/${entityId}`,
    );
  }

  // ─── Query Param Builder ───────────────────────────────────────────────

  private buildQueryParams(
    params: EntityQueryParams & { entityType?: string; entityId?: string },
  ): HttpParams {
    let httpParams = new HttpParams();

    if (params.page != null) {
      httpParams = httpParams.set('page', params.page.toString());
    }
    if (params.pageSize != null) {
      httpParams = httpParams.set('pageSize', params.pageSize.toString());
    }
    if (params.sortField != null) {
      httpParams = httpParams.set('sortField', params.sortField);
    }
    if (params.sortDirection != null) {
      httpParams = httpParams.set('sortDirection', params.sortDirection);
    }
    if (params.search != null && params.search !== '') {
      httpParams = httpParams.set('search', params.search);
    }
    if (params.filters != null && params.filters.length > 0) {
      httpParams = httpParams.set('filters', JSON.stringify(params.filters));
    }
    if (params.entityType != null) {
      httpParams = httpParams.set('entityType', params.entityType);
    }
    if (params.entityId != null) {
      httpParams = httpParams.set('entityId', params.entityId);
    }

    return httpParams;
  }
}

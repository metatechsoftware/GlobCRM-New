import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/api/api.service';
import { environment } from '../../../environments/environment.development';
import {
  PagedResult,
  EntityQueryParams,
  TimelineEntry,
} from '../../shared/models/query.models';
import {
  ActivityListDto,
  ActivityDetailDto,
  ActivityCommentDto,
  ActivityTimeEntryDto,
  ActivityLinkDto,
  ActivityFollowerDto,
  ActivityKanbanDto,
  CreateActivityRequest,
  UpdateActivityRequest,
  CreateCommentRequest,
  CreateTimeEntryRequest,
  CreateLinkRequest,
  ActivityStatus,
} from './activity.models';

/**
 * API service for Activity entity CRUD operations, status transitions,
 * comments, attachments, time entries, entity linking, follow/watch,
 * Kanban board, and timeline.
 * Uses ApiService for standard HTTP calls with centralized error handling.
 */
@Injectable({ providedIn: 'root' })
export class ActivityService {
  private readonly api = inject(ApiService);
  private readonly http = inject(HttpClient);
  private readonly basePath = '/api/activities';
  private readonly baseUrl = environment.apiUrl;

  // ─── Core CRUD ──────────────────────────────────────────────────────────

  getList(
    params: EntityQueryParams & { linkedEntityType?: string; linkedEntityId?: string },
  ): Observable<PagedResult<ActivityListDto>> {
    const httpParams = this.buildQueryParams(params);
    return this.api.get<PagedResult<ActivityListDto>>(this.basePath, httpParams);
  }

  getById(id: string): Observable<ActivityDetailDto> {
    return this.api.get<ActivityDetailDto>(`${this.basePath}/${id}`);
  }

  create(request: CreateActivityRequest): Observable<ActivityListDto> {
    return this.api.post<ActivityListDto>(this.basePath, request);
  }

  update(id: string, request: UpdateActivityRequest): Observable<void> {
    return this.api.put<void>(`${this.basePath}/${id}`, request);
  }

  delete(id: string): Observable<void> {
    return this.api.delete<void>(`${this.basePath}/${id}`);
  }

  // ─── Status Workflow ────────────────────────────────────────────────────

  updateStatus(id: string, status: string): Observable<void> {
    return this.api.patch<void>(`${this.basePath}/${id}/status`, { status });
  }

  getAllowedTransitions(id: string): Observable<ActivityStatus[]> {
    return this.api.get<ActivityStatus[]>(`${this.basePath}/${id}/allowed-transitions`);
  }

  // ─── Kanban ─────────────────────────────────────────────────────────────

  getKanban(): Observable<ActivityKanbanDto> {
    return this.api.get<ActivityKanbanDto>(`${this.basePath}/kanban`);
  }

  // ─── Timeline ───────────────────────────────────────────────────────────

  getTimeline(id: string): Observable<TimelineEntry[]> {
    return this.api.get<TimelineEntry[]>(`${this.basePath}/${id}/timeline`);
  }

  // ─── Comments ───────────────────────────────────────────────────────────

  addComment(id: string, content: string): Observable<ActivityCommentDto> {
    return this.api.post<ActivityCommentDto>(
      `${this.basePath}/${id}/comments`,
      { content } as CreateCommentRequest,
    );
  }

  updateComment(id: string, commentId: string, content: string): Observable<void> {
    return this.api.put<void>(
      `${this.basePath}/${id}/comments/${commentId}`,
      { content } as CreateCommentRequest,
    );
  }

  deleteComment(id: string, commentId: string): Observable<void> {
    return this.api.delete<void>(`${this.basePath}/${id}/comments/${commentId}`);
  }

  // ─── Attachments ────────────────────────────────────────────────────────

  uploadAttachment(id: string, file: File): Observable<void> {
    const formData = new FormData();
    formData.append('file', file, file.name);
    return this.http.post<void>(
      `${this.baseUrl}${this.basePath}/${id}/attachments`,
      formData,
    );
  }

  downloadAttachment(id: string, attachmentId: string): Observable<Blob> {
    return this.http.get(
      `${this.baseUrl}${this.basePath}/${id}/attachments/${attachmentId}/download`,
      { responseType: 'blob' },
    );
  }

  deleteAttachment(id: string, attachmentId: string): Observable<void> {
    return this.api.delete<void>(`${this.basePath}/${id}/attachments/${attachmentId}`);
  }

  // ─── Time Entries ───────────────────────────────────────────────────────

  addTimeEntry(id: string, request: CreateTimeEntryRequest): Observable<ActivityTimeEntryDto> {
    return this.api.post<ActivityTimeEntryDto>(
      `${this.basePath}/${id}/time-entries`,
      request,
    );
  }

  deleteTimeEntry(id: string, entryId: string): Observable<void> {
    return this.api.delete<void>(`${this.basePath}/${id}/time-entries/${entryId}`);
  }

  // ─── Entity Links ──────────────────────────────────────────────────────

  addLink(id: string, request: CreateLinkRequest): Observable<ActivityLinkDto> {
    return this.api.post<ActivityLinkDto>(
      `${this.basePath}/${id}/links`,
      request,
    );
  }

  deleteLink(id: string, linkId: string): Observable<void> {
    return this.api.delete<void>(`${this.basePath}/${id}/links/${linkId}`);
  }

  // ─── Follow / Watch ────────────────────────────────────────────────────

  follow(id: string): Observable<ActivityFollowerDto> {
    return this.api.post<ActivityFollowerDto>(`${this.basePath}/${id}/followers`);
  }

  unfollow(id: string): Observable<void> {
    return this.api.delete<void>(`${this.basePath}/${id}/followers`);
  }

  // ─── Query Param Builder ───────────────────────────────────────────────

  private buildQueryParams(
    params: EntityQueryParams & { linkedEntityType?: string; linkedEntityId?: string },
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
    if (params.linkedEntityType != null) {
      httpParams = httpParams.set('linkedEntityType', params.linkedEntityType);
    }
    if (params.linkedEntityId != null) {
      httpParams = httpParams.set('linkedEntityId', params.linkedEntityId);
    }

    return httpParams;
  }
}

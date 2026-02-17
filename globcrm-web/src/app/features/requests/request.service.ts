import { Injectable, inject } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/api/api.service';
import {
  PagedResult,
  EntityQueryParams,
  TimelineEntry,
} from '../../shared/models/query.models';
import {
  RequestListDto,
  RequestDetailDto,
  CreateRequestRequest,
  UpdateRequestRequest,
  UpdateRequestStatusRequest,
} from './request.models';

/**
 * API service for Request (support ticket) entity CRUD operations,
 * status workflow transitions, allowed transitions query, and timeline.
 * Uses ApiService for HTTP calls with centralized error handling.
 */
@Injectable({ providedIn: 'root' })
export class RequestService {
  private readonly api = inject(ApiService);
  private readonly basePath = '/api/requests';

  // ─── Core CRUD ──────────────────────────────────────────────────────────

  getList(params: EntityQueryParams): Observable<PagedResult<RequestListDto>> {
    const httpParams = this.buildQueryParams(params);
    return this.api.get<PagedResult<RequestListDto>>(this.basePath, httpParams);
  }

  getById(id: string): Observable<RequestDetailDto> {
    return this.api.get<RequestDetailDto>(`${this.basePath}/${id}`);
  }

  create(request: CreateRequestRequest): Observable<RequestDetailDto> {
    return this.api.post<RequestDetailDto>(this.basePath, request);
  }

  update(id: string, request: UpdateRequestRequest): Observable<RequestDetailDto> {
    return this.api.put<RequestDetailDto>(`${this.basePath}/${id}`, request);
  }

  delete(id: string): Observable<void> {
    return this.api.delete<void>(`${this.basePath}/${id}`);
  }

  // ─── Status Workflow ────────────────────────────────────────────────────

  updateStatus(id: string, request: UpdateRequestStatusRequest): Observable<RequestDetailDto> {
    return this.api.patch<RequestDetailDto>(`${this.basePath}/${id}/status`, request);
  }

  getAllowedTransitions(id: string): Observable<string[]> {
    return this.api.get<string[]>(`${this.basePath}/${id}/allowed-transitions`);
  }

  // ─── Timeline ───────────────────────────────────────────────────────────

  getTimeline(id: string): Observable<TimelineEntry[]> {
    return this.api.get<TimelineEntry[]>(`${this.basePath}/${id}/timeline`);
  }

  // ─── Query Param Builder ───────────────────────────────────────────────

  private buildQueryParams(params: EntityQueryParams): HttpParams {
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

    return httpParams;
  }
}

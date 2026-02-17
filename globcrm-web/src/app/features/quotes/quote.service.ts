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
  QuoteListDto,
  QuoteDetailDto,
  CreateQuoteRequest,
  UpdateQuoteRequest,
  UpdateQuoteStatusRequest,
} from './quote.models';

/**
 * API service for Quote entity CRUD operations, status transitions,
 * PDF generation, versioning, and timeline.
 * Uses ApiService for JSON endpoints and HttpClient directly for blob PDF download.
 */
@Injectable({ providedIn: 'root' })
export class QuoteService {
  private readonly api = inject(ApiService);
  private readonly http = inject(HttpClient);
  private readonly basePath = '/api/quotes';
  private readonly baseUrl = environment.apiUrl;

  // ─── Core CRUD ──────────────────────────────────────────────────────────

  getList(params: EntityQueryParams): Observable<PagedResult<QuoteListDto>> {
    const httpParams = this.buildQueryParams(params);
    return this.api.get<PagedResult<QuoteListDto>>(this.basePath, httpParams);
  }

  getById(id: string): Observable<QuoteDetailDto> {
    return this.api.get<QuoteDetailDto>(`${this.basePath}/${id}`);
  }

  create(request: CreateQuoteRequest): Observable<QuoteDetailDto> {
    return this.api.post<QuoteDetailDto>(this.basePath, request);
  }

  update(id: string, request: UpdateQuoteRequest): Observable<QuoteDetailDto> {
    return this.api.put<QuoteDetailDto>(`${this.basePath}/${id}`, request);
  }

  delete(id: string): Observable<void> {
    return this.api.delete<void>(`${this.basePath}/${id}`);
  }

  // ─── Status Workflow ────────────────────────────────────────────────────

  updateStatus(id: string, request: UpdateQuoteStatusRequest): Observable<QuoteDetailDto> {
    return this.api.patch<QuoteDetailDto>(`${this.basePath}/${id}/status`, request);
  }

  // ─── PDF Generation ─────────────────────────────────────────────────────

  generatePdf(id: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}${this.basePath}/${id}/pdf`, {
      responseType: 'blob',
    });
  }

  // ─── Versioning ─────────────────────────────────────────────────────────

  createNewVersion(id: string): Observable<QuoteDetailDto> {
    return this.api.post<QuoteDetailDto>(`${this.basePath}/${id}/new-version`);
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

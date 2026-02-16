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
  ContactDto,
  ContactDetailDto,
  CreateContactRequest,
  UpdateContactRequest,
} from './contact.models';

/**
 * API service for Contact entity CRUD operations.
 * Uses ApiService for HTTP calls with centralized error handling.
 */
@Injectable({ providedIn: 'root' })
export class ContactService {
  private readonly api = inject(ApiService);
  private readonly basePath = '/api/contacts';

  getList(params: EntityQueryParams): Observable<PagedResult<ContactDto>> {
    const httpParams = this.buildQueryParams(params);
    return this.api.get<PagedResult<ContactDto>>(this.basePath, httpParams);
  }

  getById(id: string): Observable<ContactDetailDto> {
    return this.api.get<ContactDetailDto>(`${this.basePath}/${id}`);
  }

  create(request: CreateContactRequest): Observable<ContactDto> {
    return this.api.post<ContactDto>(this.basePath, request);
  }

  update(id: string, request: UpdateContactRequest): Observable<void> {
    return this.api.put<void>(`${this.basePath}/${id}`, request);
  }

  delete(id: string): Observable<void> {
    return this.api.delete<void>(`${this.basePath}/${id}`);
  }

  getTimeline(id: string): Observable<TimelineEntry[]> {
    return this.api.get<TimelineEntry[]>(`${this.basePath}/${id}/timeline`);
  }

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

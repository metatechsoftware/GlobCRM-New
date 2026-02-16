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
  CompanyDto,
  CompanyDetailDto,
  CreateCompanyRequest,
  UpdateCompanyRequest,
} from './company.models';
import { ContactDto } from '../contacts/contact.models';

/**
 * API service for Company entity CRUD operations.
 * Uses ApiService for HTTP calls with centralized error handling.
 */
@Injectable({ providedIn: 'root' })
export class CompanyService {
  private readonly api = inject(ApiService);
  private readonly basePath = '/api/companies';

  getList(params: EntityQueryParams): Observable<PagedResult<CompanyDto>> {
    const httpParams = this.buildQueryParams(params);
    return this.api.get<PagedResult<CompanyDto>>(this.basePath, httpParams);
  }

  getById(id: string): Observable<CompanyDetailDto> {
    return this.api.get<CompanyDetailDto>(`${this.basePath}/${id}`);
  }

  create(request: CreateCompanyRequest): Observable<CompanyDto> {
    return this.api.post<CompanyDto>(this.basePath, request);
  }

  update(id: string, request: UpdateCompanyRequest): Observable<void> {
    return this.api.put<void>(`${this.basePath}/${id}`, request);
  }

  delete(id: string): Observable<void> {
    return this.api.delete<void>(`${this.basePath}/${id}`);
  }

  getTimeline(id: string): Observable<TimelineEntry[]> {
    return this.api.get<TimelineEntry[]>(`${this.basePath}/${id}/timeline`);
  }

  getCompanyContacts(id: string): Observable<ContactDto[]> {
    return this.api.get<ContactDto[]>(`${this.basePath}/${id}/contacts`);
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

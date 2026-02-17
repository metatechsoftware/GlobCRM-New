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
  DealListDto,
  DealDetailDto,
  CreateDealRequest,
  UpdateDealRequest,
  LinkProductRequest,
  KanbanDto,
} from './deal.models';

/**
 * API service for Deal entity CRUD operations, stage transitions,
 * entity linking, Kanban board, and timeline.
 * Uses ApiService for HTTP calls with centralized error handling.
 */
@Injectable({ providedIn: 'root' })
export class DealService {
  private readonly api = inject(ApiService);
  private readonly basePath = '/api/deals';

  getList(
    params: EntityQueryParams & { pipelineId?: string; stageId?: string },
  ): Observable<PagedResult<DealListDto>> {
    const httpParams = this.buildQueryParams(params);
    return this.api.get<PagedResult<DealListDto>>(this.basePath, httpParams);
  }

  getById(id: string): Observable<DealDetailDto> {
    return this.api.get<DealDetailDto>(`${this.basePath}/${id}`);
  }

  create(request: CreateDealRequest): Observable<DealListDto> {
    return this.api.post<DealListDto>(this.basePath, request);
  }

  update(id: string, request: UpdateDealRequest): Observable<void> {
    return this.api.put<void>(`${this.basePath}/${id}`, request);
  }

  delete(id: string): Observable<void> {
    return this.api.delete<void>(`${this.basePath}/${id}`);
  }

  updateStage(id: string, stageId: string): Observable<void> {
    return this.api.patch<void>(`${this.basePath}/${id}/stage`, { stageId });
  }

  linkContact(dealId: string, contactId: string): Observable<void> {
    return this.api.post<void>(
      `${this.basePath}/${dealId}/contacts/${contactId}`,
    );
  }

  unlinkContact(dealId: string, contactId: string): Observable<void> {
    return this.api.delete<void>(
      `${this.basePath}/${dealId}/contacts/${contactId}`,
    );
  }

  linkProduct(dealId: string, request: LinkProductRequest): Observable<void> {
    return this.api.post<void>(
      `${this.basePath}/${dealId}/products`,
      request,
    );
  }

  unlinkProduct(dealId: string, productId: string): Observable<void> {
    return this.api.delete<void>(
      `${this.basePath}/${dealId}/products/${productId}`,
    );
  }

  getKanban(
    pipelineId: string,
    includeTerminal?: boolean,
  ): Observable<KanbanDto> {
    let httpParams = new HttpParams().set('pipelineId', pipelineId);
    if (includeTerminal != null) {
      httpParams = httpParams.set(
        'includeTerminal',
        includeTerminal.toString(),
      );
    }
    return this.api.get<KanbanDto>(`${this.basePath}/kanban`, httpParams);
  }

  getTimeline(id: string): Observable<TimelineEntry[]> {
    return this.api.get<TimelineEntry[]>(`${this.basePath}/${id}/timeline`);
  }

  private buildQueryParams(
    params: EntityQueryParams & { pipelineId?: string; stageId?: string },
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
    if (params.pipelineId != null) {
      httpParams = httpParams.set('pipelineId', params.pipelineId);
    }
    if (params.stageId != null) {
      httpParams = httpParams.set('stageId', params.stageId);
    }

    return httpParams;
  }
}

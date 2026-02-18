import { Injectable, inject } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/api/api.service';
import {
  PagedResult,
  EntityQueryParams,
} from '../../shared/models/query.models';
import {
  LeadListDto,
  LeadDetailDto,
  CreateLeadRequest,
  UpdateLeadRequest,
  ConvertLeadRequest,
  ConvertLeadResult,
  DuplicateCheckResult,
  LeadKanbanDto,
  LeadTimelineEventDto,
  LeadStageDto,
  LeadSourceDto,
  CreateLeadStageRequest,
  UpdateLeadStageAdminRequest,
  ReorderLeadStagesRequest,
  CreateLeadSourceRequest,
  UpdateLeadSourceRequest,
} from './lead.models';

/**
 * API service for Lead entity CRUD operations, stage transitions,
 * Kanban board, timeline, conversion, and admin stage/source management.
 * Uses ApiService for HTTP calls with centralized error handling.
 */
@Injectable({ providedIn: 'root' })
export class LeadService {
  private readonly api = inject(ApiService);
  private readonly basePath = '/api/leads';
  private readonly stagesPath = '/api/lead-stages';
  private readonly sourcesPath = '/api/lead-sources';

  // ─── Core CRUD ─────────────────────────────────────────────────────────

  getList(
    params: EntityQueryParams & {
      stageId?: string;
      sourceId?: string;
      temperature?: string;
    },
  ): Observable<PagedResult<LeadListDto>> {
    const httpParams = this.buildQueryParams(params);
    return this.api.get<PagedResult<LeadListDto>>(this.basePath, httpParams);
  }

  getById(id: string): Observable<LeadDetailDto> {
    return this.api.get<LeadDetailDto>(`${this.basePath}/${id}`);
  }

  create(request: CreateLeadRequest): Observable<LeadDetailDto> {
    return this.api.post<LeadDetailDto>(this.basePath, request);
  }

  update(id: string, request: UpdateLeadRequest): Observable<LeadDetailDto> {
    return this.api.put<LeadDetailDto>(`${this.basePath}/${id}`, request);
  }

  delete(id: string): Observable<void> {
    return this.api.delete<void>(`${this.basePath}/${id}`);
  }

  // ─── Stage Transitions ─────────────────────────────────────────────────

  updateStage(id: string, stageId: string): Observable<LeadDetailDto> {
    return this.api.patch<LeadDetailDto>(`${this.basePath}/${id}/stage`, {
      stageId,
    });
  }

  reopenLead(id: string, stageId: string): Observable<LeadDetailDto> {
    return this.api.post<LeadDetailDto>(`${this.basePath}/${id}/reopen`, {
      stageId,
    });
  }

  // ─── Kanban & Timeline ─────────────────────────────────────────────────

  getKanban(includeTerminal?: boolean): Observable<LeadKanbanDto> {
    let httpParams = new HttpParams();
    if (includeTerminal != null) {
      httpParams = httpParams.set(
        'includeTerminal',
        includeTerminal.toString(),
      );
    }
    return this.api.get<LeadKanbanDto>(
      `${this.basePath}/kanban`,
      httpParams,
    );
  }

  getTimeline(id: string): Observable<LeadTimelineEventDto[]> {
    return this.api.get<LeadTimelineEventDto[]>(
      `${this.basePath}/${id}/timeline`,
    );
  }

  // ─── Conversion & Duplicate Check ──────────────────────────────────────

  checkDuplicates(id: string): Observable<DuplicateCheckResult> {
    return this.api.get<DuplicateCheckResult>(
      `${this.basePath}/${id}/convert/check-duplicates`,
    );
  }

  convert(id: string, request: ConvertLeadRequest): Observable<ConvertLeadResult> {
    return this.api.post<ConvertLeadResult>(
      `${this.basePath}/${id}/convert`,
      request,
    );
  }

  // ─── Admin: Lead Stages ────────────────────────────────────────────────

  getStages(): Observable<LeadStageDto[]> {
    return this.api.get<LeadStageDto[]>(this.stagesPath);
  }

  createStage(request: CreateLeadStageRequest): Observable<LeadStageDto> {
    return this.api.post<LeadStageDto>(this.stagesPath, request);
  }

  updateStageAdmin(
    id: string,
    request: UpdateLeadStageAdminRequest,
  ): Observable<void> {
    return this.api.put<void>(`${this.stagesPath}/${id}`, request);
  }

  deleteStage(id: string): Observable<void> {
    return this.api.delete<void>(`${this.stagesPath}/${id}`);
  }

  reorderStages(stageIds: string[]): Observable<void> {
    return this.api.post<void>(`${this.stagesPath}/reorder`, {
      stageIds,
    } as ReorderLeadStagesRequest);
  }

  // ─── Admin: Lead Sources ───────────────────────────────────────────────

  getSources(): Observable<LeadSourceDto[]> {
    return this.api.get<LeadSourceDto[]>(this.sourcesPath);
  }

  createSource(request: CreateLeadSourceRequest): Observable<LeadSourceDto> {
    return this.api.post<LeadSourceDto>(this.sourcesPath, request);
  }

  updateSource(
    id: string,
    request: UpdateLeadSourceRequest,
  ): Observable<void> {
    return this.api.put<void>(`${this.sourcesPath}/${id}`, request);
  }

  deleteSource(id: string): Observable<void> {
    return this.api.delete<void>(`${this.sourcesPath}/${id}`);
  }

  // ─── Query Params Builder ──────────────────────────────────────────────

  private buildQueryParams(
    params: EntityQueryParams & {
      stageId?: string;
      sourceId?: string;
      temperature?: string;
    },
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
    if (params.stageId != null) {
      httpParams = httpParams.set('stageId', params.stageId);
    }
    if (params.sourceId != null) {
      httpParams = httpParams.set('sourceId', params.sourceId);
    }
    if (params.temperature != null) {
      httpParams = httpParams.set('temperature', params.temperature);
    }

    return httpParams;
  }
}

import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/api/api.service';
import {
  PipelineDto,
  PipelineDetailDto,
  PipelineStageDto,
  CreatePipelineRequest,
  UpdatePipelineRequest,
} from './deal.models';

/**
 * API service for Pipeline admin operations.
 * Used in settings/pipelines pages for pipeline CRUD and stage management.
 */
@Injectable({ providedIn: 'root' })
export class PipelineService {
  private readonly api = inject(ApiService);
  private readonly basePath = '/api/pipelines';

  getAll(): Observable<PipelineDto[]> {
    return this.api.get<PipelineDto[]>(this.basePath);
  }

  getById(id: string): Observable<PipelineDetailDto> {
    return this.api.get<PipelineDetailDto>(`${this.basePath}/${id}`);
  }

  create(request: CreatePipelineRequest): Observable<PipelineDto> {
    return this.api.post<PipelineDto>(this.basePath, request);
  }

  update(id: string, request: UpdatePipelineRequest): Observable<void> {
    return this.api.put<void>(`${this.basePath}/${id}`, request);
  }

  delete(id: string): Observable<void> {
    return this.api.delete<void>(`${this.basePath}/${id}`);
  }

  getStages(pipelineId: string): Observable<PipelineStageDto[]> {
    return this.api.get<PipelineStageDto[]>(
      `${this.basePath}/${pipelineId}/stages`,
    );
  }
}

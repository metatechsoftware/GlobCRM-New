import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/api/api.service';
import { environment } from '../../../environments/environment.development';
import {
  ImportEntityType,
  ImportJob,
  ImportFieldMapping,
  DuplicateStrategy,
  UploadResponse,
  PreviewResponse,
} from './import.models';

/**
 * API service for CSV import wizard endpoints.
 * Uses HttpClient directly for FormData upload (matching ActivityService attachment pattern).
 * Uses ApiService for standard JSON endpoints.
 * Matches backend ImportsController (/api/imports).
 */
@Injectable({ providedIn: 'root' })
export class ImportService {
  private readonly api = inject(ApiService);
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;
  private readonly basePath = '/api/imports';

  /**
   * Upload a CSV file for import.
   * POST FormData to /api/imports/upload?entityType={type}
   */
  upload(file: File, entityType: ImportEntityType): Observable<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file, file.name);
    return this.http.post<UploadResponse>(
      `${this.baseUrl}${this.basePath}/upload?entityType=${entityType}`,
      formData,
    );
  }

  /**
   * Save column-to-field mappings and duplicate strategy.
   * POST /api/imports/{id}/mapping
   */
  saveMapping(
    importJobId: string,
    mappings: ImportFieldMapping[],
    duplicateStrategy: DuplicateStrategy,
  ): Observable<void> {
    return this.api.post<void>(`${this.basePath}/${importJobId}/mapping`, {
      mappings,
      duplicateStrategy,
    });
  }

  /**
   * Run validation preview on the import job.
   * POST /api/imports/{id}/preview
   */
  preview(importJobId: string): Observable<PreviewResponse> {
    return this.api.post<PreviewResponse>(`${this.basePath}/${importJobId}/preview`);
  }

  /**
   * Execute the import (returns 202 Accepted, processing happens async with SignalR progress).
   * POST /api/imports/{id}/execute
   */
  execute(importJobId: string): Observable<void> {
    return this.api.post<void>(`${this.basePath}/${importJobId}/execute`);
  }

  /**
   * Get import job status.
   * GET /api/imports/{id}
   */
  getJob(importJobId: string): Observable<ImportJob> {
    return this.api.get<ImportJob>(`${this.basePath}/${importJobId}`);
  }

  /**
   * Get paginated list of import jobs.
   * GET /api/imports?page={p}&pageSize={s}
   */
  getJobs(page: number, pageSize: number): Observable<ImportJob[]> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('pageSize', pageSize.toString());
    return this.api.get<ImportJob[]>(this.basePath, params);
  }
}

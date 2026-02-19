import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpParams } from '@angular/common/http';
import { ApiService } from '../../core/api/api.service';
import {
  Report,
  ReportCategory,
  ReportFieldMetadata,
  ReportExecutionResult,
  PagedReportResponse,
  CreateReportRequest,
  UpdateReportRequest,
  ExecuteReportRequest,
} from './report.models';

/**
 * API service for report CRUD, execution, field metadata, sharing, cloning,
 * CSV export, and category management. Maps to ReportsController (/api/reports).
 */
@Injectable({ providedIn: 'root' })
export class ReportService {
  private readonly api = inject(ApiService);
  private readonly basePath = '/api/reports';

  // ---- Report CRUD ----

  getReports(params?: {
    categoryId?: string;
    entityType?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  }): Observable<PagedReportResponse> {
    let httpParams = new HttpParams();
    if (params?.categoryId) {
      httpParams = httpParams.set('categoryId', params.categoryId);
    }
    if (params?.entityType) {
      httpParams = httpParams.set('entityType', params.entityType);
    }
    if (params?.search) {
      httpParams = httpParams.set('search', params.search);
    }
    if (params?.page) {
      httpParams = httpParams.set('page', params.page.toString());
    }
    if (params?.pageSize) {
      httpParams = httpParams.set('pageSize', params.pageSize.toString());
    }
    return this.api.get<PagedReportResponse>(this.basePath, httpParams);
  }

  getReport(id: string): Observable<Report> {
    return this.api.get<Report>(`${this.basePath}/${id}`);
  }

  createReport(request: CreateReportRequest): Observable<Report> {
    return this.api.post<Report>(this.basePath, request);
  }

  updateReport(id: string, request: UpdateReportRequest): Observable<Report> {
    return this.api.put<Report>(`${this.basePath}/${id}`, request);
  }

  deleteReport(id: string): Observable<void> {
    return this.api.delete<void>(`${this.basePath}/${id}`);
  }

  // ---- Execution ----

  executeReport(
    id: string,
    request?: ExecuteReportRequest,
  ): Observable<ReportExecutionResult> {
    return this.api.post<ReportExecutionResult>(
      `${this.basePath}/${id}/execute`,
      request ?? {},
    );
  }

  // ---- Field Metadata ----

  getFieldMetadata(entityType: string): Observable<ReportFieldMetadata> {
    return this.api.get<ReportFieldMetadata>(
      `${this.basePath}/fields/${entityType}`,
    );
  }

  // ---- Share / Clone / Export ----

  toggleShare(id: string, isShared: boolean): Observable<void> {
    return this.api.patch<void>(`${this.basePath}/${id}/share`, { isShared });
  }

  cloneReport(id: string, name?: string): Observable<Report> {
    return this.api.post<Report>(`${this.basePath}/${id}/clone`, { name });
  }

  exportCsv(id: string): Observable<{ jobId: string }> {
    return this.api.post<{ jobId: string }>(
      `${this.basePath}/${id}/export-csv`,
    );
  }

  // ---- Categories ----

  getCategories(): Observable<ReportCategory[]> {
    return this.api.get<ReportCategory[]>(`${this.basePath}/categories`);
  }

  createCategory(
    name: string,
    description?: string,
    sortOrder: number = 0,
  ): Observable<ReportCategory> {
    return this.api.post<ReportCategory>(`${this.basePath}/categories`, {
      name,
      description,
      sortOrder,
    });
  }

  updateCategory(
    id: string,
    name: string,
    description?: string,
    sortOrder: number = 0,
  ): Observable<ReportCategory> {
    return this.api.put<ReportCategory>(
      `${this.basePath}/categories/${id}`,
      { name, description, sortOrder },
    );
  }

  deleteCategory(id: string): Observable<void> {
    return this.api.delete<void>(`${this.basePath}/categories/${id}`);
  }
}

import { Injectable, inject } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/api/api.service';
import {
  EmailTemplate,
  EmailTemplateListItem,
  EmailTemplateCategory,
  MergeFieldGroup,
  CreateEmailTemplateRequest,
  UpdateEmailTemplateRequest,
  CloneRequest,
  PreviewRequest,
  PreviewResponse,
} from './email-template.models';

/**
 * API service for email template CRUD operations, preview, test send,
 * cloning, category management, and merge field retrieval.
 * Uses ApiService for HTTP calls with centralized error handling.
 */
@Injectable({ providedIn: 'root' })
export class EmailTemplateService {
  private readonly api = inject(ApiService);
  private readonly basePath = '/api/email-templates';
  private readonly categoriesPath = '/api/email-template-categories';
  private readonly mergeFieldsPath = '/api/merge-fields';

  // ─── Template CRUD ──────────────────────────────────────────────────────

  getTemplates(params?: {
    categoryId?: string;
    isShared?: boolean;
    search?: string;
  }): Observable<EmailTemplateListItem[]> {
    let httpParams = new HttpParams();

    if (params?.categoryId) {
      httpParams = httpParams.set('categoryId', params.categoryId);
    }
    if (params?.isShared != null) {
      httpParams = httpParams.set('isShared', params.isShared.toString());
    }
    if (params?.search) {
      httpParams = httpParams.set('search', params.search);
    }

    return this.api.get<EmailTemplateListItem[]>(this.basePath, httpParams);
  }

  getTemplate(id: string): Observable<EmailTemplate> {
    return this.api.get<EmailTemplate>(`${this.basePath}/${id}`);
  }

  createTemplate(
    request: CreateEmailTemplateRequest,
  ): Observable<EmailTemplateListItem> {
    return this.api.post<EmailTemplateListItem>(this.basePath, request);
  }

  updateTemplate(
    id: string,
    request: UpdateEmailTemplateRequest,
  ): Observable<void> {
    return this.api.put<void>(`${this.basePath}/${id}`, request);
  }

  deleteTemplate(id: string): Observable<void> {
    return this.api.delete<void>(`${this.basePath}/${id}`);
  }

  cloneTemplate(
    id: string,
    request: CloneRequest,
  ): Observable<EmailTemplateListItem> {
    return this.api.post<EmailTemplateListItem>(
      `${this.basePath}/${id}/clone`,
      request,
    );
  }

  previewTemplate(
    id: string,
    request: PreviewRequest,
  ): Observable<PreviewResponse> {
    return this.api.post<PreviewResponse>(
      `${this.basePath}/${id}/preview`,
      request,
    );
  }

  testSend(id: string, request: PreviewRequest): Observable<{ message: string }> {
    return this.api.post<{ message: string }>(
      `${this.basePath}/${id}/test-send`,
      request,
    );
  }

  // ─── Categories ─────────────────────────────────────────────────────────

  getCategories(): Observable<EmailTemplateCategory[]> {
    return this.api.get<EmailTemplateCategory[]>(this.categoriesPath);
  }

  createCategory(request: {
    name: string;
    sortOrder?: number;
  }): Observable<EmailTemplateCategory> {
    return this.api.post<EmailTemplateCategory>(this.categoriesPath, request);
  }

  updateCategory(
    id: string,
    request: { name: string; sortOrder?: number },
  ): Observable<void> {
    return this.api.put<void>(`${this.categoriesPath}/${id}`, request);
  }

  deleteCategory(id: string): Observable<void> {
    return this.api.delete<void>(`${this.categoriesPath}/${id}`);
  }

  // ─── Merge Fields ───────────────────────────────────────────────────────

  getMergeFields(): Observable<MergeFieldGroup> {
    return this.api.get<MergeFieldGroup>(this.mergeFieldsPath);
  }
}

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/api/api.service';
import { environment } from '../../../environments/environment.development';
import {
  QuoteTemplate,
  QuoteTemplateListItem,
  CreateQuoteTemplateRequest,
  UpdateQuoteTemplateRequest,
  MergeTagGroup,
} from './quote-template.models';

/**
 * API service for quote template CRUD operations, clone, set-default,
 * merge fields, preview, and PDF generation.
 * Uses ApiService for JSON endpoints and HttpClient directly for text/blob responses.
 */
@Injectable({ providedIn: 'root' })
export class QuoteTemplateService {
  private readonly api = inject(ApiService);
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;
  private readonly basePath = '/api/quote-templates';

  // ─── Template CRUD ──────────────────────────────────────────────────────

  getAll(): Observable<QuoteTemplateListItem[]> {
    return this.api.get<QuoteTemplateListItem[]>(this.basePath);
  }

  getById(id: string): Observable<QuoteTemplate> {
    return this.api.get<QuoteTemplate>(`${this.basePath}/${id}`);
  }

  create(request: CreateQuoteTemplateRequest): Observable<QuoteTemplate> {
    return this.api.post<QuoteTemplate>(this.basePath, request);
  }

  update(id: string, request: UpdateQuoteTemplateRequest): Observable<QuoteTemplate> {
    return this.api.put<QuoteTemplate>(`${this.basePath}/${id}`, request);
  }

  delete(id: string): Observable<void> {
    return this.api.delete<void>(`${this.basePath}/${id}`);
  }

  // ─── Clone & Set Default ──────────────────────────────────────────────────

  clone(id: string): Observable<QuoteTemplate> {
    return this.api.post<QuoteTemplate>(`${this.basePath}/${id}/clone`);
  }

  setDefault(id: string): Observable<void> {
    return this.api.put<void>(`${this.basePath}/${id}/set-default`);
  }

  // ─── Merge Fields ─────────────────────────────────────────────────────────

  getMergeFields(): Observable<Record<string, MergeTagGroup>> {
    return this.api.get<Record<string, MergeTagGroup>>(`${this.basePath}/merge-fields`);
  }

  // ─── Preview ──────────────────────────────────────────────────────────────

  getPreviewHtml(templateId: string, quoteId?: string): Observable<string> {
    let params = new HttpParams();
    if (quoteId) {
      params = params.set('quoteId', quoteId);
    }
    return this.http.get(`${this.baseUrl}${this.basePath}/${templateId}/preview`, {
      params,
      responseType: 'text',
    });
  }

  // ─── PDF Generation ───────────────────────────────────────────────────────

  generatePdf(quoteId: string, templateId?: string): Observable<Blob> {
    let params = new HttpParams();
    if (templateId) {
      params = params.set('templateId', templateId);
    }
    return this.http.get(`${this.baseUrl}/api/quotes/${quoteId}/pdf`, {
      params,
      responseType: 'blob',
    });
  }
}

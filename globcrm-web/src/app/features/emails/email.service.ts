import { Injectable, inject } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/api/api.service';
import {
  PagedResult,
  EntityQueryParams,
} from '../../shared/models/query.models';
import {
  EmailListDto,
  EmailDetailDto,
  EmailThreadDto,
  EmailAccountStatusDto,
  SendEmailRequest,
  ConnectResponse,
} from './email.models';

/**
 * API service for Email operations and account management.
 * Uses ApiService for all JSON endpoints (no blob downloads needed for email).
 *
 * Covers 8 email operation endpoints (EmailsController)
 * and 4 account management endpoints (EmailAccountsController).
 */
@Injectable({ providedIn: 'root' })
export class EmailService {
  private readonly api = inject(ApiService);
  private readonly emailBasePath = '/api/emails';
  private readonly accountBasePath = '/api/email-accounts';

  // ─── Email Operations (8 methods matching EmailsController) ──────────────

  getList(params: EntityQueryParams): Observable<PagedResult<EmailListDto>> {
    const httpParams = this.buildQueryParams(params);
    return this.api.get<PagedResult<EmailListDto>>(this.emailBasePath, httpParams);
  }

  getById(id: string): Observable<EmailDetailDto> {
    return this.api.get<EmailDetailDto>(`${this.emailBasePath}/${id}`);
  }

  getThread(gmailThreadId: string): Observable<EmailThreadDto> {
    return this.api.get<EmailThreadDto>(`${this.emailBasePath}/thread/${gmailThreadId}`);
  }

  send(request: SendEmailRequest): Observable<EmailDetailDto> {
    return this.api.post<EmailDetailDto>(`${this.emailBasePath}/send`, request);
  }

  getByContact(contactId: string, params: EntityQueryParams): Observable<PagedResult<EmailListDto>> {
    const httpParams = this.buildQueryParams(params);
    return this.api.get<PagedResult<EmailListDto>>(
      `${this.emailBasePath}/by-contact/${contactId}`,
      httpParams,
    );
  }

  getByCompany(companyId: string, params: EntityQueryParams): Observable<PagedResult<EmailListDto>> {
    const httpParams = this.buildQueryParams(params);
    return this.api.get<PagedResult<EmailListDto>>(
      `${this.emailBasePath}/by-company/${companyId}`,
      httpParams,
    );
  }

  markAsRead(id: string): Observable<void> {
    return this.api.patch<void>(`${this.emailBasePath}/${id}/read`);
  }

  toggleStar(id: string): Observable<EmailDetailDto> {
    return this.api.patch<EmailDetailDto>(`${this.emailBasePath}/${id}/star`);
  }

  // ─── Account Management (4 methods matching EmailAccountsController) ─────

  getAccountStatus(): Observable<EmailAccountStatusDto> {
    return this.api.get<EmailAccountStatusDto>(`${this.accountBasePath}/status`);
  }

  connect(): Observable<ConnectResponse> {
    return this.api.get<ConnectResponse>(`${this.accountBasePath}/connect`);
  }

  disconnect(): Observable<void> {
    return this.api.post<void>(`${this.accountBasePath}/disconnect`);
  }

  triggerSync(): Observable<void> {
    return this.api.post<void>(`${this.accountBasePath}/sync`);
  }

  // ─── Query Param Builder ─────────────────────────────────────────────────

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

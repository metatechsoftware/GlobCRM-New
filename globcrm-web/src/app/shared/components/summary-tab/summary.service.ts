import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/api/api.service';
import {
  CompanySummaryDto,
  ContactSummaryDto,
  DealSummaryDto,
  LeadSummaryDto,
  QuoteSummaryDto,
  RequestSummaryDto,
} from './summary.models';

@Injectable({ providedIn: 'root' })
export class SummaryService {
  private readonly api = inject(ApiService);

  getCompanySummary(id: string): Observable<CompanySummaryDto> {
    return this.api.get<CompanySummaryDto>(`/api/companies/${id}/summary`);
  }

  getContactSummary(id: string): Observable<ContactSummaryDto> {
    return this.api.get<ContactSummaryDto>(`/api/contacts/${id}/summary`);
  }

  getDealSummary(id: string): Observable<DealSummaryDto> {
    return this.api.get<DealSummaryDto>(`/api/deals/${id}/summary`);
  }

  getLeadSummary(id: string): Observable<LeadSummaryDto> {
    return this.api.get<LeadSummaryDto>(`/api/leads/${id}/summary`);
  }

  getQuoteSummary(id: string): Observable<QuoteSummaryDto> {
    return this.api.get<QuoteSummaryDto>(`/api/quotes/${id}/summary`);
  }

  getRequestSummary(id: string): Observable<RequestSummaryDto> {
    return this.api.get<RequestSummaryDto>(`/api/requests/${id}/summary`);
  }
}

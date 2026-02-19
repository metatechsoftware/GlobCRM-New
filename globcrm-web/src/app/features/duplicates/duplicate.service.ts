import { Injectable, inject } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/api/api.service';
import {
  ContactDuplicateMatch,
  CompanyDuplicateMatch,
  DuplicateScanResult,
  MergePreview,
  MergeRequest,
  MergeResult,
  ContactComparison,
  CompanyComparison,
  DuplicateSettings,
} from './duplicate.models';

/**
 * API service for duplicate detection and merge operations.
 * Covers check, scan, merge-preview, comparison, merge, and settings endpoints.
 */
@Injectable({ providedIn: 'root' })
export class DuplicateService {
  private readonly api = inject(ApiService);
  private readonly basePath = '/api/duplicates';
  private readonly settingsPath = '/api/duplicate-settings';

  // ---- Real-time check (create form warnings) ----

  checkContactDuplicates(request: {
    firstName: string;
    lastName: string;
    email?: string;
  }): Observable<ContactDuplicateMatch[]> {
    return this.api.post<ContactDuplicateMatch[]>(
      `${this.basePath}/check/contacts`,
      request
    );
  }

  checkCompanyDuplicates(request: {
    name: string;
    website?: string;
  }): Observable<CompanyDuplicateMatch[]> {
    return this.api.post<CompanyDuplicateMatch[]>(
      `${this.basePath}/check/companies`,
      request
    );
  }

  // ---- On-demand scan ----

  scanContacts(
    page: number,
    pageSize: number
  ): Observable<DuplicateScanResult> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('pageSize', pageSize.toString());
    return this.api.get<DuplicateScanResult>(
      `${this.basePath}/scan/contacts`,
      params
    );
  }

  scanCompanies(
    page: number,
    pageSize: number
  ): Observable<DuplicateScanResult> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('pageSize', pageSize.toString());
    return this.api.get<DuplicateScanResult>(
      `${this.basePath}/scan/companies`,
      params
    );
  }

  // ---- Merge preview ----

  getContactMergePreview(
    survivorId: string,
    loserId: string
  ): Observable<MergePreview> {
    const params = new HttpParams()
      .set('survivorId', survivorId)
      .set('loserId', loserId);
    return this.api.get<MergePreview>(
      `${this.basePath}/merge-preview/contacts`,
      params
    );
  }

  getCompanyMergePreview(
    survivorId: string,
    loserId: string
  ): Observable<MergePreview> {
    const params = new HttpParams()
      .set('survivorId', survivorId)
      .set('loserId', loserId);
    return this.api.get<MergePreview>(
      `${this.basePath}/merge-preview/companies`,
      params
    );
  }

  // ---- Merge execution ----

  mergeContacts(request: MergeRequest): Observable<MergeResult> {
    return this.api.post<MergeResult>(
      `${this.basePath}/merge/contacts`,
      request
    );
  }

  mergeCompanies(request: MergeRequest): Observable<MergeResult> {
    return this.api.post<MergeResult>(
      `${this.basePath}/merge/companies`,
      request
    );
  }

  // ---- Comparison ----

  getContactComparison(
    id: string,
    otherId: string
  ): Observable<ContactComparison> {
    const params = new HttpParams().set('otherId', otherId);
    return this.api.get<ContactComparison>(
      `${this.basePath}/contacts/${id}/comparison`,
      params
    );
  }

  getCompanyComparison(
    id: string,
    otherId: string
  ): Observable<CompanyComparison> {
    const params = new HttpParams().set('otherId', otherId);
    return this.api.get<CompanyComparison>(
      `${this.basePath}/companies/${id}/comparison`,
      params
    );
  }

  // ---- Settings ----

  getSettings(): Observable<DuplicateSettings[]> {
    return this.api.get<DuplicateSettings[]>(this.settingsPath);
  }

  getSettingsByEntityType(entityType: string): Observable<DuplicateSettings> {
    return this.api.get<DuplicateSettings>(
      `${this.settingsPath}/${entityType}`
    );
  }

  updateSettings(
    entityType: string,
    request: {
      autoDetectionEnabled: boolean;
      similarityThreshold: number;
      matchingFields?: string[];
    }
  ): Observable<DuplicateSettings> {
    return this.api.put<DuplicateSettings>(
      `${this.settingsPath}/${entityType}`,
      request
    );
  }
}

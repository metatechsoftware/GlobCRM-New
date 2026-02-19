import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpParams } from '@angular/common/http';
import { ApiService } from '../../core/api/api.service';
import {
  SequenceListItem,
  SequenceDetail,
  SequenceStep,
  PagedEnrollments,
  SequenceAnalytics,
  StepMetrics,
  FunnelData,
  BulkEnrollResult,
  CreateSequenceRequest,
  UpdateSequenceRequest,
  AddStepRequest,
  UpdateStepRequest,
  EnrollContactRequest,
  BulkEnrollRequest,
} from './sequence.models';

/**
 * API service for email sequence CRUD, step management,
 * enrollment (single + bulk), pause/resume, and analytics.
 * Maps to SequencesController endpoints at /api/sequences.
 */
@Injectable({ providedIn: 'root' })
export class SequenceService {
  private readonly api = inject(ApiService);
  private readonly basePath = '/api/sequences';

  // ---- Sequence CRUD ----

  getSequences(): Observable<SequenceListItem[]> {
    return this.api.get<SequenceListItem[]>(this.basePath);
  }

  getSequence(id: string): Observable<SequenceDetail> {
    return this.api.get<SequenceDetail>(`${this.basePath}/${id}`);
  }

  createSequence(request: CreateSequenceRequest): Observable<SequenceDetail> {
    return this.api.post<SequenceDetail>(this.basePath, request);
  }

  updateSequence(
    id: string,
    request: UpdateSequenceRequest,
  ): Observable<SequenceDetail> {
    return this.api.put<SequenceDetail>(`${this.basePath}/${id}`, request);
  }

  deleteSequence(id: string): Observable<void> {
    return this.api.delete<void>(`${this.basePath}/${id}`);
  }

  // ---- Step Management ----

  addStep(
    sequenceId: string,
    request: AddStepRequest,
  ): Observable<SequenceStep> {
    return this.api.post<SequenceStep>(
      `${this.basePath}/${sequenceId}/steps`,
      request,
    );
  }

  updateStep(
    sequenceId: string,
    stepId: string,
    request: UpdateStepRequest,
  ): Observable<SequenceStep> {
    return this.api.put<SequenceStep>(
      `${this.basePath}/${sequenceId}/steps/${stepId}`,
      request,
    );
  }

  deleteStep(sequenceId: string, stepId: string): Observable<void> {
    return this.api.delete<void>(
      `${this.basePath}/${sequenceId}/steps/${stepId}`,
    );
  }

  reorderSteps(
    sequenceId: string,
    stepIds: string[],
  ): Observable<{ message: string }> {
    return this.api.put<{ message: string }>(
      `${this.basePath}/${sequenceId}/steps/reorder`,
      { stepIds },
    );
  }

  // ---- Enrollment Management ----

  enrollContact(
    sequenceId: string,
    request: EnrollContactRequest,
  ): Observable<any> {
    return this.api.post<any>(
      `${this.basePath}/${sequenceId}/enrollments`,
      request,
    );
  }

  bulkEnroll(
    sequenceId: string,
    request: BulkEnrollRequest,
  ): Observable<BulkEnrollResult> {
    return this.api.post<BulkEnrollResult>(
      `${this.basePath}/${sequenceId}/enrollments/bulk`,
      request,
    );
  }

  getEnrollments(
    sequenceId: string,
    page: number = 1,
    pageSize: number = 25,
  ): Observable<PagedEnrollments> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('pageSize', pageSize.toString());

    return this.api.get<PagedEnrollments>(
      `${this.basePath}/${sequenceId}/enrollments`,
      params,
    );
  }

  pauseEnrollment(
    sequenceId: string,
    enrollmentId: string,
  ): Observable<{ message: string }> {
    return this.api.put<{ message: string }>(
      `${this.basePath}/${sequenceId}/enrollments/${enrollmentId}/pause`,
    );
  }

  resumeEnrollment(
    sequenceId: string,
    enrollmentId: string,
  ): Observable<{ message: string }> {
    return this.api.put<{ message: string }>(
      `${this.basePath}/${sequenceId}/enrollments/${enrollmentId}/resume`,
    );
  }

  unenroll(sequenceId: string, enrollmentId: string): Observable<void> {
    return this.api.delete<void>(
      `${this.basePath}/${sequenceId}/enrollments/${enrollmentId}`,
    );
  }

  bulkPauseEnrollments(
    sequenceId: string,
    enrollmentIds: string[],
  ): Observable<{ paused: number }> {
    return this.api.put<{ paused: number }>(
      `${this.basePath}/${sequenceId}/enrollments/bulk-pause`,
      { enrollmentIds },
    );
  }

  bulkResumeEnrollments(
    sequenceId: string,
    enrollmentIds: string[],
  ): Observable<{ resumed: number }> {
    return this.api.put<{ resumed: number }>(
      `${this.basePath}/${sequenceId}/enrollments/bulk-resume`,
      { enrollmentIds },
    );
  }

  // ---- Usage ----

  getSequenceUsage(id: string): Observable<{ usedByCount: number; workflows: { id: string; name: string }[] }> {
    return this.api.get<{ usedByCount: number; workflows: { id: string; name: string }[] }>(
      `${this.basePath}/${id}/usage`
    );
  }

  // ---- Analytics ----

  getAnalytics(sequenceId: string): Observable<SequenceAnalytics> {
    return this.api.get<SequenceAnalytics>(
      `${this.basePath}/${sequenceId}/analytics`,
    );
  }

  getStepMetrics(sequenceId: string): Observable<StepMetrics[]> {
    return this.api.get<StepMetrics[]>(
      `${this.basePath}/${sequenceId}/analytics/steps`,
    );
  }

  getFunnelData(sequenceId: string): Observable<FunnelData[]> {
    return this.api.get<FunnelData[]>(
      `${this.basePath}/${sequenceId}/analytics/funnel`,
    );
  }
}

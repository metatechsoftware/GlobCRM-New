import { inject } from '@angular/core';
import {
  signalStore,
  withState,
  withMethods,
  patchState,
} from '@ngrx/signals';
import { SequenceService } from './sequence.service';
import {
  SequenceListItem,
  SequenceDetail,
  SequenceStep,
  EnrollmentListItem,
  PagedEnrollments,
  SequenceAnalytics,
  StepMetrics,
  FunnelData,
  CreateSequenceRequest,
  UpdateSequenceRequest,
  AddStepRequest,
  UpdateStepRequest,
  EnrollContactRequest,
  BulkEnrollRequest,
  BulkEnrollResult,
} from './sequence.models';

interface SequenceState {
  sequences: SequenceListItem[];
  selectedSequence: SequenceDetail | null;
  enrollments: PagedEnrollments | null;
  analytics: SequenceAnalytics | null;
  stepMetrics: StepMetrics[];
  funnelData: FunnelData[];
  loading: boolean;
  error: string | null;
}

const initialState: SequenceState = {
  sequences: [],
  selectedSequence: null,
  enrollments: null,
  analytics: null,
  stepMetrics: [],
  funnelData: [],
  loading: false,
  error: null,
};

/**
 * NgRx Signal Store for email sequence state management.
 * Component-provided (not root) so each page gets its own instance.
 * Manages sequences list, selected sequence, enrollments, and analytics.
 */
export const SequenceStore = signalStore(
  withState(initialState),
  withMethods((store) => {
    const service = inject(SequenceService);

    return {
      // ---- Sequence CRUD ----

      loadSequences(): void {
        patchState(store, { loading: true, error: null });
        service.getSequences().subscribe({
          next: (sequences) => {
            patchState(store, { sequences, loading: false });
          },
          error: (err) => {
            patchState(store, {
              loading: false,
              error: err?.message ?? 'Failed to load sequences',
            });
          },
        });
      },

      loadSequence(id: string): void {
        patchState(store, { loading: true, error: null });
        service.getSequence(id).subscribe({
          next: (sequence) => {
            patchState(store, {
              selectedSequence: sequence,
              loading: false,
            });
          },
          error: (err) => {
            patchState(store, {
              loading: false,
              error: err?.message ?? 'Failed to load sequence',
            });
          },
        });
      },

      createSequence(
        request: CreateSequenceRequest,
        onSuccess?: (sequence: SequenceDetail) => void,
      ): void {
        patchState(store, { loading: true, error: null });
        service.createSequence(request).subscribe({
          next: (created) => {
            patchState(store, { loading: false });
            onSuccess?.(created);
          },
          error: (err) => {
            patchState(store, {
              loading: false,
              error: err?.message ?? 'Failed to create sequence',
            });
          },
        });
      },

      updateSequence(
        id: string,
        request: UpdateSequenceRequest,
        onSuccess?: (sequence: SequenceDetail) => void,
      ): void {
        patchState(store, { loading: true, error: null });
        service.updateSequence(id, request).subscribe({
          next: (updated) => {
            patchState(store, {
              selectedSequence: updated,
              loading: false,
            });
            onSuccess?.(updated);
          },
          error: (err) => {
            patchState(store, {
              loading: false,
              error: err?.message ?? 'Failed to update sequence',
            });
          },
        });
      },

      deleteSequence(id: string, onSuccess?: () => void): void {
        service.deleteSequence(id).subscribe({
          next: () => {
            patchState(store, {
              sequences: store.sequences().filter((s) => s.id !== id),
            });
            onSuccess?.();
          },
          error: (err) => {
            patchState(store, {
              error: err?.message ?? 'Failed to delete sequence',
            });
          },
        });
      },

      // ---- Step Management ----

      addStep(
        sequenceId: string,
        request: AddStepRequest,
        onSuccess?: (step: SequenceStep) => void,
      ): void {
        service.addStep(sequenceId, request).subscribe({
          next: (step) => {
            const seq = store.selectedSequence();
            if (seq) {
              patchState(store, {
                selectedSequence: {
                  ...seq,
                  steps: [...seq.steps, step],
                },
              });
            }
            onSuccess?.(step);
          },
          error: (err) => {
            patchState(store, {
              error: err?.message ?? 'Failed to add step',
            });
          },
        });
      },

      updateStep(
        sequenceId: string,
        stepId: string,
        request: UpdateStepRequest,
        onSuccess?: (step: SequenceStep) => void,
      ): void {
        service.updateStep(sequenceId, stepId, request).subscribe({
          next: (updated) => {
            const seq = store.selectedSequence();
            if (seq) {
              patchState(store, {
                selectedSequence: {
                  ...seq,
                  steps: seq.steps.map((s) =>
                    s.id === stepId ? updated : s,
                  ),
                },
              });
            }
            onSuccess?.(updated);
          },
          error: (err) => {
            patchState(store, {
              error: err?.message ?? 'Failed to update step',
            });
          },
        });
      },

      deleteStep(
        sequenceId: string,
        stepId: string,
        onSuccess?: () => void,
      ): void {
        service.deleteStep(sequenceId, stepId).subscribe({
          next: () => {
            const seq = store.selectedSequence();
            if (seq) {
              const remaining = seq.steps
                .filter((s) => s.id !== stepId)
                .map((s, i) => ({ ...s, stepNumber: i + 1 }));
              patchState(store, {
                selectedSequence: { ...seq, steps: remaining },
              });
            }
            onSuccess?.();
          },
          error: (err) => {
            patchState(store, {
              error: err?.message ?? 'Failed to delete step',
            });
          },
        });
      },

      reorderSteps(sequenceId: string, stepIds: string[]): void {
        service.reorderSteps(sequenceId, stepIds).subscribe({
          error: (err) => {
            patchState(store, {
              error: err?.message ?? 'Failed to reorder steps',
            });
          },
        });
      },

      // ---- Enrollment Management ----

      loadEnrollments(
        sequenceId: string,
        page: number = 1,
        pageSize: number = 25,
      ): void {
        patchState(store, { loading: true, error: null });
        service.getEnrollments(sequenceId, page, pageSize).subscribe({
          next: (enrollments) => {
            patchState(store, { enrollments, loading: false });
          },
          error: (err) => {
            patchState(store, {
              loading: false,
              error: err?.message ?? 'Failed to load enrollments',
            });
          },
        });
      },

      enrollContact(
        sequenceId: string,
        request: EnrollContactRequest,
        onSuccess?: (result: any) => void,
      ): void {
        service.enrollContact(sequenceId, request).subscribe({
          next: (result) => {
            onSuccess?.(result);
          },
          error: (err) => {
            patchState(store, {
              error: err?.message ?? 'Failed to enroll contact',
            });
          },
        });
      },

      bulkEnroll(
        sequenceId: string,
        request: BulkEnrollRequest,
        onSuccess?: (result: BulkEnrollResult) => void,
      ): void {
        service.bulkEnroll(sequenceId, request).subscribe({
          next: (result) => {
            onSuccess?.(result);
          },
          error: (err) => {
            patchState(store, {
              error: err?.message ?? 'Failed to bulk enroll contacts',
            });
          },
        });
      },

      pauseEnrollment(
        sequenceId: string,
        enrollmentId: string,
        onSuccess?: () => void,
      ): void {
        service.pauseEnrollment(sequenceId, enrollmentId).subscribe({
          next: () => {
            const enrollments = store.enrollments();
            if (enrollments) {
              patchState(store, {
                enrollments: {
                  ...enrollments,
                  items: enrollments.items.map((e) =>
                    e.id === enrollmentId
                      ? { ...e, status: 'paused' as const, pausedAt: new Date().toISOString() }
                      : e,
                  ),
                },
              });
            }
            onSuccess?.();
          },
          error: (err) => {
            patchState(store, {
              error: err?.message ?? 'Failed to pause enrollment',
            });
          },
        });
      },

      resumeEnrollment(
        sequenceId: string,
        enrollmentId: string,
        onSuccess?: () => void,
      ): void {
        service.resumeEnrollment(sequenceId, enrollmentId).subscribe({
          next: () => {
            const enrollments = store.enrollments();
            if (enrollments) {
              patchState(store, {
                enrollments: {
                  ...enrollments,
                  items: enrollments.items.map((e) =>
                    e.id === enrollmentId
                      ? { ...e, status: 'active' as const, pausedAt: null }
                      : e,
                  ),
                },
              });
            }
            onSuccess?.();
          },
          error: (err) => {
            patchState(store, {
              error: err?.message ?? 'Failed to resume enrollment',
            });
          },
        });
      },

      unenroll(
        sequenceId: string,
        enrollmentId: string,
        onSuccess?: () => void,
      ): void {
        service.unenroll(sequenceId, enrollmentId).subscribe({
          next: () => {
            const enrollments = store.enrollments();
            if (enrollments) {
              patchState(store, {
                enrollments: {
                  ...enrollments,
                  items: enrollments.items.filter(
                    (e) => e.id !== enrollmentId,
                  ),
                  totalCount: enrollments.totalCount - 1,
                },
              });
            }
            onSuccess?.();
          },
          error: (err) => {
            patchState(store, {
              error: err?.message ?? 'Failed to unenroll contact',
            });
          },
        });
      },

      bulkPauseEnrollments(
        sequenceId: string,
        enrollmentIds: string[],
        onSuccess?: (result: { paused: number }) => void,
      ): void {
        service.bulkPauseEnrollments(sequenceId, enrollmentIds).subscribe({
          next: (result) => {
            const enrollments = store.enrollments();
            if (enrollments) {
              patchState(store, {
                enrollments: {
                  ...enrollments,
                  items: enrollments.items.map((e) =>
                    enrollmentIds.includes(e.id)
                      ? { ...e, status: 'paused' as const, pausedAt: new Date().toISOString() }
                      : e,
                  ),
                },
              });
            }
            onSuccess?.(result);
          },
          error: (err) => {
            patchState(store, {
              error: err?.message ?? 'Failed to bulk pause enrollments',
            });
          },
        });
      },

      bulkResumeEnrollments(
        sequenceId: string,
        enrollmentIds: string[],
        onSuccess?: (result: { resumed: number }) => void,
      ): void {
        service.bulkResumeEnrollments(sequenceId, enrollmentIds).subscribe({
          next: (result) => {
            const enrollments = store.enrollments();
            if (enrollments) {
              patchState(store, {
                enrollments: {
                  ...enrollments,
                  items: enrollments.items.map((e) =>
                    enrollmentIds.includes(e.id)
                      ? { ...e, status: 'active' as const, pausedAt: null }
                      : e,
                  ),
                },
              });
            }
            onSuccess?.(result);
          },
          error: (err) => {
            patchState(store, {
              error: err?.message ?? 'Failed to bulk resume enrollments',
            });
          },
        });
      },

      // ---- Analytics ----

      loadAnalytics(sequenceId: string): void {
        service.getAnalytics(sequenceId).subscribe({
          next: (analytics) => {
            patchState(store, { analytics });
          },
          error: (err) => {
            patchState(store, {
              error: err?.message ?? 'Failed to load analytics',
            });
          },
        });
      },

      loadStepMetrics(sequenceId: string): void {
        service.getStepMetrics(sequenceId).subscribe({
          next: (stepMetrics) => {
            patchState(store, { stepMetrics });
          },
          error: (err) => {
            patchState(store, {
              error: err?.message ?? 'Failed to load step metrics',
            });
          },
        });
      },

      loadFunnelData(sequenceId: string): void {
        service.getFunnelData(sequenceId).subscribe({
          next: (funnelData) => {
            patchState(store, { funnelData });
          },
          error: (err) => {
            patchState(store, {
              error: err?.message ?? 'Failed to load funnel data',
            });
          },
        });
      },
    };
  }),
);

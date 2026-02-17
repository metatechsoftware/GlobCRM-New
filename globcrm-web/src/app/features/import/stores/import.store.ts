import { inject } from '@angular/core';
import {
  signalStore,
  withState,
  withComputed,
  withMethods,
  patchState,
} from '@ngrx/signals';
import { computed } from '@angular/core';
import { ImportService } from '../import.service';
import {
  ImportJob,
  UploadResponse,
  PreviewResponse,
  ImportProgress,
  ImportEntityType,
  ImportFieldMapping,
  DuplicateStrategy,
} from '../import.models';

interface ImportState {
  currentJob: ImportJob | null;
  uploadResponse: UploadResponse | null;
  previewResponse: PreviewResponse | null;
  progress: ImportProgress | null;
  loading: boolean;
  error: string | null;
  step: number;
}

const initialState: ImportState = {
  currentJob: null,
  uploadResponse: null,
  previewResponse: null,
  progress: null,
  loading: false,
  error: null,
  step: 0,
};

/**
 * Import wizard signal store -- component-provided (NOT root).
 * Each import wizard instance gets its own store.
 * Manages import job state, upload response, preview, progress, and wizard step.
 * SignalR subscription is handled by the wizard component, not the store.
 */
export const ImportStore = signalStore(
  withState(initialState),
  withComputed((store) => ({
    /** Whether an upload response is available (file uploaded successfully). */
    hasUpload: computed(() => store.uploadResponse() !== null),
    /** Whether a preview response is available. */
    hasPreview: computed(() => store.previewResponse() !== null),
    /** Whether the import is currently executing. */
    isExecuting: computed(() => {
      const progress = store.progress();
      return progress !== null && progress.status === 'Processing';
    }),
    /** Whether the import has completed (success or failure). */
    isComplete: computed(() => {
      const progress = store.progress();
      return progress !== null && (progress.status === 'Completed' || progress.status === 'Failed');
    }),
    /** Progress percentage (0-100). */
    progressPercent: computed(() => {
      const progress = store.progress();
      if (!progress || progress.totalRows === 0) return 0;
      return Math.round((progress.processedRows / progress.totalRows) * 100);
    }),
  })),
  withMethods((store) => {
    const importService = inject(ImportService);

    return {
      /** Upload a CSV file and store the response. */
      upload(file: File, entityType: ImportEntityType): void {
        patchState(store, { loading: true, error: null });
        importService.upload(file, entityType).subscribe({
          next: (response) => {
            patchState(store, {
              uploadResponse: response,
              loading: false,
              step: 1,
            });
          },
          error: (err) => {
            patchState(store, {
              loading: false,
              error: err.message ?? 'Upload failed',
            });
          },
        });
      },

      /** Save field mappings and duplicate strategy, then advance to preview step. */
      saveMapping(
        mappings: ImportFieldMapping[],
        duplicateStrategy: DuplicateStrategy,
      ): void {
        const jobId = store.uploadResponse()?.importJobId;
        if (!jobId) return;

        patchState(store, { loading: true, error: null });
        importService.saveMapping(jobId, mappings, duplicateStrategy).subscribe({
          next: () => {
            patchState(store, { loading: false, step: 2 });
          },
          error: (err) => {
            patchState(store, {
              loading: false,
              error: err.message ?? 'Failed to save mapping',
            });
          },
        });
      },

      /** Run validation preview and store the results. */
      preview(): void {
        const jobId = store.uploadResponse()?.importJobId;
        if (!jobId) return;

        patchState(store, { loading: true, error: null });
        importService.preview(jobId).subscribe({
          next: (response) => {
            patchState(store, {
              previewResponse: response,
              loading: false,
            });
          },
          error: (err) => {
            patchState(store, {
              loading: false,
              error: err.message ?? 'Preview failed',
            });
          },
        });
      },

      /** Execute the import (backend processes async with SignalR progress). */
      execute(): void {
        const jobId = store.uploadResponse()?.importJobId;
        if (!jobId) return;

        patchState(store, {
          loading: true,
          error: null,
          step: 3,
          progress: {
            importJobId: jobId,
            processedRows: 0,
            totalRows: store.uploadResponse()?.totalRows ?? 0,
            successCount: 0,
            errorCount: 0,
            status: 'Processing',
          },
        });
        importService.execute(jobId).subscribe({
          next: () => {
            patchState(store, { loading: false });
          },
          error: (err) => {
            patchState(store, {
              loading: false,
              error: err.message ?? 'Execute failed',
            });
          },
        });
      },

      /** Update progress from a SignalR event. */
      updateProgress(progress: ImportProgress): void {
        patchState(store, { progress });

        // Fetch full job details on completion for error list
        if (progress.status === 'Completed' || progress.status === 'Failed') {
          importService.getJob(progress.importJobId).subscribe({
            next: (job) => {
              patchState(store, { currentJob: job });
            },
          });
        }
      },

      /** Set the current wizard step (0-3). */
      setStep(step: number): void {
        patchState(store, { step });
      },

      /** Reset the store to initial state for a new import. */
      reset(): void {
        patchState(store, { ...initialState });
      },
    };
  }),
);

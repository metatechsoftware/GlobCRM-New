import { inject } from '@angular/core';
import {
  signalStore,
  withState,
  withMethods,
  patchState,
} from '@ngrx/signals';
import { ReportService } from './report.service';
import {
  Report,
  ReportListItem,
  ReportCategory,
  ReportExecutionResult,
  ReportFieldMetadata,
  CreateReportRequest,
  UpdateReportRequest,
  ExecuteReportRequest,
} from './report.models';

interface ReportState {
  reports: ReportListItem[];
  categories: ReportCategory[];
  selectedReport: Report | null;
  executionResult: ReportExecutionResult | null;
  fieldMetadata: ReportFieldMetadata | null;
  loading: boolean;
  executing: boolean;
  exporting: boolean;
  error: string | null;
  totalCount: number;
  currentPage: number;
  selectedCategory: string | null;
  selectedEntityType: string | null;
  searchQuery: string;
}

const initialState: ReportState = {
  reports: [],
  categories: [],
  selectedReport: null,
  executionResult: null,
  fieldMetadata: null,
  loading: false,
  executing: false,
  exporting: false,
  error: null,
  totalCount: 0,
  currentPage: 1,
  selectedCategory: null,
  selectedEntityType: null,
  searchQuery: '',
};

/**
 * NgRx Signal Store for report state management.
 * Component-provided (not root) so each page gets its own instance.
 * Manages report gallery, selected report, execution results, field metadata,
 * and categories.
 */
export const ReportStore = signalStore(
  withState(initialState),
  withMethods((store) => {
    const service = inject(ReportService);

    return {
      // ---- Report CRUD ----

      loadReports(params?: {
        categoryId?: string;
        entityType?: string;
        search?: string;
        page?: number;
        pageSize?: number;
      }): void {
        patchState(store, { loading: true, error: null });
        service.getReports(params).subscribe({
          next: (response) => {
            patchState(store, {
              reports: response.items,
              totalCount: response.totalCount,
              currentPage: response.page,
              loading: false,
            });
          },
          error: (err) => {
            patchState(store, {
              loading: false,
              error: err?.message ?? 'Failed to load reports',
            });
          },
        });
      },

      loadReport(id: string): void {
        patchState(store, { loading: true, error: null });
        service.getReport(id).subscribe({
          next: (report) => {
            patchState(store, {
              selectedReport: report,
              loading: false,
            });
          },
          error: (err) => {
            patchState(store, {
              loading: false,
              error: err?.message ?? 'Failed to load report',
            });
          },
        });
      },

      createReport(
        request: CreateReportRequest,
        onSuccess?: (report: Report) => void,
      ): void {
        patchState(store, { loading: true, error: null });
        service.createReport(request).subscribe({
          next: (created) => {
            patchState(store, { loading: false });
            onSuccess?.(created);
          },
          error: (err) => {
            patchState(store, {
              loading: false,
              error: err?.message ?? 'Failed to create report',
            });
          },
        });
      },

      updateReport(
        id: string,
        request: UpdateReportRequest,
        onSuccess?: (report: Report) => void,
      ): void {
        patchState(store, { loading: true, error: null });
        service.updateReport(id, request).subscribe({
          next: (updated) => {
            patchState(store, {
              selectedReport: updated,
              loading: false,
            });
            onSuccess?.(updated);
          },
          error: (err) => {
            patchState(store, {
              loading: false,
              error: err?.message ?? 'Failed to update report',
            });
          },
        });
      },

      deleteReport(id: string, onSuccess?: () => void): void {
        service.deleteReport(id).subscribe({
          next: () => {
            patchState(store, {
              reports: store.reports().filter((r) => r.id !== id),
              totalCount: store.totalCount() - 1,
            });
            onSuccess?.();
          },
          error: (err) => {
            patchState(store, {
              error: err?.message ?? 'Failed to delete report',
            });
          },
        });
      },

      // ---- Execution ----

      executeReport(
        id: string,
        request?: ExecuteReportRequest,
        onSuccess?: (result: ReportExecutionResult) => void,
      ): void {
        patchState(store, { executing: true, error: null });
        service.executeReport(id, request).subscribe({
          next: (result) => {
            patchState(store, {
              executionResult: result,
              executing: false,
            });
            onSuccess?.(result);
          },
          error: (err) => {
            patchState(store, {
              executing: false,
              error: err?.message ?? 'Failed to execute report',
            });
          },
        });
      },

      // ---- Field Metadata ----

      loadFieldMetadata(entityType: string): void {
        patchState(store, { fieldMetadata: null, error: null });
        service.getFieldMetadata(entityType).subscribe({
          next: (metadata) => {
            patchState(store, { fieldMetadata: metadata, error: null });
          },
          error: (err) => {
            patchState(store, {
              fieldMetadata: null,
              error: err?.error?.error ?? err?.message ?? `Failed to load fields for ${entityType}`,
            });
          },
        });
      },

      // ---- Share / Clone / Export ----

      toggleShare(id: string, isShared: boolean): void {
        service.toggleShare(id, isShared).subscribe({
          next: () => {
            patchState(store, {
              reports: store.reports().map((r) =>
                r.id === id ? { ...r, isShared } : r,
              ),
            });
            if (store.selectedReport()?.id === id) {
              patchState(store, {
                selectedReport: { ...store.selectedReport()!, isShared },
              });
            }
          },
          error: (err) => {
            patchState(store, {
              error: err?.message ?? 'Failed to toggle share',
            });
          },
        });
      },

      cloneReport(id: string, name?: string, onSuccess?: (report: Report) => void): void {
        patchState(store, { loading: true, error: null });
        service.cloneReport(id, name).subscribe({
          next: (cloned) => {
            patchState(store, { loading: false });
            onSuccess?.(cloned);
          },
          error: (err) => {
            patchState(store, {
              loading: false,
              error: err?.message ?? 'Failed to clone report',
            });
          },
        });
      },

      exportCsv(id: string, onSuccess?: (jobId: string) => void): void {
        patchState(store, { exporting: true, error: null });
        service.exportCsv(id).subscribe({
          next: (result) => {
            patchState(store, { exporting: false });
            onSuccess?.(result.jobId);
          },
          error: (err) => {
            patchState(store, {
              exporting: false,
              error: err?.message ?? 'Failed to export CSV',
            });
          },
        });
      },

      // ---- Categories ----

      loadCategories(): void {
        service.getCategories().subscribe({
          next: (categories) => {
            patchState(store, { categories });
          },
          error: (err) => {
            patchState(store, {
              error: err?.message ?? 'Failed to load categories',
            });
          },
        });
      },

      // ---- Filters ----

      setFilter(filter: {
        category?: string | null;
        entityType?: string | null;
        search?: string;
      }): void {
        patchState(store, {
          selectedCategory: filter.category ?? store.selectedCategory(),
          selectedEntityType: filter.entityType ?? store.selectedEntityType(),
          searchQuery: filter.search ?? store.searchQuery(),
        });
      },
    };
  }),
);

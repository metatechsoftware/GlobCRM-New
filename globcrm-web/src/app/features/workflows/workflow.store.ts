import { inject } from '@angular/core';
import {
  signalStore,
  withState,
  withMethods,
  patchState,
} from '@ngrx/signals';
import { WorkflowService } from './workflow.service';
import {
  Workflow,
  WorkflowListItem,
  WorkflowExecutionLog,
  WorkflowTemplateListItem,
  CreateWorkflowRequest,
  UpdateWorkflowRequest,
} from './workflow.models';

interface WorkflowState {
  workflows: WorkflowListItem[];
  selectedWorkflow: Workflow | null;
  executionLogs: WorkflowExecutionLog[];
  templates: WorkflowTemplateListItem[];
  loading: boolean;
  error: string | null;
  totalCount: number;
  currentPage: number;
}

const initialState: WorkflowState = {
  workflows: [],
  selectedWorkflow: null,
  executionLogs: [],
  templates: [],
  loading: false,
  error: null,
  totalCount: 0,
  currentPage: 1,
};

/**
 * NgRx Signal Store for workflow automation state management.
 * Component-provided (not root) so each page gets its own instance.
 * Manages workflow list, selected workflow, execution logs, and templates.
 */
export const WorkflowStore = signalStore(
  withState(initialState),
  withMethods((store) => {
    const service = inject(WorkflowService);

    return {
      // ---- Workflow CRUD ----

      loadWorkflows(params?: {
        entityType?: string;
        status?: string;
        page?: number;
        pageSize?: number;
      }): void {
        patchState(store, { loading: true, error: null });
        service.getWorkflows(params).subscribe({
          next: (response) => {
            patchState(store, {
              workflows: response.items,
              totalCount: response.totalCount,
              currentPage: response.page,
              loading: false,
            });
          },
          error: (err) => {
            patchState(store, {
              loading: false,
              error: err?.message ?? 'Failed to load workflows',
            });
          },
        });
      },

      loadWorkflow(id: string): void {
        patchState(store, { loading: true, error: null });
        service.getWorkflow(id).subscribe({
          next: (workflow) => {
            patchState(store, {
              selectedWorkflow: workflow,
              loading: false,
            });
          },
          error: (err) => {
            patchState(store, {
              loading: false,
              error: err?.message ?? 'Failed to load workflow',
            });
          },
        });
      },

      createWorkflow(
        request: CreateWorkflowRequest,
        onSuccess?: (workflow: Workflow) => void,
      ): void {
        patchState(store, { loading: true, error: null });
        service.createWorkflow(request).subscribe({
          next: (created) => {
            patchState(store, { loading: false });
            onSuccess?.(created);
          },
          error: (err) => {
            patchState(store, {
              loading: false,
              error: err?.message ?? 'Failed to create workflow',
            });
          },
        });
      },

      updateWorkflow(
        id: string,
        request: UpdateWorkflowRequest,
        onSuccess?: (workflow: Workflow) => void,
      ): void {
        patchState(store, { loading: true, error: null });
        service.updateWorkflow(id, request).subscribe({
          next: (updated) => {
            patchState(store, {
              selectedWorkflow: updated,
              loading: false,
            });
            onSuccess?.(updated);
          },
          error: (err) => {
            patchState(store, {
              loading: false,
              error: err?.message ?? 'Failed to update workflow',
            });
          },
        });
      },

      deleteWorkflow(id: string, onSuccess?: () => void): void {
        service.deleteWorkflow(id).subscribe({
          next: () => {
            patchState(store, {
              workflows: store.workflows().filter((w) => w.id !== id),
              totalCount: store.totalCount() - 1,
            });
            onSuccess?.();
          },
          error: (err) => {
            patchState(store, {
              error: err?.message ?? 'Failed to delete workflow',
            });
          },
        });
      },

      toggleStatus(id: string, isActive: boolean): void {
        // Optimistic update
        patchState(store, {
          workflows: store.workflows().map((w) =>
            w.id === id
              ? {
                  ...w,
                  isActive,
                  status: isActive ? ('active' as const) : ('paused' as const),
                }
              : w,
          ),
        });

        service.updateStatus(id, isActive).subscribe({
          error: (err) => {
            // Revert on failure
            patchState(store, {
              workflows: store.workflows().map((w) =>
                w.id === id
                  ? {
                      ...w,
                      isActive: !isActive,
                      status: !isActive
                        ? ('active' as const)
                        : ('paused' as const),
                    }
                  : w,
              ),
              error: err?.message ?? 'Failed to toggle workflow status',
            });
          },
        });
      },

      duplicateWorkflow(id: string, onSuccess?: (workflow: Workflow) => void): void {
        patchState(store, { loading: true, error: null });
        service.duplicateWorkflow(id).subscribe({
          next: (duplicated) => {
            patchState(store, { loading: false });
            onSuccess?.(duplicated);
          },
          error: (err) => {
            patchState(store, {
              loading: false,
              error: err?.message ?? 'Failed to duplicate workflow',
            });
          },
        });
      },

      // ---- Execution Logs ----

      loadExecutionLogs(
        workflowId: string,
        page: number = 1,
        pageSize: number = 20,
      ): void {
        patchState(store, { loading: true, error: null });
        service.getExecutionLogs(workflowId, page, pageSize).subscribe({
          next: (response) => {
            patchState(store, {
              executionLogs: response.items,
              loading: false,
            });
          },
          error: (err) => {
            patchState(store, {
              loading: false,
              error: err?.message ?? 'Failed to load execution logs',
            });
          },
        });
      },

      // ---- Templates ----

      loadTemplates(category?: string, entityType?: string): void {
        service.getTemplates(category, entityType).subscribe({
          next: (templates) => {
            patchState(store, { templates });
          },
          error: (err) => {
            patchState(store, {
              error: err?.message ?? 'Failed to load templates',
            });
          },
        });
      },

      applyTemplate(
        templateId: string,
        onSuccess?: (workflow: Workflow) => void,
      ): void {
        patchState(store, { loading: true, error: null });
        service.applyTemplate(templateId).subscribe({
          next: (workflow) => {
            patchState(store, { loading: false });
            onSuccess?.(workflow);
          },
          error: (err) => {
            patchState(store, {
              loading: false,
              error: err?.message ?? 'Failed to apply template',
            });
          },
        });
      },
    };
  }),
);

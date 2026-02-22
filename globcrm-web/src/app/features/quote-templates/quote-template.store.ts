import { inject } from '@angular/core';
import {
  signalStore,
  withState,
  withMethods,
  patchState,
} from '@ngrx/signals';
import { QuoteTemplateService } from './quote-template.service';
import {
  QuoteTemplate,
  QuoteTemplateListItem,
  CreateQuoteTemplateRequest,
  UpdateQuoteTemplateRequest,
  MergeTagGroup,
} from './quote-template.models';

interface QuoteTemplateState {
  templates: QuoteTemplateListItem[];
  selectedTemplate: QuoteTemplate | null;
  mergeFields: Record<string, MergeTagGroup>;
  loading: boolean;
  error: string | null;
}

const initialState: QuoteTemplateState = {
  templates: [],
  selectedTemplate: null,
  mergeFields: {},
  loading: false,
  error: null,
};

/**
 * NgRx Signal Store for quote template state management.
 * Not providedIn: 'root' -- provide at route level so list and editor share state.
 * Manages templates list, selected template, merge fields, and async operations.
 * Uses callback pattern for async result handling (consistent with WebhookStore, IntegrationStore).
 */
export const QuoteTemplateStore = signalStore(
  withState(initialState),
  withMethods((store) => {
    const service = inject(QuoteTemplateService);

    return {
      loadTemplates(): void {
        patchState(store, { loading: true, error: null });

        service.getAll().subscribe({
          next: (templates) => {
            patchState(store, { templates, loading: false });
          },
          error: (err) => {
            patchState(store, {
              loading: false,
              error: err?.message ?? 'Failed to load templates',
            });
          },
        });
      },

      loadTemplate(id: string): void {
        patchState(store, { loading: true, error: null });

        service.getById(id).subscribe({
          next: (template) => {
            patchState(store, { selectedTemplate: template, loading: false });
          },
          error: (err) => {
            patchState(store, {
              loading: false,
              error: err?.message ?? 'Failed to load template',
            });
          },
        });
      },

      loadMergeFields(): void {
        service.getMergeFields().subscribe({
          next: (mergeFields) => {
            patchState(store, { mergeFields });
          },
          error: () => {},
        });
      },

      createTemplate(
        request: CreateQuoteTemplateRequest,
        onSuccess?: (template: QuoteTemplate) => void,
      ): void {
        patchState(store, { loading: true, error: null });

        service.create(request).subscribe({
          next: (created) => {
            patchState(store, {
              templates: [
                {
                  id: created.id,
                  name: created.name,
                  isDefault: created.isDefault,
                  pageSize: created.pageSize,
                  pageOrientation: created.pageOrientation,
                  thumbnailUrl: created.thumbnailUrl,
                  createdAt: created.createdAt,
                  updatedAt: created.updatedAt,
                },
                ...store.templates(),
              ],
              loading: false,
            });
            onSuccess?.(created);
          },
          error: (err) => {
            patchState(store, {
              loading: false,
              error: err?.message ?? 'Failed to create template',
            });
          },
        });
      },

      updateTemplate(
        id: string,
        request: UpdateQuoteTemplateRequest,
        onSuccess?: (template: QuoteTemplate) => void,
      ): void {
        patchState(store, { loading: true, error: null });

        service.update(id, request).subscribe({
          next: (updated) => {
            const updatedList = store.templates().map((t) =>
              t.id === id
                ? {
                    ...t,
                    name: request.name,
                    isDefault: request.isDefault,
                    pageSize: request.pageSize,
                    pageOrientation: request.pageOrientation,
                  }
                : t,
            );
            patchState(store, {
              templates: updatedList,
              selectedTemplate: updated,
              loading: false,
            });
            onSuccess?.(updated);
          },
          error: (err) => {
            patchState(store, {
              loading: false,
              error: err?.message ?? 'Failed to update template',
            });
          },
        });
      },

      deleteTemplate(id: string, onSuccess?: () => void): void {
        service.delete(id).subscribe({
          next: () => {
            patchState(store, {
              templates: store.templates().filter((t) => t.id !== id),
            });
            onSuccess?.();
          },
          error: (err) => {
            patchState(store, {
              error: err?.message ?? 'Failed to delete template',
            });
          },
        });
      },

      cloneTemplate(id: string, onSuccess?: (template: QuoteTemplate) => void): void {
        service.clone(id).subscribe({
          next: (cloned) => {
            patchState(store, {
              templates: [
                {
                  id: cloned.id,
                  name: cloned.name,
                  isDefault: cloned.isDefault,
                  pageSize: cloned.pageSize,
                  pageOrientation: cloned.pageOrientation,
                  thumbnailUrl: cloned.thumbnailUrl,
                  createdAt: cloned.createdAt,
                  updatedAt: cloned.updatedAt,
                },
                ...store.templates(),
              ],
            });
            onSuccess?.(cloned);
          },
          error: (err) => {
            patchState(store, {
              error: err?.message ?? 'Failed to clone template',
            });
          },
        });
      },

      setDefault(id: string, onSuccess?: () => void): void {
        service.setDefault(id).subscribe({
          next: () => {
            const updated = store.templates().map((t) => ({
              ...t,
              isDefault: t.id === id,
            }));
            patchState(store, { templates: updated });
            onSuccess?.();
          },
          error: (err) => {
            patchState(store, {
              error: err?.message ?? 'Failed to set default template',
            });
          },
        });
      },

      clearSelectedTemplate(): void {
        patchState(store, { selectedTemplate: null });
      },
    };
  }),
);

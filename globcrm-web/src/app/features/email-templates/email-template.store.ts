import { computed, inject } from '@angular/core';
import {
  signalStore,
  withState,
  withMethods,
  withComputed,
  patchState,
} from '@ngrx/signals';
import { EmailTemplateService } from './email-template.service';
import {
  EmailTemplate,
  EmailTemplateListItem,
  EmailTemplateCategory,
  MergeFieldGroup,
  CreateEmailTemplateRequest,
  UpdateEmailTemplateRequest,
} from './email-template.models';

interface EmailTemplateState {
  templates: EmailTemplateListItem[];
  selectedTemplate: EmailTemplate | null;
  categories: EmailTemplateCategory[];
  mergeFields: MergeFieldGroup;
  loading: boolean;
  error: string | null;
  filters: {
    categoryId?: string;
    search?: string;
  };
}

const initialState: EmailTemplateState = {
  templates: [],
  selectedTemplate: null,
  categories: [],
  mergeFields: {},
  loading: false,
  error: null,
  filters: {},
};

/**
 * NgRx Signal Store for email template state management.
 * Component-provided (not root) so each page gets its own instance.
 * Manages templates list, selected template, categories, merge fields, and filters.
 */
export const EmailTemplateStore = signalStore(
  withState(initialState),
  withComputed((store) => ({
    filteredTemplates: computed(() => {
      const templates = store.templates();
      const filters = store.filters();

      let result = templates;

      if (filters.categoryId) {
        result = result.filter((t) => t.categoryId === filters.categoryId);
      }

      if (filters.search) {
        const search = filters.search.toLowerCase();
        result = result.filter(
          (t) =>
            t.name.toLowerCase().includes(search) ||
            (t.subject && t.subject.toLowerCase().includes(search)),
        );
      }

      return result;
    }),
  })),
  withMethods((store) => {
    const service = inject(EmailTemplateService);

    return {
      loadTemplates(): void {
        patchState(store, { loading: true, error: null });

        const filters = store.filters();
        service.getTemplates(filters).subscribe({
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

        service.getTemplate(id).subscribe({
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

      loadCategories(): void {
        service.getCategories().subscribe({
          next: (categories) => {
            patchState(store, { categories });
          },
          error: () => {},
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
        request: CreateEmailTemplateRequest,
        onSuccess?: (template: EmailTemplateListItem) => void,
      ): void {
        patchState(store, { loading: true, error: null });

        service.createTemplate(request).subscribe({
          next: (created) => {
            patchState(store, {
              templates: [created, ...store.templates()],
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
        request: UpdateEmailTemplateRequest,
        onSuccess?: () => void,
      ): void {
        patchState(store, { loading: true, error: null });

        service.updateTemplate(id, request).subscribe({
          next: () => {
            // Update the template in the list optimistically
            const updated = store.templates().map((t) =>
              t.id === id
                ? {
                    ...t,
                    name: request.name,
                    subject: request.subject ?? null,
                    htmlBody: request.htmlBody,
                    categoryId: request.categoryId ?? null,
                    isShared: request.isShared,
                  }
                : t,
            );
            patchState(store, { templates: updated, loading: false });
            onSuccess?.();
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
        service.deleteTemplate(id).subscribe({
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

      cloneTemplate(
        id: string,
        name: string,
        onSuccess?: (template: EmailTemplateListItem) => void,
      ): void {
        service.cloneTemplate(id, { name }).subscribe({
          next: (cloned) => {
            patchState(store, {
              templates: [cloned, ...store.templates()],
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

      setFilters(filters: { categoryId?: string; search?: string }): void {
        patchState(store, { filters });
        this.loadTemplates();
      },

      clearSelectedTemplate(): void {
        patchState(store, { selectedTemplate: null });
      },
    };
  }),
);

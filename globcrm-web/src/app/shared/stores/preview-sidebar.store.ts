import { computed, inject } from '@angular/core';
import {
  signalStore,
  withState,
  withComputed,
  withMethods,
  patchState,
} from '@ngrx/signals';
import { Router } from '@angular/router';
import { EntityPreviewService } from '../services/entity-preview.service';
import { EntityPreviewDto, PreviewEntry } from '../models/entity-preview.models';
import { getEntityRoute } from '../services/entity-type-registry';

interface PreviewSidebarState {
  isOpen: boolean;
  stack: PreviewEntry[];
  currentData: EntityPreviewDto | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: PreviewSidebarState = {
  isOpen: false,
  stack: [],
  currentData: null,
  isLoading: false,
  error: null,
};

const MAX_STACK_DEPTH = 10;

export const PreviewSidebarStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    currentEntry: computed(() => {
      const stack = store.stack();
      return stack.length > 0 ? stack[stack.length - 1] : null;
    }),
    canGoBack: computed(() => store.stack().length > 1),
  })),
  withMethods((store) => {
    const previewService = inject(EntityPreviewService);
    const router = inject(Router);

    function loadPreview(entry: PreviewEntry): void {
      previewService.getPreview(entry.entityType, entry.entityId).subscribe({
        next: (data) =>
          patchState(store, { currentData: data, isLoading: false, error: null }),
        error: (err) => {
          const message =
            err.status === 404
              ? `This ${entry.entityType} was not found. It may have been deleted or merged.`
              : err.status === 403
                ? `You don't have permission to view this ${entry.entityType}.`
                : `Failed to load preview.`;
          patchState(store, { isLoading: false, error: message, currentData: null });
        },
      });
    }

    return {
      open(entry: PreviewEntry): void {
        patchState(store, {
          isOpen: true,
          stack: [entry],
          isLoading: true,
          error: null,
          currentData: null,
        });
        loadPreview(entry);
      },
      pushPreview(entry: PreviewEntry): void {
        let newStack = [...store.stack(), entry];
        if (newStack.length > MAX_STACK_DEPTH) {
          newStack = newStack.slice(newStack.length - MAX_STACK_DEPTH);
        }
        patchState(store, {
          stack: newStack,
          isLoading: true,
          error: null,
          currentData: null,
        });
        loadPreview(entry);
      },
      goBack(): void {
        const stack = store.stack();
        if (stack.length <= 1) return;
        const newStack = stack.slice(0, -1);
        const prevEntry = newStack[newStack.length - 1];
        patchState(store, {
          stack: newStack,
          isLoading: true,
          error: null,
          currentData: null,
        });
        loadPreview(prevEntry);
      },
      close(): void {
        patchState(store, {
          isOpen: false,
          stack: [],
          currentData: null,
          error: null,
          isLoading: false,
        });
      },
      openFullRecord(): void {
        const stack = store.stack();
        const entry = stack.length > 0 ? stack[stack.length - 1] : null;
        if (entry) {
          const route = getEntityRoute(entry.entityType, entry.entityId);
          patchState(store, {
            isOpen: false,
            stack: [],
            currentData: null,
            error: null,
            isLoading: false,
          });
          router.navigate([route]);
        }
      },
    };
  })
);

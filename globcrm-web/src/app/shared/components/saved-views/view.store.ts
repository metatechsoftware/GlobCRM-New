import { computed, inject } from '@angular/core';
import {
  signalStore,
  withState,
  withComputed,
  withMethods,
  patchState,
} from '@ngrx/signals';
import { ApiService } from '../../../core/api/api.service';
import {
  SavedView,
  ViewColumn,
  ViewFilter,
  ViewSort,
  CreateViewRequest,
  UpdateViewRequest,
} from './view.models';

interface ViewState {
  views: SavedView[];
  activeViewId: string | null;
  isLoading: boolean;
}

const initialState: ViewState = {
  views: [],
  activeViewId: null,
  isLoading: false,
};

/**
 * NgRx Signal Store for managing saved views.
 * Handles CRUD operations for views and tracks the active view.
 * Views are grouped into personal (ownerId != null) and team (ownerId == null).
 */
export const ViewStore = signalStore(
  withState(initialState),
  withComputed((store) => ({
    personalViews: computed(() =>
      store.views().filter((v) => v.ownerId !== null),
    ),
    teamViews: computed(() =>
      store.views().filter((v) => v.ownerId === null),
    ),
    activeView: computed(() =>
      store.views().find((v) => v.id === store.activeViewId()) ?? null,
    ),
    activeViewId: computed(() => store.activeViewId()),
  })),
  withMethods((store) => {
    const api = inject(ApiService);

    return {
      /**
       * Load all views for a specific entity type.
       */
      loadViews(entityType: string): void {
        patchState(store, { isLoading: true });
        api.get<SavedView[]>(`/api/views/${entityType}`).subscribe({
          next: (views) => {
            patchState(store, { views, isLoading: false });
            // Auto-select team default if no active view
            if (!store.activeViewId()) {
              const teamDefault = views.find((v) => v.isTeamDefault);
              if (teamDefault) {
                patchState(store, { activeViewId: teamDefault.id });
              } else if (views.length > 0) {
                patchState(store, { activeViewId: views[0].id });
              }
            }
          },
          error: () => patchState(store, { isLoading: false }),
        });
      },

      /**
       * Select a view by its ID.
       */
      selectView(viewId: string): void {
        patchState(store, { activeViewId: viewId });
      },

      /**
       * Create a new view.
       */
      createView(view: CreateViewRequest): void {
        patchState(store, { isLoading: true });
        api.post<SavedView>('/api/views', view).subscribe({
          next: (created) => {
            patchState(store, {
              views: [...store.views(), created],
              activeViewId: created.id,
              isLoading: false,
            });
          },
          error: () => patchState(store, { isLoading: false }),
        });
      },

      /**
       * Update an existing view.
       */
      updateView(id: string, view: UpdateViewRequest): void {
        patchState(store, { isLoading: true });
        api.put<SavedView>(`/api/views/${id}`, view).subscribe({
          next: (updated) => {
            patchState(store, {
              views: store.views().map((v) => (v.id === id ? updated : v)),
              isLoading: false,
            });
          },
          error: () => patchState(store, { isLoading: false }),
        });
      },

      /**
       * Delete a view.
       */
      deleteView(id: string): void {
        patchState(store, { isLoading: true });
        api.delete<void>(`/api/views/${id}`).subscribe({
          next: () => {
            const remaining = store.views().filter((v) => v.id !== id);
            const newActiveId =
              store.activeViewId() === id
                ? remaining[0]?.id ?? null
                : store.activeViewId();
            patchState(store, {
              views: remaining,
              activeViewId: newActiveId,
              isLoading: false,
            });
          },
          error: () => patchState(store, { isLoading: false }),
        });
      },

      /**
       * Save the current table state as a new personal view.
       */
      saveCurrentState(
        name: string,
        entityType: string,
        columns: ViewColumn[],
        filters: ViewFilter[],
        sorts: ViewSort[],
        pageSize: number,
      ): void {
        const request: CreateViewRequest = {
          entityType,
          name,
          columns,
          filters,
          sorts,
          pageSize,
        };
        // Reuse createView
        patchState(store, { isLoading: true });
        api.post<SavedView>('/api/views', request).subscribe({
          next: (created) => {
            patchState(store, {
              views: [...store.views(), created],
              activeViewId: created.id,
              isLoading: false,
            });
          },
          error: () => patchState(store, { isLoading: false }),
        });
      },
    };
  }),
);

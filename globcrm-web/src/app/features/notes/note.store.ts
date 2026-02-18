import { inject, computed } from '@angular/core';
import {
  signalStore,
  withState,
  withComputed,
  withMethods,
  patchState,
} from '@ngrx/signals';
import { NoteService } from './note.service';
import { NoteListDto, NoteDetailDto } from './note.models';
import { ViewFilter } from '../../shared/components/saved-views/view.models';
import { FilterParam } from '../../shared/models/query.models';

interface NoteState {
  items: NoteListDto[];
  totalCount: number;
  page: number;
  pageSize: number;
  sortField: string | null;
  sortDirection: 'asc' | 'desc';
  filters: ViewFilter[];
  search: string;
  isLoading: boolean;
  selectedNote: NoteDetailDto | null;
  isDetailLoading: boolean;
  error: string | null;
}

const initialState: NoteState = {
  items: [],
  totalCount: 0,
  page: 1,
  pageSize: 25,
  sortField: 'createdAt',
  sortDirection: 'desc',
  filters: [],
  search: '',
  isLoading: false,
  selectedNote: null,
  isDetailLoading: false,
  error: null,
};

/**
 * NgRx Signal Store for Note entity.
 * Component-provided (not root) so each list page gets its own instance.
 * Manages list state (items, pagination, filters, sorts, search)
 * and detail state (selectedNote).
 *
 * Default sort: createdAt desc (most recent first).
 */
export const NoteStore = signalStore(
  withState(initialState),
  withComputed((store) => ({
    isEmpty: computed(() => store.items().length === 0 && !store.isLoading()),
    hasSelected: computed(() => store.selectedNote() !== null),
  })),
  withMethods((store) => {
    const noteService = inject(NoteService);

    function convertFilters(filters: ViewFilter[]): FilterParam[] {
      return filters.map((f) => ({
        fieldId: f.fieldId,
        operator: f.operator,
        value: f.value ?? undefined,
      }));
    }

    return {
      loadList(): void {
        patchState(store, { isLoading: true, error: null });

        const params = {
          page: store.page(),
          pageSize: store.pageSize(),
          sortField: store.sortField() ?? undefined,
          sortDirection: store.sortDirection(),
          search: store.search() || undefined,
          filters:
            store.filters().length > 0
              ? convertFilters(store.filters())
              : undefined,
        };

        noteService.getList(params).subscribe({
          next: (result) => {
            patchState(store, {
              items: result.items,
              totalCount: result.totalCount,
              isLoading: false,
            });
          },
          error: (err) => {
            patchState(store, {
              isLoading: false,
              error: err?.message ?? 'Failed to load notes',
            });
          },
        });
      },

      loadById(id: string): void {
        patchState(store, { isDetailLoading: true, error: null });
        noteService.getById(id).subscribe({
          next: (note) => {
            patchState(store, {
              selectedNote: note,
              isDetailLoading: false,
            });
          },
          error: (err) => {
            patchState(store, {
              isDetailLoading: false,
              error: err?.message ?? 'Failed to load note',
            });
          },
        });
      },

      setPage(page: number): void {
        patchState(store, { page });
        this.loadList();
      },

      setPageSize(pageSize: number): void {
        patchState(store, { pageSize, page: 1 });
        this.loadList();
      },

      setSort(sortField: string, sortDirection: 'asc' | 'desc'): void {
        patchState(store, { sortField, sortDirection, page: 1 });
        this.loadList();
      },

      setFilters(filters: ViewFilter[]): void {
        patchState(store, { filters, page: 1 });
        this.loadList();
      },

      setSearch(search: string): void {
        patchState(store, { search, page: 1 });
        this.loadList();
      },

      clearSelection(): void {
        patchState(store, { selectedNote: null });
      },

      reset(): void {
        patchState(store, initialState);
      },
    };
  }),
);

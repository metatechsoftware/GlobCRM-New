import { inject } from '@angular/core';
import {
  signalStore,
  withState,
  withMethods,
  patchState,
} from '@ngrx/signals';
import { ContactService } from './contact.service';
import { ContactDto, ContactDetailDto } from './contact.models';
import { ViewFilter } from '../../shared/components/saved-views/view.models';
import { FilterParam } from '../../shared/models/query.models';

interface ContactState {
  items: ContactDto[];
  totalCount: number;
  page: number;
  pageSize: number;
  sortField: string | null;
  sortDirection: 'asc' | 'desc';
  filters: ViewFilter[];
  search: string;
  isLoading: boolean;
  selectedContact: ContactDetailDto | null;
  isDetailLoading: boolean;
}

const initialState: ContactState = {
  items: [],
  totalCount: 0,
  page: 1,
  pageSize: 25,
  sortField: null,
  sortDirection: 'asc',
  filters: [],
  search: '',
  isLoading: false,
  selectedContact: null,
  isDetailLoading: false,
};

/**
 * NgRx Signal Store for Contact entity.
 * Component-provided (not root) so each list page gets its own instance.
 * Manages list state (items, pagination, filters, sorts, search) and detail state.
 */
export const ContactStore = signalStore(
  withState(initialState),
  withMethods((store) => {
    const contactService = inject(ContactService);

    function convertFilters(filters: ViewFilter[]): FilterParam[] {
      return filters.map((f) => ({
        fieldId: f.fieldId,
        operator: f.operator,
        value: f.value ?? undefined,
      }));
    }

    return {
      loadPage(): void {
        patchState(store, { isLoading: true });

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

        contactService.getList(params).subscribe({
          next: (result) => {
            patchState(store, {
              items: result.items,
              totalCount: result.totalCount,
              isLoading: false,
            });
          },
          error: () => {
            patchState(store, { isLoading: false });
          },
        });
      },

      setSort(field: string, direction: 'asc' | 'desc'): void {
        patchState(store, { sortField: field, sortDirection: direction, page: 1 });
        this.loadPage();
      },

      setFilters(filters: ViewFilter[]): void {
        patchState(store, { filters, page: 1 });
        this.loadPage();
      },

      setSearch(search: string): void {
        patchState(store, { search, page: 1 });
        this.loadPage();
      },

      setPage(page: number): void {
        patchState(store, { page });
        this.loadPage();
      },

      setPageSize(pageSize: number): void {
        patchState(store, { pageSize, page: 1 });
        this.loadPage();
      },

      loadDetail(id: string): void {
        patchState(store, { isDetailLoading: true });
        contactService.getById(id).subscribe({
          next: (contact) => {
            patchState(store, {
              selectedContact: contact,
              isDetailLoading: false,
            });
          },
          error: () => {
            patchState(store, { isDetailLoading: false });
          },
        });
      },

      clearDetail(): void {
        patchState(store, { selectedContact: null });
      },
    };
  }),
);

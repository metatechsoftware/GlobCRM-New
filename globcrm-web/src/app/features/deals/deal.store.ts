import { inject } from '@angular/core';
import {
  signalStore,
  withState,
  withMethods,
  patchState,
} from '@ngrx/signals';
import { DealService } from './deal.service';
import { DealListDto, DealDetailDto } from './deal.models';
import { ViewFilter } from '../../shared/components/saved-views/view.models';
import { FilterParam } from '../../shared/models/query.models';

interface DealState {
  items: DealListDto[];
  totalCount: number;
  page: number;
  pageSize: number;
  sortField: string | null;
  sortDirection: 'asc' | 'desc';
  filters: ViewFilter[];
  search: string;
  pipelineId: string | null;
  isLoading: boolean;
  selectedDeal: DealDetailDto | null;
  isDetailLoading: boolean;
}

const initialState: DealState = {
  items: [],
  totalCount: 0,
  page: 1,
  pageSize: 25,
  sortField: null,
  sortDirection: 'asc',
  filters: [],
  search: '',
  pipelineId: null,
  isLoading: false,
  selectedDeal: null,
  isDetailLoading: false,
};

/**
 * NgRx Signal Store for Deal entity.
 * Component-provided (not root) so each list page gets its own instance.
 * Manages list state (items, pagination, filters, sorts, search, pipeline filtering)
 * and detail state (selectedDeal).
 */
export const DealStore = signalStore(
  withState(initialState),
  withMethods((store) => {
    const dealService = inject(DealService);

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
          pipelineId: store.pipelineId() ?? undefined,
        };

        dealService.getList(params).subscribe({
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

      setPipelineId(pipelineId: string | null): void {
        patchState(store, { pipelineId, page: 1 });
        this.loadPage();
      },

      loadDetail(id: string): void {
        patchState(store, { isDetailLoading: true });
        dealService.getById(id).subscribe({
          next: (deal) => {
            patchState(store, {
              selectedDeal: deal,
              isDetailLoading: false,
            });
          },
          error: () => {
            patchState(store, { isDetailLoading: false });
          },
        });
      },

      clearDetail(): void {
        patchState(store, { selectedDeal: null });
      },
    };
  }),
);

import { inject } from '@angular/core';
import {
  signalStore,
  withState,
  withMethods,
  patchState,
} from '@ngrx/signals';
import { LeadService } from './lead.service';
import {
  LeadListDto,
  LeadDetailDto,
  LeadStageDto,
  LeadSourceDto,
} from './lead.models';
import { ViewFilter } from '../../shared/components/saved-views/view.models';
import { FilterParam } from '../../shared/models/query.models';

interface LeadState {
  items: LeadListDto[];
  totalCount: number;
  page: number;
  pageSize: number;
  sortField: string | null;
  sortDirection: 'asc' | 'desc';
  filters: ViewFilter[];
  search: string;
  isLoading: boolean;
  selectedLead: LeadDetailDto | null;
  isDetailLoading: boolean;
  stages: LeadStageDto[];
  sources: LeadSourceDto[];
  viewMode: 'table' | 'kanban';
}

const initialState: LeadState = {
  items: [],
  totalCount: 0,
  page: 1,
  pageSize: 25,
  sortField: null,
  sortDirection: 'asc',
  filters: [],
  search: '',
  isLoading: false,
  selectedLead: null,
  isDetailLoading: false,
  stages: [],
  sources: [],
  viewMode: 'table',
};

/**
 * NgRx Signal Store for Lead entity.
 * Component-provided (not root) so each list page gets its own instance.
 * Manages list state (items, pagination, filters, sorts, search),
 * detail state (selectedLead), and reference data (stages, sources).
 */
export const LeadStore = signalStore(
  withState(initialState),
  withMethods((store) => {
    const leadService = inject(LeadService);

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

        leadService.getList(params).subscribe({
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

      setViewMode(mode: 'table' | 'kanban'): void {
        patchState(store, { viewMode: mode });
      },

      loadDetail(id: string): void {
        patchState(store, { isDetailLoading: true });
        leadService.getById(id).subscribe({
          next: (lead) => {
            patchState(store, {
              selectedLead: lead,
              isDetailLoading: false,
            });
          },
          error: () => {
            patchState(store, { isDetailLoading: false });
          },
        });
      },

      clearDetail(): void {
        patchState(store, { selectedLead: null });
      },

      loadStages(): void {
        leadService.getStages().subscribe({
          next: (stages) => {
            patchState(store, { stages });
          },
          error: () => {},
        });
      },

      loadSources(): void {
        leadService.getSources().subscribe({
          next: (sources) => {
            patchState(store, { sources });
          },
          error: () => {},
        });
      },
    };
  }),
);

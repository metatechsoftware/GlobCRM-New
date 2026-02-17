import { inject } from '@angular/core';
import {
  signalStore,
  withState,
  withComputed,
  withMethods,
  patchState,
} from '@ngrx/signals';
import { computed } from '@angular/core';
import { EmailService } from './email.service';
import {
  EmailListDto,
  EmailDetailDto,
  EmailThreadDto,
  EmailAccountStatusDto,
  SendEmailRequest,
} from './email.models';
import { ViewFilter } from '../../shared/components/saved-views/view.models';
import { FilterParam } from '../../shared/models/query.models';

interface EmailState {
  items: EmailListDto[];
  totalCount: number;
  page: number;
  pageSize: number;
  sortField: string | null;
  sortDirection: 'asc' | 'desc';
  filters: ViewFilter[];
  search: string;
  isLoading: boolean;
  selectedItem: EmailDetailDto | null;
  selectedThread: EmailThreadDto | null;
  isDetailLoading: boolean;
  error: string | null;
  accountStatus: EmailAccountStatusDto | null;
}

const initialState: EmailState = {
  items: [],
  totalCount: 0,
  page: 1,
  pageSize: 25,
  sortField: 'sentAt',
  sortDirection: 'desc',
  filters: [],
  search: '',
  isLoading: false,
  selectedItem: null,
  selectedThread: null,
  isDetailLoading: false,
  error: null,
  accountStatus: null,
};

/**
 * NgRx Signal Store for Email entity.
 * Component-provided (not root) so each list page gets its own instance.
 * Manages list state (items, pagination, filters, sorts, search),
 * detail state (selectedItem, selectedThread), and account status.
 * Default sort: sentAt desc (most recent first).
 */
export const EmailStore = signalStore(
  withState(initialState),
  withComputed((store) => ({
    isEmpty: computed(() => store.items().length === 0 && !store.isLoading()),
    hasSelected: computed(() => store.selectedItem() !== null),
    isConnected: computed(() => store.accountStatus()?.connected === true),
  })),
  withMethods((store) => {
    const emailService = inject(EmailService);

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

        emailService.getList(params).subscribe({
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
              error: err?.message ?? 'Failed to load emails',
            });
          },
        });
      },

      loadById(id: string): void {
        patchState(store, { isDetailLoading: true, error: null });
        emailService.getById(id).subscribe({
          next: (email) => {
            patchState(store, {
              selectedItem: email,
              isDetailLoading: false,
            });
          },
          error: (err) => {
            patchState(store, {
              isDetailLoading: false,
              error: err?.message ?? 'Failed to load email',
            });
          },
        });
      },

      loadThread(gmailThreadId: string): void {
        patchState(store, { isDetailLoading: true, error: null });
        emailService.getThread(gmailThreadId).subscribe({
          next: (thread) => {
            patchState(store, {
              selectedThread: thread,
              isDetailLoading: false,
            });
          },
          error: (err) => {
            patchState(store, {
              isDetailLoading: false,
              error: err?.message ?? 'Failed to load email thread',
            });
          },
        });
      },

      send(request: SendEmailRequest): void {
        patchState(store, { isLoading: true, error: null });
        emailService.send(request).subscribe({
          next: () => {
            this.loadList();
          },
          error: (err) => {
            patchState(store, {
              isLoading: false,
              error: err?.message ?? 'Failed to send email',
            });
          },
        });
      },

      markAsRead(id: string): void {
        emailService.markAsRead(id).subscribe({
          next: () => {
            const items = store.items().map((item) =>
              item.id === id ? { ...item, isRead: true } : item,
            );
            patchState(store, { items });
          },
          error: (err) => {
            patchState(store, {
              error: err?.message ?? 'Failed to mark email as read',
            });
          },
        });
      },

      toggleStar(id: string): void {
        emailService.toggleStar(id).subscribe({
          next: (updated) => {
            const items = store.items().map((item) =>
              item.id === id ? { ...item, isStarred: updated.isStarred } : item,
            );
            patchState(store, { items });
          },
          error: (err) => {
            patchState(store, {
              error: err?.message ?? 'Failed to toggle star',
            });
          },
        });
      },

      loadByContact(contactId: string): void {
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

        emailService.getByContact(contactId, params).subscribe({
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
              error: err?.message ?? 'Failed to load contact emails',
            });
          },
        });
      },

      loadByCompany(companyId: string): void {
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

        emailService.getByCompany(companyId, params).subscribe({
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
              error: err?.message ?? 'Failed to load company emails',
            });
          },
        });
      },

      loadAccountStatus(): void {
        emailService.getAccountStatus().subscribe({
          next: (status) => {
            patchState(store, { accountStatus: status });
          },
          error: (err) => {
            patchState(store, {
              error: err?.message ?? 'Failed to load account status',
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
        patchState(store, { selectedItem: null, selectedThread: null });
      },

      reset(): void {
        patchState(store, initialState);
      },
    };
  }),
);

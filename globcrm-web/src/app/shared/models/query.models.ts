/**
 * Shared query models used across all entity services and stores.
 * Provides generic pagination, filtering, and timeline interfaces.
 */

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface EntityQueryParams {
  page?: number;
  pageSize?: number;
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
  search?: string;
  filters?: FilterParam[];
}

export interface FilterParam {
  fieldId: string;
  operator: string;
  value?: string;
}

export interface TimelineEntry {
  id: string;
  type:
    | 'created'
    | 'updated'
    | 'contact_linked'
    | 'contact_unlinked'
    | 'deal_created'
    | 'activity'
    | 'note'
    | 'email';
  title: string;
  description: string | null;
  timestamp: string;
  userId: string | null;
  userName: string | null;
}

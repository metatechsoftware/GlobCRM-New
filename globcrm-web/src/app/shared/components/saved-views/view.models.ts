/**
 * View models matching backend SavedView/ViewColumn/ViewFilter/ViewSort DTOs.
 * Used by DynamicTableComponent, ViewSidebar, and FilterPanel.
 */

export interface ViewColumn {
  fieldId: string;
  isCustomField: boolean;
  width: number;
  sortOrder: number;
  visible: boolean;
}

export interface ViewFilter {
  fieldId: string;
  operator: FilterOperator;
  value: string | null;
}

export type FilterOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'in'
  | 'between'
  | 'is_null'
  | 'is_not_null';

export interface ViewSort {
  fieldId: string;
  direction: 'asc' | 'desc';
  sortOrder: number;
}

export interface SavedView {
  id: string;
  entityType: string;
  name: string;
  ownerId: string | null;
  isTeamDefault: boolean;
  columns: ViewColumn[];
  filters: ViewFilter[];
  sorts: ViewSort[];
  pageSize: number;
}

export interface ColumnDefinition {
  fieldId: string;
  label: string;
  labelKey?: string;
  isCustomField: boolean;
  fieldType: string;
  sortable: boolean;
  filterable: boolean;
  renderAs?: 'text' | 'badge' | 'email' | 'date' | 'avatar';
}

export interface CreateViewRequest {
  entityType: string;
  name: string;
  columns: ViewColumn[];
  filters: ViewFilter[];
  sorts: ViewSort[];
  pageSize: number;
}

export interface UpdateViewRequest {
  name?: string;
  columns?: ViewColumn[];
  filters?: ViewFilter[];
  sorts?: ViewSort[];
  pageSize?: number;
  isTeamDefault?: boolean;
}

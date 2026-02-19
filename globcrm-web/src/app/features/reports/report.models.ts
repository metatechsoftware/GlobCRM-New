/**
 * Report builder models matching backend DTOs from ReportsController.
 * Used by ReportService, ReportStore, and all report components.
 */

// ---- Core Entities ----

export interface Report {
  id: string;
  name: string;
  description?: string;
  entityType: string;
  chartType: ReportChartType;
  categoryId?: string;
  categoryName?: string;
  definition: ReportDefinition;
  ownerId?: string;
  ownerName?: string;
  isShared: boolean;
  isSeedData: boolean;
  lastRunAt?: string;
  lastRunRowCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ReportListItem {
  id: string;
  name: string;
  description?: string;
  entityType: string;
  chartType: ReportChartType;
  categoryName?: string;
  ownerName?: string;
  isShared: boolean;
  isSeedData: boolean;
  lastRunAt?: string;
  lastRunRowCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ReportCategory {
  id: string;
  name: string;
  description?: string;
  sortOrder: number;
  isSeedData: boolean;
}

// ---- Definition Types ----

export interface ReportDefinition {
  fields: ReportField[];
  filterGroup?: ReportFilterGroup;
  groupings: ReportGrouping[];
  chartConfig?: ReportChartConfig;
}

export interface ReportField {
  fieldId: string;
  label: string;
  fieldType: string;
  aggregation?: AggregationType;
  sortOrder: number;
}

export interface ReportFilterGroup {
  logic: FilterLogic;
  conditions: ReportFilterCondition[];
  groups: ReportFilterGroup[];
}

export interface ReportFilterCondition {
  fieldId: string;
  operator: string;
  value?: string;
  valueTo?: string;
}

export interface ReportGrouping {
  fieldId: string;
  dateTruncation?: string;
}

export interface ReportChartConfig {
  chartType: ReportChartType;
  colorScheme?: string;
  showLegend: boolean;
  showDataLabels: boolean;
}

// ---- Enums ----

export type ReportChartType = 'table' | 'bar' | 'line' | 'pie' | 'funnel';

export type AggregationType = 'count' | 'sum' | 'average' | 'min' | 'max';

export type FilterLogic = 'and' | 'or';

// ---- Field Metadata ----

export interface ReportFieldMetadata {
  systemFields: ReportFieldInfo[];
  customFields: ReportFieldInfo[];
  formulaFields: ReportFieldInfo[];
  relatedFields: ReportFieldInfo[];
}

export interface ReportFieldInfo {
  fieldId: string;
  label: string;
  category: string;
  dataType: string;
  isAggregatable: boolean;
  isGroupable: boolean;
  relatedEntity?: string;
  relatedField?: string;
}

// ---- Execution Results ----

export interface ReportExecutionResult {
  rows: Record<string, any>[];
  totalCount: number;
  aggregates?: ReportAggregateResult[];
  columnHeaders: string[];
  error?: string;
}

export interface ReportAggregateResult {
  fieldId: string;
  label: string;
  aggregation: string;
  value: any;
}

// ---- Request Types ----

export interface CreateReportRequest {
  name: string;
  description?: string;
  entityType: string;
  categoryId?: string;
  chartType: ReportChartType;
  definition: ReportDefinition;
}

export interface UpdateReportRequest {
  name: string;
  description?: string;
  categoryId?: string;
  chartType: ReportChartType;
  definition: ReportDefinition;
}

export interface ExecuteReportRequest {
  page?: number;
  pageSize?: number;
  drillDownFilter?: ReportFilterCondition;
}

// ---- Paginated Response ----

export interface PagedReportResponse {
  items: ReportListItem[];
  totalCount: number;
  page: number;
  pageSize: number;
}

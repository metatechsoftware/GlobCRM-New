// Widget types matching backend WidgetType enum
export type WidgetType = 'KpiCard' | 'BarChart' | 'LineChart' | 'PieChart' | 'Leaderboard' | 'Table' | 'TargetProgress';

// Metric types matching backend MetricType enum
export type MetricType = 'DealCount' | 'DealPipelineValue' | 'DealsByStage' | 'DealsWon' | 'DealsLost' | 'WinRate' | 'AverageDealValue' | 'ActivityCount' | 'ActivitiesByType' | 'ActivitiesByStatus' | 'ActivitiesCompleted' | 'OverdueActivities' | 'QuoteTotal' | 'QuotesByStatus' | 'ContactsCreated' | 'CompaniesCreated' | 'RequestsByStatus' | 'RequestsByPriority' | 'SalesLeaderboard' | 'ActivityLeaderboard';

export type TargetPeriod = 'Daily' | 'Weekly' | 'Monthly' | 'Quarterly' | 'Yearly';

export interface WidgetDto {
  id: string;
  type: WidgetType;
  title: string;
  x: number;
  y: number;
  cols: number;
  rows: number;
  config: Record<string, any>;
  sortOrder: number;
}

export interface DashboardDto {
  id: string;
  name: string;
  description: string | null;
  ownerId: string | null;
  ownerName: string | null;
  isDefault: boolean;
  isTeamWide: boolean;
  widgets: WidgetDto[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateDashboardRequest {
  name: string;
  description?: string;
  isTeamWide: boolean;
  isDefault: boolean;
  widgets: CreateWidgetRequest[];
}

export interface CreateWidgetRequest {
  type: WidgetType;
  title: string;
  x: number;
  y: number;
  cols: number;
  rows: number;
  config: Record<string, any>;
  sortOrder: number;
}

export interface UpdateDashboardRequest {
  name: string;
  description?: string;
  isDefault: boolean;
  widgets: CreateWidgetRequest[];
}

// Widget data (metrics)
export interface ChartDataPoint {
  label: string;
  value: number;
}

export interface MetricResultDto {
  value: number;
  label: string;
  series: ChartDataPoint[] | null;
}

export interface WidgetMetricRequest {
  widgetId: string;
  metricType: MetricType;
  config: Record<string, any>;
}

export interface WidgetDataRequest {
  widgets: WidgetMetricRequest[];
  startDate: string;
  endDate: string;
}

export interface WidgetDataResponse {
  results: Record<string, MetricResultDto>;
}

// Targets
export interface TargetDto {
  id: string;
  name: string;
  metricType: MetricType;
  period: TargetPeriod;
  targetValue: number;
  currentValue: number;
  progressPercent: number;
  ownerId: string | null;
  ownerName: string | null;
  startDate: string;
  endDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTargetRequest {
  name: string;
  metricType: MetricType;
  period: TargetPeriod;
  targetValue: number;
  startDate: string;
  endDate: string;
  isTeamWide: boolean;
}

export interface UpdateTargetRequest {
  name: string;
  targetValue: number;
  startDate: string;
  endDate: string;
}

// Date range for dashboard filtering
export interface DateRange {
  start: string | null;
  end: string | null;
}

// Gridster item extension for widgets
export interface DashboardGridItem {
  x: number;
  y: number;
  cols: number;
  rows: number;
  widgetId: string;
  widget: WidgetDto;
}

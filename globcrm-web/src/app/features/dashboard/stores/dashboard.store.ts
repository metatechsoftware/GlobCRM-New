import { inject } from '@angular/core';
import { computed } from '@angular/core';
import {
  signalStore,
  withState,
  withComputed,
  withMethods,
  patchState,
} from '@ngrx/signals';
import { DashboardApiService } from '../services/dashboard-api.service';
import {
  DashboardDto,
  WidgetDto,
  MetricResultDto,
  TargetDto,
  DateRange,
  CreateDashboardRequest,
  UpdateDashboardRequest,
  CreateTargetRequest,
  UpdateTargetRequest,
} from '../models/dashboard.models';

interface DashboardState {
  dashboards: DashboardDto[];
  activeDashboard: DashboardDto | null;
  widgetData: Record<string, MetricResultDto>;
  targets: TargetDto[];
  dateRange: DateRange;
  isLoading: boolean;
  isEditing: boolean;
}

/** Returns a DateRange defaulting to the current month (first day to today). */
function defaultDateRange(): DateRange {
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    start: firstOfMonth.toISOString().split('T')[0],
    end: now.toISOString().split('T')[0],
  };
}

const initialState: DashboardState = {
  dashboards: [],
  activeDashboard: null,
  widgetData: {},
  targets: [],
  dateRange: defaultDateRange(),
  isLoading: false,
  isEditing: false,
};

/**
 * Dashboard signal store -- component-provided (NOT root).
 * Each dashboard page instance gets its own store.
 * Manages dashboards, active dashboard, widget data, targets, date range, and edit mode.
 */
export const DashboardStore = signalStore(
  withState(initialState),
  withComputed((store) => ({
    /** Whether a dashboard is currently active. */
    hasDashboard: computed(() => store.activeDashboard() !== null),
    /** Widget count on the active dashboard. */
    widgetCount: computed(() => store.activeDashboard()?.widgets?.length ?? 0),
    /** Whether any targets exist. */
    hasTargets: computed(() => store.targets().length > 0),
  })),
  withMethods((store) => {
    const api = inject(DashboardApiService);

    return {
      /** Fetch all dashboards, set first/default as active. */
      loadDashboards(): void {
        patchState(store, { isLoading: true });
        api.getDashboards().subscribe({
          next: (dashboards) => {
            const defaultDash = dashboards.find((d) => d.isDefault) ?? dashboards[0] ?? null;
            patchState(store, {
              dashboards,
              activeDashboard: defaultDash,
              isLoading: false,
            });
            if (defaultDash) {
              this.loadWidgetData();
            }
          },
          error: () => {
            patchState(store, { isLoading: false });
          },
        });
      },

      /** Fetch a specific dashboard with widgets. */
      loadDashboard(id: string): void {
        patchState(store, { isLoading: true });
        api.getDashboard(id).subscribe({
          next: (dashboard) => {
            patchState(store, {
              activeDashboard: dashboard,
              isLoading: false,
            });
            this.loadWidgetData();
          },
          error: () => {
            patchState(store, { isLoading: false });
          },
        });
      },

      /** Build WidgetDataRequest from active dashboard widgets + dateRange, call API, populate widgetData map. */
      loadWidgetData(): void {
        const dashboard = store.activeDashboard();
        if (!dashboard || !dashboard.widgets?.length) {
          patchState(store, { widgetData: {} });
          return;
        }

        const dateRange = store.dateRange();
        const req = {
          widgets: dashboard.widgets.map((w) => ({
            widgetId: w.id,
            metricType: w.config['metricType'] ?? 'DealCount',
            config: w.config,
          })),
          startDate: dateRange.start ?? '',
          endDate: dateRange.end ?? '',
        };

        api.getWidgetData(dashboard.id, req).subscribe({
          next: (response) => {
            patchState(store, { widgetData: response.results });
          },
          error: () => {
            // Silent fail -- widgets show empty state
          },
        });
      },

      /** Create a new dashboard and reload the list. */
      saveDashboard(req: CreateDashboardRequest): void {
        api.createDashboard(req).subscribe({
          next: () => {
            this.loadDashboards();
          },
        });
      },

      /** Update an existing dashboard and reload. */
      updateDashboard(id: string, req: UpdateDashboardRequest): void {
        api.updateDashboard(id, req).subscribe({
          next: () => {
            this.loadDashboard(id);
            this.loadDashboards();
          },
        });
      },

      /** Delete a dashboard and reload. */
      deleteDashboard(id: string): void {
        api.deleteDashboard(id).subscribe({
          next: () => {
            patchState(store, { activeDashboard: null, widgetData: {} });
            this.loadDashboards();
          },
        });
      },

      /** Update the date range and reload widget data. */
      setDateRange(range: DateRange): void {
        patchState(store, { dateRange: range });
        this.loadWidgetData();
      },

      /** Toggle edit mode for widget drag/resize. */
      toggleEditMode(): void {
        patchState(store, { isEditing: !store.isEditing() });
      },

      /** Save widget positions after drag/resize. */
      saveLayout(widgets: WidgetDto[]): void {
        const dashboard = store.activeDashboard();
        if (!dashboard) return;

        const req: UpdateDashboardRequest = {
          name: dashboard.name,
          description: dashboard.description ?? undefined,
          isDefault: dashboard.isDefault,
          widgets: widgets.map((w) => ({
            type: w.type,
            title: w.title,
            x: w.x,
            y: w.y,
            cols: w.cols,
            rows: w.rows,
            config: w.config,
            sortOrder: w.sortOrder,
          })),
        };

        api.updateDashboard(dashboard.id, req).subscribe({
          next: (updated) => {
            patchState(store, { activeDashboard: updated });
          },
        });
      },

      /** Fetch all targets. */
      loadTargets(): void {
        api.getTargets().subscribe({
          next: (targets) => {
            patchState(store, { targets });
          },
        });
      },

      /** Create a target and reload. */
      createTarget(req: CreateTargetRequest): void {
        api.createTarget(req).subscribe({
          next: () => {
            this.loadTargets();
          },
        });
      },

      /** Update a target and reload. */
      updateTarget(id: string, req: UpdateTargetRequest): void {
        api.updateTarget(id, req).subscribe({
          next: () => {
            this.loadTargets();
          },
        });
      },

      /** Delete a target and reload. */
      deleteTarget(id: string): void {
        api.deleteTarget(id).subscribe({
          next: () => {
            this.loadTargets();
          },
        });
      },
    };
  }),
);

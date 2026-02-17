import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/api/api.service';
import {
  DashboardDto,
  CreateDashboardRequest,
  UpdateDashboardRequest,
  WidgetDataRequest,
  WidgetDataResponse,
  TargetDto,
  CreateTargetRequest,
  UpdateTargetRequest,
} from '../models/dashboard.models';

/**
 * HTTP service for dashboard and target API endpoints.
 * Matches backend DashboardsController (/api/dashboards) and TargetsController (/api/targets).
 */
@Injectable({ providedIn: 'root' })
export class DashboardApiService {
  private readonly api = inject(ApiService);

  // ── Dashboard CRUD ──

  /** Gets all dashboards for the current user/tenant. */
  getDashboards(): Observable<DashboardDto[]> {
    return this.api.get<DashboardDto[]>('/api/dashboards');
  }

  /** Gets a single dashboard by ID with its widgets. */
  getDashboard(id: string): Observable<DashboardDto> {
    return this.api.get<DashboardDto>(`/api/dashboards/${id}`);
  }

  /** Creates a new dashboard with widgets. */
  createDashboard(req: CreateDashboardRequest): Observable<DashboardDto> {
    return this.api.post<DashboardDto>('/api/dashboards', req);
  }

  /** Updates an existing dashboard and its widgets. */
  updateDashboard(id: string, req: UpdateDashboardRequest): Observable<DashboardDto> {
    return this.api.put<DashboardDto>(`/api/dashboards/${id}`, req);
  }

  /** Deletes a dashboard. */
  deleteDashboard(id: string): Observable<void> {
    return this.api.delete<void>(`/api/dashboards/${id}`);
  }

  // ── Widget Data ──

  /** Fetches metric data for all widgets on a dashboard. */
  getWidgetData(dashboardId: string, req: WidgetDataRequest): Observable<WidgetDataResponse> {
    return this.api.post<WidgetDataResponse>(`/api/dashboards/${dashboardId}/widget-data`, req);
  }

  // ── Target CRUD ──

  /** Gets all targets for the current user/tenant. */
  getTargets(): Observable<TargetDto[]> {
    return this.api.get<TargetDto[]>('/api/targets');
  }

  /** Creates a new target. */
  createTarget(req: CreateTargetRequest): Observable<TargetDto> {
    return this.api.post<TargetDto>('/api/targets', req);
  }

  /** Updates an existing target. */
  updateTarget(id: string, req: UpdateTargetRequest): Observable<TargetDto> {
    return this.api.put<TargetDto>(`/api/targets/${id}`, req);
  }

  /** Deletes a target. */
  deleteTarget(id: string): Observable<void> {
    return this.api.delete<void>(`/api/targets/${id}`);
  }
}

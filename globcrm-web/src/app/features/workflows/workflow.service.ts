import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpParams } from '@angular/common/http';
import { ApiService } from '../../core/api/api.service';
import {
  Workflow,
  WorkflowListItem,
  WorkflowPaginatedResponse,
  WorkflowExecutionLog,
  WorkflowTemplate,
  WorkflowTemplateListItem,
  EntityField,
  CreateWorkflowRequest,
  UpdateWorkflowRequest,
} from './workflow.models';

/**
 * API service for workflow automation CRUD, enable/disable toggle, duplication,
 * execution log viewing, entity field listing, and template management.
 * Maps to WorkflowsController (/api/workflows) and WorkflowTemplatesController
 * (/api/workflow-templates) endpoints.
 */
@Injectable({ providedIn: 'root' })
export class WorkflowService {
  private readonly api = inject(ApiService);
  private readonly basePath = '/api/workflows';
  private readonly templatePath = '/api/workflow-templates';

  // ---- Workflow CRUD ----

  getWorkflows(params?: {
    entityType?: string;
    status?: string;
    page?: number;
    pageSize?: number;
  }): Observable<WorkflowPaginatedResponse> {
    let httpParams = new HttpParams();
    if (params?.entityType) {
      httpParams = httpParams.set('entityType', params.entityType);
    }
    if (params?.status) {
      httpParams = httpParams.set('status', params.status);
    }
    if (params?.page) {
      httpParams = httpParams.set('page', params.page.toString());
    }
    if (params?.pageSize) {
      httpParams = httpParams.set('pageSize', params.pageSize.toString());
    }
    return this.api.get<WorkflowPaginatedResponse>(this.basePath, httpParams);
  }

  getWorkflow(id: string): Observable<Workflow> {
    return this.api.get<Workflow>(`${this.basePath}/${id}`);
  }

  createWorkflow(request: CreateWorkflowRequest): Observable<Workflow> {
    return this.api.post<Workflow>(this.basePath, request);
  }

  updateWorkflow(
    id: string,
    request: UpdateWorkflowRequest,
  ): Observable<Workflow> {
    return this.api.put<Workflow>(`${this.basePath}/${id}`, request);
  }

  deleteWorkflow(id: string): Observable<void> {
    return this.api.delete<void>(`${this.basePath}/${id}`);
  }

  // ---- Status Management ----

  updateStatus(id: string, isActive: boolean): Observable<Workflow> {
    return this.api.patch<Workflow>(`${this.basePath}/${id}/status`, {
      isActive,
    });
  }

  activateWorkflow(id: string): Observable<Workflow> {
    return this.api.post<Workflow>(`${this.basePath}/${id}/activate`);
  }

  deactivateWorkflow(id: string): Observable<Workflow> {
    return this.api.post<Workflow>(`${this.basePath}/${id}/deactivate`);
  }

  duplicateWorkflow(id: string): Observable<Workflow> {
    return this.api.post<Workflow>(`${this.basePath}/${id}/duplicate`);
  }

  // ---- Execution Logs ----

  getExecutionLogs(
    workflowId: string,
    page: number = 1,
    pageSize: number = 20,
  ): Observable<{
    items: WorkflowExecutionLog[];
    totalCount: number;
    page: number;
    pageSize: number;
  }> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('pageSize', pageSize.toString());
    return this.api.get<{
      items: WorkflowExecutionLog[];
      totalCount: number;
      page: number;
      pageSize: number;
    }>(`${this.basePath}/${workflowId}/logs`, params);
  }

  getExecutionLogDetail(
    workflowId: string,
    logId: string,
  ): Observable<WorkflowExecutionLog> {
    return this.api.get<WorkflowExecutionLog>(
      `${this.basePath}/${workflowId}/logs/${logId}`,
    );
  }

  // ---- Entity Fields ----

  getEntityFields(entityType: string): Observable<EntityField[]> {
    return this.api.get<EntityField[]>(
      `${this.basePath}/entity-fields/${entityType}`,
    );
  }

  // ---- Templates ----

  getTemplates(
    category?: string,
    entityType?: string,
  ): Observable<WorkflowTemplateListItem[]> {
    let params = new HttpParams();
    if (category) {
      params = params.set('category', category);
    }
    if (entityType) {
      params = params.set('entityType', entityType);
    }
    return this.api.get<WorkflowTemplateListItem[]>(
      this.templatePath,
      params,
    );
  }

  getTemplate(id: string): Observable<WorkflowTemplate> {
    return this.api.get<WorkflowTemplate>(`${this.templatePath}/${id}`);
  }

  saveAsTemplate(
    workflowId: string,
    request: { name: string; description?: string; category: string },
  ): Observable<WorkflowTemplate> {
    return this.api.post<WorkflowTemplate>(
      `${this.templatePath}/from-workflow/${workflowId}`,
      request,
    );
  }

  applyTemplate(templateId: string): Observable<Workflow> {
    return this.api.post<Workflow>(
      `${this.templatePath}/${templateId}/apply`,
    );
  }

  deleteTemplate(id: string): Observable<void> {
    return this.api.delete<void>(`${this.templatePath}/${id}`);
  }
}

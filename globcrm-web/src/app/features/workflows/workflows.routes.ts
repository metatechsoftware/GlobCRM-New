import { Routes } from '@angular/router';

export const WORKFLOW_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./workflow-list/workflow-list.component').then(
        (m) => m.WorkflowListComponent,
      ),
  },
  {
    path: 'new',
    loadComponent: () =>
      import('./workflow-builder/workflow-builder.component').then(
        (m) => m.WorkflowBuilderComponent,
      ),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./workflow-detail/workflow-detail.component').then(
        (m) => m.WorkflowDetailComponent,
      ),
  },
  {
    path: ':id/edit',
    loadComponent: () =>
      import('./workflow-builder/workflow-builder.component').then(
        (m) => m.WorkflowBuilderComponent,
      ),
  },
  {
    path: ':id/logs',
    loadComponent: () =>
      import('./workflow-logs/execution-log-list.component').then(
        (m) => m.ExecutionLogListComponent,
      ),
  },
  {
    path: ':id/logs/:logId',
    loadComponent: () =>
      import('./workflow-logs/execution-log-detail.component').then(
        (m) => m.ExecutionLogDetailComponent,
      ),
  },
];

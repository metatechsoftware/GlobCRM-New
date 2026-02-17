import { Routes } from '@angular/router';
import { ActivityListComponent } from './activity-list/activity-list.component';

export const ACTIVITY_ROUTES: Routes = [
  { path: '', component: ActivityListComponent },
  {
    path: 'kanban',
    loadComponent: () =>
      import('./activity-list/activity-list.component').then(
        (m) => m.ActivityListComponent,
      ),
    // Placeholder: will be replaced by ActivityKanbanComponent in a later plan
  },
  {
    path: 'calendar',
    loadComponent: () =>
      import('./activity-list/activity-list.component').then(
        (m) => m.ActivityListComponent,
      ),
    // Placeholder: will be replaced by ActivityCalendarComponent in a later plan
  },
  {
    path: 'new',
    loadComponent: () =>
      import('./activity-form/activity-form.component').then(
        (m) => m.ActivityFormComponent,
      ),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./activity-form/activity-form.component').then(
        (m) => m.ActivityFormComponent,
      ),
    // Placeholder: will be replaced by ActivityDetailComponent in a later plan
  },
  {
    path: ':id/edit',
    loadComponent: () =>
      import('./activity-form/activity-form.component').then(
        (m) => m.ActivityFormComponent,
      ),
  },
];

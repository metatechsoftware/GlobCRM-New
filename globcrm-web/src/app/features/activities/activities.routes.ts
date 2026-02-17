import { Routes } from '@angular/router';
import { ActivityListComponent } from './activity-list/activity-list.component';

export const ACTIVITY_ROUTES: Routes = [
  { path: '', component: ActivityListComponent },
  {
    path: 'kanban',
    loadComponent: () =>
      import('./activity-kanban/activity-kanban.component').then(
        (m) => m.ActivityKanbanComponent,
      ),
  },
  {
    path: 'calendar',
    loadComponent: () =>
      import('./activity-calendar/activity-calendar.component').then(
        (m) => m.ActivityCalendarComponent,
      ),
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

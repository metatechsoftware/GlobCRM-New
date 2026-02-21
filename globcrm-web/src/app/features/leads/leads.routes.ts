import { Routes } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';
import { LeadListComponent } from './lead-list/lead-list.component';

export const LEAD_ROUTES: Routes = [
  {
    path: '',
    providers: [provideTranslocoScope('leads')],
    children: [
      { path: '', component: LeadListComponent },
      {
        path: 'kanban',
        loadComponent: () =>
          import('./lead-kanban/lead-kanban.component').then(
            (m) => m.LeadKanbanComponent,
          ),
      },
      {
        path: 'new',
        loadComponent: () =>
          import('./lead-form/lead-form.component').then(
            (m) => m.LeadFormComponent,
          ),
      },
      {
        path: ':id',
        loadComponent: () =>
          import('./lead-detail/lead-detail.component').then(
            (m) => m.LeadDetailComponent,
          ),
      },
      {
        path: ':id/edit',
        loadComponent: () =>
          import('./lead-form/lead-form.component').then(
            (m) => m.LeadFormComponent,
          ),
      },
    ],
  },
];

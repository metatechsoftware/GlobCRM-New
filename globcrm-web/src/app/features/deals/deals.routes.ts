import { Routes } from '@angular/router';
import { DealListComponent } from './deal-list/deal-list.component';

export const DEAL_ROUTES: Routes = [
  { path: '', component: DealListComponent },
  {
    path: 'kanban',
    loadComponent: () =>
      import('./deal-kanban/deal-kanban.component').then(
        (m) => m.DealKanbanComponent,
      ),
  },
  {
    path: 'new',
    loadComponent: () =>
      import('./deal-form/deal-form.component').then(
        (m) => m.DealFormComponent,
      ),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./deal-detail/deal-detail.component').then(
        (m) => m.DealDetailComponent,
      ),
  },
  {
    path: ':id/edit',
    loadComponent: () =>
      import('./deal-form/deal-form.component').then(
        (m) => m.DealFormComponent,
      ),
  },
];

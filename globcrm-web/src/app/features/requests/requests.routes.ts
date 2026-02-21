import { Routes } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';
import { RequestListComponent } from './request-list/request-list.component';

export const REQUEST_ROUTES: Routes = [
  {
    path: '',
    providers: [provideTranslocoScope('requests')],
    children: [
      { path: '', component: RequestListComponent },
      {
        path: 'new',
        loadComponent: () =>
          import('./request-form/request-form.component').then(
            (m) => m.RequestFormComponent,
          ),
      },
      {
        path: ':id',
        loadComponent: () =>
          import('./request-detail/request-detail.component').then(
            (m) => m.RequestDetailComponent,
          ),
      },
      {
        path: ':id/edit',
        loadComponent: () =>
          import('./request-form/request-form.component').then(
            (m) => m.RequestFormComponent,
          ),
      },
    ],
  },
];

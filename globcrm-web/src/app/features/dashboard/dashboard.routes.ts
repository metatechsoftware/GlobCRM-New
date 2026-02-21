import { Routes } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';

export const DASHBOARD_ROUTES: Routes = [
  {
    path: '',
    providers: [provideTranslocoScope('dashboard')],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./pages/dashboard/dashboard.component').then(
            (m) => m.DashboardComponent
          ),
      },
    ],
  },
];

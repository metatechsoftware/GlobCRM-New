import { Routes } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';
import { authGuard } from '../../core/auth/auth.guard';

export const emailRoutes: Routes = [
  {
    path: '',
    providers: [provideTranslocoScope('emails')],
    children: [
      {
        path: '',
        loadComponent: () => import('./email-list/email-list.component').then(m => m.EmailListComponent),
        canActivate: [authGuard],
      },
      {
        path: ':id',
        loadComponent: () => import('./email-detail/email-detail.component').then(m => m.EmailDetailComponent),
        canActivate: [authGuard],
      },
    ],
  },
];

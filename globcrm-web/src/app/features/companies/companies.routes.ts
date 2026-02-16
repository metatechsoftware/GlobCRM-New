import { Routes } from '@angular/router';
import { CompanyListComponent } from './company-list/company-list.component';

export const COMPANY_ROUTES: Routes = [
  { path: '', component: CompanyListComponent },
  {
    path: 'new',
    loadComponent: () =>
      import('./company-form/company-form.component').then(
        (m) => m.CompanyFormComponent,
      ),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./company-detail/company-detail.component').then(
        (m) => m.CompanyDetailComponent,
      ),
  },
  {
    path: ':id/edit',
    loadComponent: () =>
      import('./company-form/company-form.component').then(
        (m) => m.CompanyFormComponent,
      ),
  },
];

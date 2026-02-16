import { Routes } from '@angular/router';
import { adminGuard } from '../../core/permissions/admin.guard';

export const SETTINGS_ROUTES: Routes = [
  {
    path: 'roles',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./roles/role-list.component').then(
        (m) => m.RoleListComponent
      ),
  },
  {
    path: 'roles/new',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./roles/role-edit.component').then(
        (m) => m.RoleEditComponent
      ),
  },
  {
    path: 'roles/:id',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./roles/role-edit.component').then(
        (m) => m.RoleEditComponent
      ),
  },
  {
    path: 'teams',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./teams/team-list.component').then(
        (m) => m.TeamListComponent
      ),
  },
  {
    path: 'teams/new',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./teams/team-edit.component').then(
        (m) => m.TeamEditComponent
      ),
  },
  {
    path: 'teams/:id',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./teams/team-edit.component').then(
        (m) => m.TeamEditComponent
      ),
  },
  {
    path: 'custom-fields',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./custom-fields/custom-field-list.component').then(
        (m) => m.CustomFieldListComponent
      ),
  },
  {
    path: '',
    redirectTo: 'roles',
    pathMatch: 'full',
  },
];

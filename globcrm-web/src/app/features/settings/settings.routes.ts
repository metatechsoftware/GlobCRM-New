import { Routes } from '@angular/router';

export const SETTINGS_ROUTES: Routes = [
  {
    path: 'roles',
    loadComponent: () =>
      import('./roles/role-list.component').then(
        (m) => m.RoleListComponent
      ),
  },
  {
    path: 'roles/new',
    loadComponent: () =>
      import('./roles/role-edit.component').then(
        (m) => m.RoleEditComponent
      ),
  },
  {
    path: 'roles/:id',
    loadComponent: () =>
      import('./roles/role-edit.component').then(
        (m) => m.RoleEditComponent
      ),
  },
  {
    path: 'teams',
    loadComponent: () =>
      import('./teams/team-list.component').then(
        (m) => m.TeamListComponent
      ),
  },
  {
    path: 'teams/new',
    loadComponent: () =>
      import('./teams/team-edit.component').then(
        (m) => m.TeamEditComponent
      ),
  },
  {
    path: 'teams/:id',
    loadComponent: () =>
      import('./teams/team-edit.component').then(
        (m) => m.TeamEditComponent
      ),
  },
  {
    path: 'custom-fields',
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

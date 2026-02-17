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
    path: 'pipelines',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./pipelines/pipeline-list.component').then(
        (m) => m.PipelineListComponent
      ),
  },
  {
    path: 'pipelines/new',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./pipelines/pipeline-edit.component').then(
        (m) => m.PipelineEditComponent
      ),
  },
  {
    path: 'pipelines/:id',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./pipelines/pipeline-edit.component').then(
        (m) => m.PipelineEditComponent
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
    path: 'email-accounts',
    loadComponent: () =>
      import('./email-accounts/email-account-settings.component').then(
        (m) => m.EmailAccountSettingsComponent
      ),
  },
  {
    path: 'notification-preferences',
    loadComponent: () =>
      import('./notification-preferences/notification-preferences.component').then(
        (m) => m.NotificationPreferencesComponent
      ),
  },
  {
    path: '',
    loadComponent: () =>
      import('./settings-hub.component').then(
        (m) => m.SettingsHubComponent
      ),
    pathMatch: 'full',
  },
];

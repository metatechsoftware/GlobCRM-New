import { Routes } from '@angular/router';

export const PROFILE_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./profile-edit/profile-edit.component').then(
        (m) => m.ProfileEditComponent
      ),
  },
  {
    path: ':userId',
    loadComponent: () =>
      import('./profile-view/profile-view.component').then(
        (m) => m.ProfileViewComponent
      ),
  },
];

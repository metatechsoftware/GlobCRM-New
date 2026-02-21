import { Routes } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';

export const PROFILE_ROUTES: Routes = [
  {
    path: '',
    providers: [provideTranslocoScope('profile')],
    children: [
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
    ],
  },
];

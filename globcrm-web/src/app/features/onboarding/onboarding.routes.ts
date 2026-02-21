import { Routes } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';

export const ONBOARDING_ROUTES: Routes = [
  {
    path: '',
    providers: [provideTranslocoScope('onboarding')],
    children: [
      {
        path: 'wizard',
        loadComponent: () =>
          import('./pages/wizard/wizard.component').then(
            (m) => m.WizardComponent
          ),
      },
      {
        path: '',
        redirectTo: 'wizard',
        pathMatch: 'full',
      },
    ],
  },
];

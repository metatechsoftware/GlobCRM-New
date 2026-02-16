import { Routes } from '@angular/router';

export const ONBOARDING_ROUTES: Routes = [
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
];

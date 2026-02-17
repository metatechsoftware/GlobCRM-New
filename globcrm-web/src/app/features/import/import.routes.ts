import { Routes } from '@angular/router';

export const IMPORT_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./import-wizard/import-wizard.component').then(
        (m) => m.ImportWizardComponent,
      ),
  },
];

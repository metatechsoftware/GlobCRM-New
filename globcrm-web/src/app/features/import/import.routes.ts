import { Routes } from '@angular/router';

export const IMPORT_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./import-wizard/import-wizard.component').then(
        (m) => m.ImportWizardComponent,
      ),
    title: 'Import Data',
  },
  {
    path: 'history',
    loadComponent: () =>
      import('./import-history/import-history.component').then(
        (m) => m.ImportHistoryComponent,
      ),
    title: 'Import History',
  },
];

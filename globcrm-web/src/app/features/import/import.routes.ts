import { Routes } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';

export const IMPORT_ROUTES: Routes = [
  {
    path: '',
    providers: [provideTranslocoScope('import')],
    children: [
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
    ],
  },
];

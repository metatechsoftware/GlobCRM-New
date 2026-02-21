import { Routes } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';

export const duplicatesRoutes: Routes = [
  {
    path: '',
    providers: [provideTranslocoScope('duplicates')],
    children: [
      { path: '', redirectTo: 'scan', pathMatch: 'full' },
      {
        path: 'scan',
        loadComponent: () =>
          import('./duplicate-scan/duplicate-scan.component').then(
            (m) => m.DuplicateScanComponent
          ),
      },
      {
        path: 'merge',
        loadComponent: () =>
          import('./merge-comparison/merge-comparison.component').then(
            (m) => m.MergeComparisonComponent
          ),
      },
    ],
  },
];

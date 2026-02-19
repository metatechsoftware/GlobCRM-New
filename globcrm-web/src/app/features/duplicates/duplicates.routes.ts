import { Routes } from '@angular/router';

export const duplicatesRoutes: Routes = [
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
];

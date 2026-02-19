import { Routes } from '@angular/router';

export const REPORT_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./report-gallery/report-gallery.component').then(
        (m) => m.ReportGalleryComponent,
      ),
  },
  {
    path: 'new',
    loadComponent: () =>
      import('./report-builder/report-builder.component').then(
        (m) => m.ReportBuilderComponent,
      ),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./report-builder/report-builder.component').then(
        (m) => m.ReportBuilderComponent,
      ),
  },
  {
    path: ':id/edit',
    loadComponent: () =>
      import('./report-builder/report-builder.component').then(
        (m) => m.ReportBuilderComponent,
      ),
  },
];

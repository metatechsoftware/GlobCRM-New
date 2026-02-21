import { Routes } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';

export const REPORT_ROUTES: Routes = [
  {
    path: '',
    providers: [provideTranslocoScope('reports')],
    children: [
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
    ],
  },
];

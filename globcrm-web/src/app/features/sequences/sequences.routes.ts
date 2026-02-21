import { Routes } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';

export const SEQUENCE_ROUTES: Routes = [
  {
    path: '',
    providers: [provideTranslocoScope('sequences')],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./sequence-list/sequence-list.component').then(
            (m) => m.SequenceListComponent,
          ),
      },
      {
        path: 'new',
        loadComponent: () =>
          import('./sequence-builder/sequence-builder.component').then(
            (m) => m.SequenceBuilderComponent,
          ),
      },
      {
        path: ':id',
        loadComponent: () =>
          import('./sequence-detail/sequence-detail.component').then(
            (m) => m.SequenceDetailComponent,
          ),
      },
      {
        path: ':id/edit',
        loadComponent: () =>
          import('./sequence-builder/sequence-builder.component').then(
            (m) => m.SequenceBuilderComponent,
          ),
      },
    ],
  },
];

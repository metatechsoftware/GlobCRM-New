import { Routes } from '@angular/router';

export const SEQUENCE_ROUTES: Routes = [
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
];

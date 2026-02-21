import { Routes } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';
import { QuoteListComponent } from './quote-list/quote-list.component';

export const QUOTE_ROUTES: Routes = [
  {
    path: '',
    providers: [provideTranslocoScope('quotes')],
    children: [
      { path: '', component: QuoteListComponent },
      {
        path: 'new',
        loadComponent: () =>
          import('./quote-form/quote-form.component').then(
            (m) => m.QuoteFormComponent,
          ),
      },
      {
        path: ':id',
        loadComponent: () =>
          import('./quote-detail/quote-detail.component').then(
            (m) => m.QuoteDetailComponent,
          ),
      },
      {
        path: ':id/edit',
        loadComponent: () =>
          import('./quote-form/quote-form.component').then(
            (m) => m.QuoteFormComponent,
          ),
      },
    ],
  },
];

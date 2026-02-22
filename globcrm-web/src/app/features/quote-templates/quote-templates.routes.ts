import { Routes } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';
import { QuoteTemplateStore } from './quote-template.store';

export const QUOTE_TEMPLATE_ROUTES: Routes = [
  {
    path: '',
    providers: [QuoteTemplateStore, provideTranslocoScope('quoteTemplates')],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./quote-template-list/quote-template-list.component').then(
            (m) => m.QuoteTemplateListComponent,
          ),
      },
      {
        path: 'new',
        loadComponent: () =>
          import('./quote-template-editor/quote-template-editor.component').then(
            (m) => m.QuoteTemplateEditorComponent,
          ),
      },
      {
        path: 'edit/:id',
        loadComponent: () =>
          import('./quote-template-editor/quote-template-editor.component').then(
            (m) => m.QuoteTemplateEditorComponent,
          ),
      },
    ],
  },
];

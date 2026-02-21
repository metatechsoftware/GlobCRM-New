import { Routes } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';

export const EMAIL_TEMPLATE_ROUTES: Routes = [
  {
    path: '',
    providers: [provideTranslocoScope('email-templates')],
    children: [
      {
        path: '',
        loadComponent: () =>
          import(
            './email-template-list/email-template-list.component'
          ).then((m) => m.EmailTemplateListComponent),
      },
      {
        path: 'new',
        loadComponent: () =>
          import(
            './email-template-editor/email-template-editor.component'
          ).then((m) => m.EmailTemplateEditorComponent),
      },
      {
        path: ':id/edit',
        loadComponent: () =>
          import(
            './email-template-editor/email-template-editor.component'
          ).then((m) => m.EmailTemplateEditorComponent),
      },
    ],
  },
];

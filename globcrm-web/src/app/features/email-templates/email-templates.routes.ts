import { Routes } from '@angular/router';

export const EMAIL_TEMPLATE_ROUTES: Routes = [
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
];

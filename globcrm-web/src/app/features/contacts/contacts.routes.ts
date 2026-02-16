import { Routes } from '@angular/router';
import { ContactListComponent } from './contact-list/contact-list.component';

export const CONTACT_ROUTES: Routes = [
  { path: '', component: ContactListComponent },
  {
    path: 'new',
    loadComponent: () =>
      import('./contact-form/contact-form.component').then(
        (m) => m.ContactFormComponent,
      ),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./contact-detail/contact-detail.component').then(
        (m) => m.ContactDetailComponent,
      ),
  },
  {
    path: ':id/edit',
    loadComponent: () =>
      import('./contact-form/contact-form.component').then(
        (m) => m.ContactFormComponent,
      ),
  },
];

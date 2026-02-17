import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: 'auth',
    loadChildren: () =>
      import('./features/auth/auth.routes').then((m) => m.AUTH_ROUTES),
  },
  {
    path: 'onboarding',
    canActivate: [authGuard],
    loadChildren: () =>
      import('./features/onboarding/onboarding.routes').then(
        (m) => m.ONBOARDING_ROUTES
      ),
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadChildren: () =>
      import('./features/dashboard/dashboard.routes').then(
        (m) => m.DASHBOARD_ROUTES
      ),
  },
  {
    path: 'settings',
    canActivate: [authGuard],
    loadChildren: () =>
      import('./features/settings/settings.routes').then(
        (m) => m.SETTINGS_ROUTES
      ),
  },
  {
    path: 'profile',
    canActivate: [authGuard],
    loadChildren: () =>
      import('./features/profile/profile.routes').then(
        (m) => m.PROFILE_ROUTES
      ),
  },
  {
    path: 'team-directory',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/profile/team-directory/team-directory.component').then(
        (m) => m.TeamDirectoryComponent
      ),
  },
  {
    path: 'companies',
    canActivate: [authGuard],
    loadChildren: () =>
      import('./features/companies/companies.routes').then(
        (m) => m.COMPANY_ROUTES
      ),
  },
  {
    path: 'contacts',
    canActivate: [authGuard],
    loadChildren: () =>
      import('./features/contacts/contacts.routes').then(
        (m) => m.CONTACT_ROUTES
      ),
  },
  {
    path: 'products',
    canActivate: [authGuard],
    loadChildren: () =>
      import('./features/products/products.routes').then(
        (m) => m.PRODUCT_ROUTES
      ),
  },
  {
    path: 'deals',
    canActivate: [authGuard],
    loadChildren: () =>
      import('./features/deals/deals.routes').then(
        (m) => m.DEAL_ROUTES
      ),
  },
  {
    path: 'activities',
    canActivate: [authGuard],
    loadChildren: () =>
      import('./features/activities/activities.routes').then(
        (m) => m.ACTIVITY_ROUTES
      ),
  },
  {
    path: 'quotes',
    canActivate: [authGuard],
    loadChildren: () =>
      import('./features/quotes/quotes.routes').then(
        (m) => m.QUOTE_ROUTES
      ),
  },
  {
    path: 'requests',
    canActivate: [authGuard],
    loadChildren: () =>
      import('./features/requests/requests.routes').then(
        (m) => m.REQUEST_ROUTES
      ),
  },
  {
    path: 'emails',
    canActivate: [authGuard],
    loadChildren: () =>
      import('./features/emails/emails.routes').then(
        (m) => m.emailRoutes
      ),
  },
  {
    path: 'feed',
    canActivate: [authGuard],
    loadChildren: () =>
      import('./features/feed/feed.routes').then(
        (m) => m.FEED_ROUTES
      ),
  },
  {
    path: 'import',
    canActivate: [authGuard],
    loadChildren: () =>
      import('./features/import/import.routes').then(
        (m) => m.IMPORT_ROUTES
      ),
  },
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full',
  },
  {
    path: '**',
    redirectTo: 'dashboard',
  },
];

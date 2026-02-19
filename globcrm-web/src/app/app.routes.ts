import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { permissionGuard } from './core/permissions/permission.guard';

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
    canActivate: [authGuard, permissionGuard('Company', 'View')],
    loadChildren: () =>
      import('./features/companies/companies.routes').then(
        (m) => m.COMPANY_ROUTES
      ),
  },
  {
    path: 'contacts',
    canActivate: [authGuard, permissionGuard('Contact', 'View')],
    loadChildren: () =>
      import('./features/contacts/contacts.routes').then(
        (m) => m.CONTACT_ROUTES
      ),
  },
  {
    path: 'leads',
    canActivate: [authGuard, permissionGuard('Lead', 'View')],
    loadChildren: () =>
      import('./features/leads/leads.routes').then(
        (m) => m.LEAD_ROUTES
      ),
  },
  {
    path: 'products',
    canActivate: [authGuard, permissionGuard('Product', 'View')],
    loadChildren: () =>
      import('./features/products/products.routes').then(
        (m) => m.PRODUCT_ROUTES
      ),
  },
  {
    path: 'deals',
    canActivate: [authGuard, permissionGuard('Deal', 'View')],
    loadChildren: () =>
      import('./features/deals/deals.routes').then(
        (m) => m.DEAL_ROUTES
      ),
  },
  {
    path: 'activities',
    canActivate: [authGuard, permissionGuard('Activity', 'View')],
    loadChildren: () =>
      import('./features/activities/activities.routes').then(
        (m) => m.ACTIVITY_ROUTES
      ),
  },
  {
    path: 'quotes',
    canActivate: [authGuard, permissionGuard('Quote', 'View')],
    loadChildren: () =>
      import('./features/quotes/quotes.routes').then(
        (m) => m.QUOTE_ROUTES
      ),
  },
  {
    path: 'requests',
    canActivate: [authGuard, permissionGuard('Request', 'View')],
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
    path: 'notes',
    canActivate: [authGuard, permissionGuard('Note', 'View')],
    loadChildren: () =>
      import('./features/notes/notes.routes').then(
        (m) => m.NOTES_ROUTES
      ),
  },
  {
    path: 'calendar',
    canActivate: [authGuard],
    loadChildren: () =>
      import('./features/calendar/calendar.routes').then(
        (m) => m.CALENDAR_ROUTES
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
    path: 'email-templates',
    canActivate: [authGuard, permissionGuard('EmailTemplate', 'View')],
    loadChildren: () =>
      import('./features/email-templates/email-templates.routes').then(
        (m) => m.EMAIL_TEMPLATE_ROUTES
      ),
  },
  {
    path: 'sequences',
    canActivate: [authGuard, permissionGuard('EmailSequence', 'View')],
    loadChildren: () =>
      import('./features/sequences/sequences.routes').then(
        (m) => m.SEQUENCE_ROUTES
      ),
  },
  {
    path: 'workflows',
    canActivate: [authGuard, permissionGuard('Workflow', 'View')],
    loadChildren: () =>
      import('./features/workflows/workflows.routes').then(
        (m) => m.WORKFLOW_ROUTES
      ),
  },
  {
    path: 'reports',
    canActivate: [authGuard, permissionGuard('Report', 'View')],
    loadChildren: () =>
      import('./features/reports/reports.routes').then(
        (m) => m.REPORT_ROUTES
      ),
  },
  {
    path: 'duplicates',
    canActivate: [authGuard],
    loadChildren: () =>
      import('./features/duplicates/duplicates.routes').then(
        (m) => m.duplicatesRoutes
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

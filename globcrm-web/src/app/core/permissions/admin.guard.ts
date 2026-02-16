import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStore } from '../auth/auth.store';

/**
 * Route guard that restricts access to Admin-role users only.
 *
 * This mirrors the backend pattern where settings controllers use
 * [Authorize(Roles = "Admin")]. Since Role, Team, and CustomField
 * are not in the entity permission system, role-based access control
 * is used instead of entity-level permissionGuard.
 *
 * Non-admin users are redirected to /dashboard.
 */
export const adminGuard: CanActivateFn = () => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  if (authStore.userRole() === 'Admin') {
    return true;
  }

  router.navigate(['/dashboard']);
  return false;
};

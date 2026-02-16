import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { PermissionStore } from './permission.store';

/**
 * Factory function that creates a route guard checking entity permissions.
 *
 * Usage in routes:
 *   { path: 'contacts', canActivate: [permissionGuard('Contact', 'View')], ... }
 *   { path: 'settings/roles', canActivate: [permissionGuard('Role', 'Manage')], ... }
 *
 * The guard checks the PermissionStore for the required entity+operation permission.
 * If permissions are not yet loaded, it waits briefly for them.
 * If the user lacks permission, they are redirected to /dashboard.
 */
export function permissionGuard(
  entityType: string,
  operation: string
): CanActivateFn {
  return () => {
    const permissionStore = inject(PermissionStore);
    const router = inject(Router);

    // If permissions haven't loaded yet, wait for them.
    // This handles the case where a guard fires before the store is populated.
    if (!permissionStore.isLoaded()) {
      // Return a promise that polls until loaded or times out
      return new Promise<boolean>((resolve) => {
        let attempts = 0;
        const maxAttempts = 50; // 5 seconds max wait (50 * 100ms)
        const interval = setInterval(() => {
          attempts++;
          if (permissionStore.isLoaded()) {
            clearInterval(interval);
            const allowed = permissionStore.hasPermission(
              entityType,
              operation
            );
            if (!allowed) {
              router.navigate(['/dashboard']);
            }
            resolve(allowed);
          } else if (attempts >= maxAttempts) {
            clearInterval(interval);
            // Timeout: allow access but permissions may not be enforced
            console.warn(
              'Permission store did not load in time. Allowing access.'
            );
            resolve(true);
          }
        }, 100);
      });
    }

    const allowed = permissionStore.hasPermission(entityType, operation);
    if (!allowed) {
      router.navigate(['/dashboard']);
    }
    return allowed;
  };
}

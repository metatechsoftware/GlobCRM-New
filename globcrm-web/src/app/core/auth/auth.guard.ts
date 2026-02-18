import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, catchError, of } from 'rxjs';
import { AuthStore } from './auth.store';
import { AuthService } from './auth.service';

/**
 * Functional route guard that protects authenticated routes.
 * - If already authenticated (restored by APP_INITIALIZER), allows access.
 * - If not authenticated but has a stored refresh token, attempts full restore via initializeAuth().
 * - If all else fails, redirects to /auth/login with returnUrl.
 */
export const authGuard: CanActivateFn = (route, state) => {
  const authStore = inject(AuthStore);
  const authService = inject(AuthService);
  const router = inject(Router);

  // Already authenticated (typically restored by APP_INITIALIZER), allow access
  if (authStore.isAuthenticated()) {
    return true;
  }

  // Check for stored refresh token and attempt full restore
  const storedRefreshToken =
    localStorage.getItem('globcrm_refresh_token') ??
    sessionStorage.getItem('globcrm_refresh_token');
  if (storedRefreshToken) {
    return authService.initializeAuth().pipe(
      map(() => {
        if (authStore.isAuthenticated()) {
          return true;
        }
        return router.createUrlTree(['/auth/login'], {
          queryParams: { returnUrl: state.url },
        });
      }),
      catchError(() => {
        return of(
          router.createUrlTree(['/auth/login'], {
            queryParams: { returnUrl: state.url },
          })
        );
      })
    );
  }

  // No authentication, redirect to login
  return router.createUrlTree(['/auth/login'], {
    queryParams: { returnUrl: state.url },
  });
};

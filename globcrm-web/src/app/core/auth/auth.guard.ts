import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, catchError, of } from 'rxjs';
import { AuthStore } from './auth.store';
import { AuthService } from './auth.service';
import { decodeUserInfoFromJwt } from './auth.utils';

/**
 * Functional route guard that protects authenticated routes.
 * - If already authenticated, allows access.
 * - If not authenticated but has a stored refresh token, attempts silent refresh.
 * - If all else fails, redirects to /auth/login with returnUrl.
 */
export const authGuard: CanActivateFn = (route, state) => {
  const authStore = inject(AuthStore);
  const authService = inject(AuthService);
  const router = inject(Router);

  // Already authenticated, allow access
  if (authStore.isAuthenticated()) {
    return true;
  }

  // Check for stored refresh token and attempt silent refresh
  const storedRefreshToken = localStorage.getItem('globcrm_refresh_token');
  if (storedRefreshToken) {
    return authService.refreshToken(storedRefreshToken).pipe(
      map((response) => {
        // Decode JWT and set user BEFORE setting tokens, so organizationId
        // is available when isAuthenticated becomes true and effects fire
        const userInfo = decodeUserInfoFromJwt(response.accessToken);
        if (userInfo) {
          authStore.setUser(userInfo);
        }
        authStore.setTokens(response.accessToken, response.refreshToken);
        localStorage.setItem('globcrm_refresh_token', response.refreshToken);
        return true;
      }),
      catchError(() => {
        localStorage.removeItem('globcrm_refresh_token');
        localStorage.removeItem('globcrm_remember_me');
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

import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthStore } from './auth.store';
import { AuthService } from './auth.service';

/**
 * Auth endpoints that should NOT receive a Bearer token.
 */
const AUTH_ENDPOINTS = [
  '/api/auth/login',
  '/api/auth/login-extended',
  '/api/auth/register',
  '/api/auth/refresh-extended',
  '/api/auth/forgotPassword',
  '/api/auth/resetPassword',
  '/api/auth/confirmEmail',
  '/api/auth/resendConfirmationEmail',
];

const AUTH_ENDPOINT_PREFIXES = [
  '/api/organizations/check-subdomain',
];

function isAuthEndpoint(url: string): boolean {
  const path = url.split('?')[0];
  return AUTH_ENDPOINTS.some((ep) => path.endsWith(ep)) ||
    AUTH_ENDPOINT_PREFIXES.some((prefix) => path.includes(prefix));
}

function addAuthHeaders(req: HttpRequest<unknown>, token: string, tenantId: string | null): HttpRequest<unknown> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  if (tenantId) {
    headers['X-Tenant-Id'] = tenantId;
  }
  return req.clone({ setHeaders: headers });
}

export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
) => {
  const authStore = inject(AuthStore);
  const authService = inject(AuthService);

  // Do not attach token to auth-related endpoints
  if (isAuthEndpoint(req.url)) {
    return next(req);
  }

  const accessToken = authStore.accessToken();
  const tenantId = authStore.user()?.organizationId ?? null;

  // Attach Bearer token and tenant ID if available
  const authReq = accessToken ? addAuthHeaders(req, accessToken, tenantId) : req;

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      // Only attempt refresh on 401 and if we have a refresh token
      if (error.status === 401 && authStore.refreshToken()) {
        const refreshToken = authStore.refreshToken()!;
        return authService.refreshToken(refreshToken).pipe(
          switchMap((response) => {
            // Update tokens in the store
            authStore.setTokens(response.accessToken, response.refreshToken);

            // Persist refresh token to the appropriate storage
            if (localStorage.getItem('globcrm_remember_me') === 'true') {
              localStorage.setItem('globcrm_refresh_token', response.refreshToken);
            } else {
              sessionStorage.setItem('globcrm_refresh_token', response.refreshToken);
            }

            // Retry the original request with the new access token
            const retryReq = addAuthHeaders(req, response.accessToken, tenantId);
            return next(retryReq);
          }),
          catchError((refreshError) => {
            // Refresh failed, logout
            authService.logout();
            return throwError(() => refreshError);
          })
        );
      }

      return throwError(() => error);
    })
  );
};

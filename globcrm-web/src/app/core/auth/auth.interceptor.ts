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
  '/api/auth/register',
  '/api/auth/refresh',
  '/api/auth/forgotPassword',
  '/api/auth/resetPassword',
  '/api/auth/confirmEmail',
  '/api/auth/resendConfirmationEmail',
  '/api/organizations',
  '/api/organizations/join',
  '/api/organizations/check-subdomain',
];

function isAuthEndpoint(url: string): boolean {
  return AUTH_ENDPOINTS.some((endpoint) => url.includes(endpoint));
}

function addAuthHeader(req: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
  return req.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`,
    },
  });
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

  // Attach Bearer token if available
  const authReq = accessToken ? addAuthHeader(req, accessToken) : req;

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      // Only attempt refresh on 401 and if we have a refresh token
      if (error.status === 401 && authStore.refreshToken()) {
        const refreshToken = authStore.refreshToken()!;
        return authService.refreshToken(refreshToken).pipe(
          switchMap((response) => {
            // Update tokens in the store
            authStore.setTokens(response.accessToken, response.refreshToken);

            // Persist refresh token if user had rememberMe
            if (localStorage.getItem('globcrm_remember_me') === 'true') {
              localStorage.setItem('globcrm_refresh_token', response.refreshToken);
            }

            // Retry the original request with the new access token
            const retryReq = addAuthHeader(req, response.accessToken);
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

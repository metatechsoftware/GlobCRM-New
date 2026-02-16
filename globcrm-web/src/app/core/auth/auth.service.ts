import { Injectable, inject, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap, catchError, throwError, of, EMPTY } from 'rxjs';
import { ApiService } from '../api/api.service';
import { AuthStore } from './auth.store';
import {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  CreateOrgRequest,
  JoinOrgRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  TwoFactorRequest,
  TwoFactorInfo,
  UserInfo,
  SendInvitationsRequest,
  SendInvitationsResponse,
  OrganizationSettings,
} from './auth.models';

const REFRESH_TOKEN_KEY = 'globcrm_refresh_token';
const REMEMBER_ME_KEY = 'globcrm_remember_me';

@Injectable({ providedIn: 'root' })
export class AuthService implements OnDestroy {
  private readonly api = inject(ApiService);
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);
  private refreshTimerId: ReturnType<typeof setTimeout> | null = null;

  /**
   * Attempt to restore session from stored refresh token on app init.
   */
  initializeAuth(): Observable<void> {
    const storedRefreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!storedRefreshToken) {
      return of(undefined);
    }

    return new Observable<void>((subscriber) => {
      this.refreshToken(storedRefreshToken).subscribe({
        next: (response) => {
          this.handleLoginSuccess(response, true);
          this.loadUserInfo().subscribe({
            next: () => {
              subscriber.next(undefined);
              subscriber.complete();
            },
            error: () => {
              subscriber.next(undefined);
              subscriber.complete();
            },
          });
        },
        error: () => {
          this.clearStoredTokens();
          subscriber.next(undefined);
          subscriber.complete();
        },
      });
    });
  }

  login(request: LoginRequest): Observable<LoginResponse> {
    this.authStore.setLoading(true);
    return this.api
      .post<LoginResponse>('/api/auth/login-extended', {
        email: request.email,
        password: request.password,
        rememberMe: request.rememberMe,
      })
      .pipe(
        tap((response) => {
          this.handleLoginSuccess(response, request.rememberMe);
        }),
        catchError((error) => {
          this.authStore.setError(error.message ?? 'Login failed');
          return throwError(() => error);
        })
      );
  }

  register(request: RegisterRequest): Observable<void> {
    this.authStore.setLoading(true);
    return this.api.post<void>('/api/auth/register', request).pipe(
      tap(() => this.authStore.setLoading(false)),
      catchError((error) => {
        this.authStore.setError(error.message ?? 'Registration failed');
        return throwError(() => error);
      })
    );
  }

  createOrganization(request: CreateOrgRequest): Observable<LoginResponse> {
    this.authStore.setLoading(true);
    return this.api
      .post<LoginResponse>('/api/organizations', request)
      .pipe(
        tap((response) => {
          this.handleLoginSuccess(response, true);
        }),
        catchError((error) => {
          this.authStore.setError(error.message ?? 'Organization creation failed');
          return throwError(() => error);
        })
      );
  }

  joinOrganization(request: JoinOrgRequest): Observable<LoginResponse> {
    this.authStore.setLoading(true);
    return this.api
      .post<LoginResponse>('/api/organizations/join', request)
      .pipe(
        tap((response) => {
          this.handleLoginSuccess(response, true);
        }),
        catchError((error) => {
          this.authStore.setError(error.message ?? 'Failed to join organization');
          return throwError(() => error);
        })
      );
  }

  confirmEmail(userId: string, code: string): Observable<void> {
    return this.api.get<void>(
      `/api/auth/confirmEmail?userId=${encodeURIComponent(userId)}&code=${encodeURIComponent(code)}`
    );
  }

  resendConfirmationEmail(email: string): Observable<void> {
    return this.api.post<void>('/api/auth/resendConfirmationEmail', { email });
  }

  forgotPassword(request: ForgotPasswordRequest): Observable<void> {
    return this.api.post<void>('/api/auth/forgotPassword', request);
  }

  resetPassword(request: ResetPasswordRequest): Observable<void> {
    return this.api.post<void>('/api/auth/resetPassword', request);
  }

  refreshToken(refreshToken: string): Observable<LoginResponse> {
    return this.api.post<LoginResponse>('/api/auth/refresh', { refreshToken });
  }

  get2faInfo(): Observable<TwoFactorInfo> {
    return this.api.post<TwoFactorInfo>('/api/auth/manage/2fa', {});
  }

  enable2fa(request: TwoFactorRequest): Observable<TwoFactorInfo> {
    return this.api.post<TwoFactorInfo>('/api/auth/manage/2fa', {
      enable: true,
      twoFactorCode: request.twoFactorCode,
    });
  }

  disable2fa(): Observable<TwoFactorInfo> {
    return this.api.post<TwoFactorInfo>('/api/auth/manage/2fa', {
      enable: false,
    });
  }

  getUserInfo(): Observable<UserInfo> {
    return this.api.get<UserInfo>('/api/auth/manage/info');
  }

  loadUserInfo(): Observable<UserInfo> {
    return this.getUserInfo().pipe(
      tap((user) => this.authStore.setUser(user)),
      catchError((error) => {
        console.error('Failed to load user info:', error);
        return throwError(() => error);
      })
    );
  }

  checkSubdomainAvailability(subdomain: string): Observable<{ available: boolean }> {
    return this.api.get<{ available: boolean }>(
      `/api/organizations/check-subdomain?name=${encodeURIComponent(subdomain)}`
    );
  }

  sendInvitations(request: SendInvitationsRequest): Observable<SendInvitationsResponse> {
    return this.api.post<SendInvitationsResponse>('/api/invitations/send', request);
  }

  updateOrganizationSettings(settings: OrganizationSettings): Observable<void> {
    return this.api.put<void>('/api/organizations/settings', settings);
  }

  completeSetup(): Observable<void> {
    return this.api.post<void>('/api/organizations/complete-setup', {});
  }

  logout(): void {
    this.cancelRefreshTimer();
    this.clearStoredTokens();
    this.authStore.clearAuth();
    this.router.navigate(['/auth/login']);
  }

  getAccessToken(): string | null {
    return this.authStore.accessToken();
  }

  isAuthenticated(): boolean {
    return this.authStore.isAuthenticated();
  }

  ngOnDestroy(): void {
    this.cancelRefreshTimer();
  }

  /**
   * Handle successful login/refresh: set tokens, persist refresh token if rememberMe,
   * schedule automatic token refresh at 80% of expiry time.
   */
  private handleLoginSuccess(response: LoginResponse, rememberMe: boolean): void {
    this.authStore.setTokens(response.accessToken, response.refreshToken);
    this.authStore.setLoading(false);

    if (rememberMe) {
      localStorage.setItem(REFRESH_TOKEN_KEY, response.refreshToken);
      localStorage.setItem(REMEMBER_ME_KEY, 'true');
    }

    this.scheduleTokenRefresh(response.expiresIn, response.refreshToken);
  }

  /**
   * Schedule automatic token refresh at 80% of the access token's expiry time.
   * E.g., for a 30-minute token, refresh at 24 minutes.
   */
  private scheduleTokenRefresh(expiresInSeconds: number, refreshToken: string): void {
    this.cancelRefreshTimer();

    const refreshAtMs = expiresInSeconds * 1000 * 0.8;

    this.refreshTimerId = setTimeout(() => {
      this.refreshToken(refreshToken).subscribe({
        next: (response) => {
          const shouldRemember = localStorage.getItem(REMEMBER_ME_KEY) === 'true';
          this.handleLoginSuccess(response, shouldRemember);
        },
        error: () => {
          this.logout();
        },
      });
    }, refreshAtMs);
  }

  private cancelRefreshTimer(): void {
    if (this.refreshTimerId !== null) {
      clearTimeout(this.refreshTimerId);
      this.refreshTimerId = null;
    }
  }

  private clearStoredTokens(): void {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(REMEMBER_ME_KEY);
  }
}

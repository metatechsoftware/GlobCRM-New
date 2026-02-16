import { computed } from '@angular/core';
import {
  signalStore,
  withState,
  withComputed,
  withMethods,
  patchState,
} from '@ngrx/signals';
import { AuthState, UserInfo } from './auth.models';

const initialState: AuthState = {
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  requiresTwoFactor: false,
};

export const AuthStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    userName: computed(() => {
      const user = store.user();
      return user ? `${user.firstName} ${user.lastName}` : '';
    }),
    userRole: computed(() => store.user()?.role ?? ''),
    organizationName: computed(() => store.user()?.organizationName ?? ''),
    hasRefreshToken: computed(() => !!store.refreshToken()),
  })),
  withMethods((store) => ({
    setTokens(accessToken: string, refreshToken: string): void {
      patchState(store, {
        accessToken,
        refreshToken,
        isAuthenticated: true,
        error: null,
      });
    },
    setUser(user: UserInfo): void {
      patchState(store, { user });
    },
    clearAuth(): void {
      patchState(store, {
        user: null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        requiresTwoFactor: false,
      });
    },
    setLoading(isLoading: boolean): void {
      patchState(store, { isLoading });
    },
    setError(error: string | null): void {
      patchState(store, { error, isLoading: false });
    },
    setRequiresTwoFactor(requiresTwoFactor: boolean): void {
      patchState(store, { requiresTwoFactor });
    },
  }))
);

import { computed } from '@angular/core';
import {
  signalStore,
  withState,
  withComputed,
  withMethods,
  patchState,
} from '@ngrx/signals';
import { OrganizationInfo } from '../auth/auth.models';

interface TenantState {
  subdomain: string | null;
  organization: OrganizationInfo | null;
}

const initialState: TenantState = {
  subdomain: null,
  organization: null,
};

export const TenantStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    isResolved: computed(() => store.organization() !== null),
    organizationName: computed(() => store.organization()?.name ?? ''),
  })),
  withMethods((store) => ({
    setSubdomain(subdomain: string | null): void {
      patchState(store, { subdomain });
    },
    setOrganization(organization: OrganizationInfo | null): void {
      patchState(store, { organization });
    },
    clear(): void {
      patchState(store, { subdomain: null, organization: null });
    },
  }))
);

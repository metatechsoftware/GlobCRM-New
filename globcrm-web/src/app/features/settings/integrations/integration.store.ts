import { inject } from '@angular/core';
import {
  signalStore,
  withState,
  withMethods,
  patchState,
} from '@ngrx/signals';
import { IntegrationService } from './integration.service';
import { IntegrationConnection } from './integration.models';

interface IntegrationState {
  connections: IntegrationConnection[];
  loading: boolean;
  error: string | null;
}

const initialState: IntegrationState = {
  connections: [],
  loading: false,
  error: null,
};

/**
 * NgRx Signal Store for integration connection state management.
 * Component-provided (not root) so each page gets its own instance.
 */
export const IntegrationStore = signalStore(
  withState(initialState),
  withMethods((store) => {
    const service = inject(IntegrationService);

    return {
      loadConnections(): void {
        patchState(store, { loading: true, error: null });
        service.getConnections().subscribe({
          next: (connections) => {
            patchState(store, { connections, loading: false });
          },
          error: (err) => {
            patchState(store, {
              loading: false,
              error: err?.message ?? 'Failed to load connections',
            });
          },
        });
      },

      connectIntegration(
        integrationKey: string,
        credentials: Record<string, string>,
        onSuccess?: (result: IntegrationConnection) => void,
        onError?: (error: string) => void,
      ): void {
        patchState(store, { loading: true, error: null });
        service.connect(integrationKey, credentials).subscribe({
          next: (connection) => {
            // Replace existing connection for this key or add new
            const existing = store
              .connections()
              .find((c) => c.integrationKey === integrationKey);
            const connections = existing
              ? store
                  .connections()
                  .map((c) =>
                    c.integrationKey === integrationKey ? connection : c,
                  )
              : [...store.connections(), connection];
            patchState(store, { connections, loading: false });
            onSuccess?.(connection);
          },
          error: (err) => {
            const message = err?.message ?? 'Failed to connect integration';
            patchState(store, { loading: false, error: message });
            onError?.(message);
          },
        });
      },

      disconnectIntegration(
        id: string,
        onSuccess?: (result: IntegrationConnection) => void,
      ): void {
        service.disconnect(id).subscribe({
          next: (updated) => {
            patchState(store, {
              connections: store
                .connections()
                .map((c) => (c.id === id ? updated : c)),
            });
            onSuccess?.(updated);
          },
          error: (err) => {
            patchState(store, {
              error: err?.message ?? 'Failed to disconnect integration',
            });
          },
        });
      },

      testConnection(
        id: string,
        onSuccess?: (result: { success: boolean; message: string }) => void,
        onError?: (error: string) => void,
      ): void {
        service.testConnection(id).subscribe({
          next: (result) => {
            onSuccess?.(result);
          },
          error: (err) => {
            const message = err?.message ?? 'Failed to test connection';
            patchState(store, { error: message });
            onError?.(message);
          },
        });
      },
    };
  }),
);

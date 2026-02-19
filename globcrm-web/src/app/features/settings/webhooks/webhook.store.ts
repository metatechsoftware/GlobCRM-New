import { inject } from '@angular/core';
import {
  signalStore,
  withState,
  withMethods,
  patchState,
} from '@ngrx/signals';
import { WebhookService } from './webhook.service';
import {
  WebhookSubscription,
  WebhookSubscriptionCreate,
  CreateWebhookRequest,
  UpdateWebhookRequest,
  PagedDeliveryLogs,
} from './webhook.models';

interface WebhookState {
  subscriptions: WebhookSubscription[];
  selectedSubscription: WebhookSubscription | null;
  deliveryLogs: PagedDeliveryLogs | null;
  loading: boolean;
  error: string | null;
}

const initialState: WebhookState = {
  subscriptions: [],
  selectedSubscription: null,
  deliveryLogs: null,
  loading: false,
  error: null,
};

/**
 * NgRx Signal Store for webhook state management.
 * Component-provided (not root) so each page gets its own instance.
 */
export const WebhookStore = signalStore(
  withState(initialState),
  withMethods((store) => {
    const service = inject(WebhookService);

    return {
      loadSubscriptions(): void {
        patchState(store, { loading: true, error: null });
        service.getSubscriptions().subscribe({
          next: (subscriptions) => {
            patchState(store, { subscriptions, loading: false });
          },
          error: (err) => {
            patchState(store, {
              loading: false,
              error: err?.message ?? 'Failed to load subscriptions',
            });
          },
        });
      },

      loadSubscription(id: string): void {
        patchState(store, { loading: true, error: null });
        service.getSubscription(id).subscribe({
          next: (subscription) => {
            patchState(store, {
              selectedSubscription: subscription,
              loading: false,
            });
          },
          error: (err) => {
            patchState(store, {
              loading: false,
              error: err?.message ?? 'Failed to load subscription',
            });
          },
        });
      },

      createSubscription(
        request: CreateWebhookRequest,
        onSuccess?: (result: WebhookSubscriptionCreate) => void,
      ): void {
        patchState(store, { loading: true, error: null });
        service.createSubscription(request).subscribe({
          next: (created) => {
            patchState(store, {
              subscriptions: [created, ...store.subscriptions()],
              loading: false,
            });
            onSuccess?.(created);
          },
          error: (err) => {
            patchState(store, {
              loading: false,
              error: err?.message ?? 'Failed to create subscription',
            });
          },
        });
      },

      updateSubscription(
        id: string,
        request: UpdateWebhookRequest,
        onSuccess?: (result: WebhookSubscription) => void,
      ): void {
        patchState(store, { loading: true, error: null });
        service.updateSubscription(id, request).subscribe({
          next: (updated) => {
            patchState(store, {
              subscriptions: store
                .subscriptions()
                .map((s) => (s.id === id ? updated : s)),
              selectedSubscription: updated,
              loading: false,
            });
            onSuccess?.(updated);
          },
          error: (err) => {
            patchState(store, {
              loading: false,
              error: err?.message ?? 'Failed to update subscription',
            });
          },
        });
      },

      deleteSubscription(id: string, onSuccess?: () => void): void {
        service.deleteSubscription(id).subscribe({
          next: () => {
            patchState(store, {
              subscriptions: store
                .subscriptions()
                .filter((s) => s.id !== id),
            });
            onSuccess?.();
          },
          error: (err) => {
            patchState(store, {
              error: err?.message ?? 'Failed to delete subscription',
            });
          },
        });
      },

      toggleSubscription(
        id: string,
        onSuccess?: (result: WebhookSubscription) => void,
      ): void {
        service.toggleSubscription(id).subscribe({
          next: (updated) => {
            patchState(store, {
              subscriptions: store
                .subscriptions()
                .map((s) => (s.id === id ? updated : s)),
              selectedSubscription:
                store.selectedSubscription()?.id === id
                  ? updated
                  : store.selectedSubscription(),
            });
            onSuccess?.(updated);
          },
          error: (err) => {
            patchState(store, {
              error: err?.message ?? 'Failed to toggle subscription',
            });
          },
        });
      },

      regenerateSecret(
        id: string,
        onSuccess?: (secret: string) => void,
      ): void {
        service.regenerateSecret(id).subscribe({
          next: (result) => {
            onSuccess?.(result.secret);
          },
          error: (err) => {
            patchState(store, {
              error: err?.message ?? 'Failed to regenerate secret',
            });
          },
        });
      },

      loadDeliveryLogs(
        page: number,
        pageSize: number,
        subscriptionId?: string,
      ): void {
        patchState(store, { loading: true, error: null });

        const obs = subscriptionId
          ? service.getSubscriptionDeliveryLogs(
              subscriptionId,
              page,
              pageSize,
            )
          : service.getDeliveryLogs(page, pageSize);

        obs.subscribe({
          next: (logs) => {
            patchState(store, { deliveryLogs: logs, loading: false });
          },
          error: (err) => {
            patchState(store, {
              loading: false,
              error: err?.message ?? 'Failed to load delivery logs',
            });
          },
        });
      },

      testWebhook(
        id: string,
        preview: boolean,
        onSuccess?: (result: any) => void,
      ): void {
        service.testWebhook(id, preview).subscribe({
          next: (result) => {
            onSuccess?.(result);
          },
          error: (err) => {
            patchState(store, {
              error: err?.message ?? 'Failed to test webhook',
            });
          },
        });
      },

      retryDelivery(logId: string, onSuccess?: () => void): void {
        service.retryDelivery(logId).subscribe({
          next: () => {
            onSuccess?.();
          },
          error: (err) => {
            patchState(store, {
              error: err?.message ?? 'Failed to retry delivery',
            });
          },
        });
      },
    };
  }),
);

import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpParams } from '@angular/common/http';
import { ApiService } from '../../../core/api/api.service';
import {
  WebhookSubscription,
  WebhookSubscriptionCreate,
  CreateWebhookRequest,
  UpdateWebhookRequest,
  PagedDeliveryLogs,
  WebhookTestPreview,
} from './webhook.models';

/**
 * API service for webhook subscription CRUD, delivery log viewing,
 * test webhook, secret regeneration, and manual retry.
 */
@Injectable({ providedIn: 'root' })
export class WebhookService {
  private readonly api = inject(ApiService);
  private readonly basePath = '/api/webhooks';

  /** List all webhook subscriptions for the current tenant. */
  getSubscriptions(): Observable<WebhookSubscription[]> {
    return this.api.get<WebhookSubscription[]>(this.basePath);
  }

  /** Get a single webhook subscription by ID. */
  getSubscription(id: string): Observable<WebhookSubscription> {
    return this.api.get<WebhookSubscription>(`${this.basePath}/${id}`);
  }

  /** Create a new webhook subscription. Returns the full secret (shown once). */
  createSubscription(
    request: CreateWebhookRequest,
  ): Observable<WebhookSubscriptionCreate> {
    return this.api.post<WebhookSubscriptionCreate>(this.basePath, request);
  }

  /** Update an existing webhook subscription (partial update). */
  updateSubscription(
    id: string,
    request: UpdateWebhookRequest,
  ): Observable<WebhookSubscription> {
    return this.api.put<WebhookSubscription>(
      `${this.basePath}/${id}`,
      request,
    );
  }

  /** Delete a webhook subscription and all its delivery logs. */
  deleteSubscription(id: string): Observable<void> {
    return this.api.delete<void>(`${this.basePath}/${id}`);
  }

  /** Regenerate the HMAC secret. Old secret immediately invalidated. */
  regenerateSecret(id: string): Observable<{ secret: string }> {
    return this.api.post<{ secret: string }>(
      `${this.basePath}/${id}/regenerate-secret`,
    );
  }

  /** Toggle a subscription's active state. Clears auto-disabled state on re-enable. */
  toggleSubscription(id: string): Observable<WebhookSubscription> {
    return this.api.post<WebhookSubscription>(
      `${this.basePath}/${id}/toggle`,
    );
  }

  /** Get delivery logs across all subscriptions (global log). */
  getDeliveryLogs(
    page: number,
    pageSize: number,
    subscriptionId?: string,
  ): Observable<PagedDeliveryLogs> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('pageSize', pageSize.toString());

    if (subscriptionId) {
      params = params.set('subscriptionId', subscriptionId);
    }

    return this.api.get<PagedDeliveryLogs>(
      `${this.basePath}/delivery-logs`,
      params,
    );
  }

  /** Get delivery logs for a specific subscription. */
  getSubscriptionDeliveryLogs(
    id: string,
    page: number,
    pageSize: number,
  ): Observable<PagedDeliveryLogs> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('pageSize', pageSize.toString());

    return this.api.get<PagedDeliveryLogs>(
      `${this.basePath}/${id}/delivery-logs`,
      params,
    );
  }

  /**
   * Test a webhook subscription.
   * preview=true: Returns sample payload for inspection.
   * preview=false: Enqueues a real delivery with sample data.
   */
  testWebhook(id: string, preview: boolean): Observable<any> {
    return this.api.post<any>(`${this.basePath}/${id}/test`, { preview });
  }

  /** Retry a failed delivery by re-enqueuing the original payload. */
  retryDelivery(logId: string): Observable<any> {
    return this.api.post<any>(
      `${this.basePath}/delivery-logs/${logId}/retry`,
    );
  }
}

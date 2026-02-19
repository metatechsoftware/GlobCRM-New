/**
 * TypeScript interfaces for webhook subscription management.
 * Mirrors backend DTOs from WebhooksController.
 */

// ---- Subscription Models ----

export interface WebhookSubscription {
  id: string;
  name: string;
  url: string;
  secretMask: string;
  eventSubscriptions: string[];
  includeCustomFields: boolean;
  isActive: boolean;
  isDisabled: boolean;
  consecutiveFailureCount: number;
  lastDeliveryAt: string | null;
  disabledAt: string | null;
  disabledReason: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Extended subscription returned on create — includes the full secret (shown once).
 */
export interface WebhookSubscriptionCreate extends WebhookSubscription {
  secret: string;
}

export interface CreateWebhookRequest {
  name: string;
  url: string;
  eventSubscriptions: string[];
  includeCustomFields: boolean;
}

export interface UpdateWebhookRequest {
  name?: string;
  url?: string;
  eventSubscriptions?: string[];
  includeCustomFields?: boolean;
  isActive?: boolean;
}

// ---- Delivery Log Models ----

export interface WebhookDeliveryLog {
  id: string;
  subscriptionId: string;
  subscriptionName: string;
  eventType: string;
  entityId: string;
  attemptNumber: number;
  success: boolean;
  httpStatusCode: number | null;
  responseBody: string | null;
  errorMessage: string | null;
  requestPayload: string;
  durationMs: number;
  createdAt: string;
}

export interface PagedDeliveryLogs {
  items: WebhookDeliveryLog[];
  totalCount: number;
  page: number;
  pageSize: number;
}

// ---- Test Models ----

export interface WebhookTestPreview {
  samplePayload: string;
}

export interface WebhookTestRequest {
  preview: boolean;
}

// ---- Constants ----

export const WEBHOOK_ENTITIES = [
  'Contact',
  'Company',
  'Deal',
  'Lead',
  'Activity',
] as const;

export const WEBHOOK_EVENTS = [
  'Created',
  'Updated',
  'Deleted',
] as const;

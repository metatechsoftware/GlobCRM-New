/**
 * Request (support ticket) entity models matching backend DTOs.
 * Used by RequestService and RequestStore.
 * Includes status workflow, priority, and category constants.
 */

// ─── Status & Workflow ─────────────────────────────────────────────────────

export type RequestStatus = 'New' | 'InProgress' | 'Resolved' | 'Closed';
export type RequestPriority = 'Low' | 'Medium' | 'High' | 'Urgent';

export const REQUEST_STATUSES: { value: RequestStatus; label: string; color: string }[] = [
  { value: 'New', label: 'New', color: 'var(--color-info)' },
  { value: 'InProgress', label: 'In Progress', color: 'var(--color-primary)' },
  { value: 'Resolved', label: 'Resolved', color: 'var(--color-success)' },
  { value: 'Closed', label: 'Closed', color: 'var(--color-text-muted)' },
];

export const REQUEST_PRIORITIES: { value: RequestPriority; label: string; color: string }[] = [
  { value: 'Low', label: 'Low', color: 'var(--color-success)' },
  { value: 'Medium', label: 'Medium', color: 'var(--color-info)' },
  { value: 'High', label: 'High', color: 'var(--color-warning)' },
  { value: 'Urgent', label: 'Urgent', color: 'var(--color-danger)' },
];

export const REQUEST_CATEGORIES: string[] = [
  'General',
  'Bug',
  'Feature',
  'Support',
  'Billing',
];

export const ALLOWED_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  New: ['InProgress', 'Closed'],
  InProgress: ['Resolved', 'New'],
  Resolved: ['Closed', 'InProgress'],
  Closed: ['InProgress'],
};

// ─── List DTO (lightweight for table) ──────────────────────────────────────

export interface RequestListDto {
  id: string;
  subject: string;
  status: RequestStatus;
  priority: RequestPriority;
  category: string | null;
  contactName: string | null;
  companyName: string | null;
  ownerName: string | null;
  assignedToName: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

// ─── Detail DTO (full load for detail page) ────────────────────────────────

export interface RequestDetailDto extends RequestListDto {
  description: string | null;
  contactId: string | null;
  companyId: string | null;
  ownerId: string | null;
  assignedToId: string | null;
  closedAt: string | null;
  customFields: Record<string, any>;
  allowedTransitions: string[];
}

// ─── Request DTOs ──────────────────────────────────────────────────────────

export interface CreateRequestRequest {
  subject: string;
  description?: string | null;
  priority: string;
  category?: string | null;
  contactId?: string | null;
  companyId?: string | null;
  assignedToId?: string | null;
  customFields?: Record<string, any>;
}

export interface UpdateRequestRequest {
  subject: string;
  description?: string | null;
  priority: string;
  category?: string | null;
  contactId?: string | null;
  companyId?: string | null;
  assignedToId?: string | null;
  customFields?: Record<string, any>;
}

export interface UpdateRequestStatusRequest {
  status: string;
}

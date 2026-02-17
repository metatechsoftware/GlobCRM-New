/**
 * Email entity models matching backend DTOs.
 * Used by EmailService and EmailStore.
 * Includes account status, thread view, and sync status constants.
 * Note: No workflow transitions for emails -- emails don't have status workflows like quotes/requests.
 */

// ─── Sync Status Constants ──────────────────────────────────────────────────

export type EmailSyncStatus = 'Active' | 'Paused' | 'Error' | 'Disconnected';

export const EMAIL_SYNC_STATUSES: { value: EmailSyncStatus; label: string; color: string }[] = [
  { value: 'Active', label: 'Active', color: '#4caf50' },
  { value: 'Paused', label: 'Paused', color: '#9e9e9e' },
  { value: 'Error', label: 'Error', color: '#f44336' },
  { value: 'Disconnected', label: 'Disconnected', color: '#ff9800' },
];

// ─── Account Status DTO ─────────────────────────────────────────────────────

export interface EmailAccountStatusDto {
  connected: boolean;
  gmailAddress?: string;
  lastSyncAt?: string;
  syncStatus?: string;
  errorMessage?: string;
}

// ─── List DTO (lightweight for table) ───────────────────────────────────────

export interface EmailListDto {
  id: string;
  subject: string;
  fromAddress: string;
  fromName: string;
  toAddresses: string[];
  bodyPreview?: string;
  sentAt: string;
  isInbound: boolean;
  isRead: boolean;
  isStarred: boolean;
  hasAttachments: boolean;
  gmailThreadId: string;
  linkedContactName?: string;
  linkedCompanyName?: string;
}

// ─── Detail DTO (full load for detail/thread page) ──────────────────────────

export interface EmailDetailDto extends EmailListDto {
  bodyHtml?: string;
  bodyText?: string;
  ccAddresses?: string[];
  bccAddresses?: string[];
  linkedContactId?: string;
  linkedCompanyId?: string;
  emailAccountId: string;
  gmailMessageId: string;
  syncedAt: string;
}

// ─── Thread DTO ─────────────────────────────────────────────────────────────

export interface EmailThreadDto {
  threadId: string;
  subject: string;
  messageCount: number;
  messages: EmailDetailDto[];
}

// ─── Request DTOs ───────────────────────────────────────────────────────────

export interface SendEmailRequest {
  to: string;
  subject: string;
  htmlBody: string;
  replyToThreadId?: string;
}

// ─── Connect Response ───────────────────────────────────────────────────────

export interface ConnectResponse {
  authorizationUrl: string;
}

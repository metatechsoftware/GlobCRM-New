/**
 * Email template entity models matching backend DTOs.
 * Used by EmailTemplateService, EmailTemplateStore, and email template components.
 */

// ─── Email Template Models ──────────────────────────────────────────────────

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string | null;
  designJson: string;
  htmlBody: string;
  categoryId: string | null;
  categoryName: string | null;
  ownerId: string | null;
  ownerName: string | null;
  isShared: boolean;
  isSeedData: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EmailTemplateListItem {
  id: string;
  name: string;
  subject: string | null;
  categoryId: string | null;
  categoryName: string | null;
  isShared: boolean;
  ownerId: string | null;
  ownerName: string | null;
  htmlBody: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Category Model ──────────────────────────────────────────────────────────

export interface EmailTemplateCategory {
  id: string;
  name: string;
  sortOrder: number;
  isSystem: boolean;
}

// ─── Merge Field Models ──────────────────────────────────────────────────────

export interface MergeField {
  key: string;
  label: string;
  group: string;
  isCustomField: boolean;
}

export type MergeFieldGroup = Record<string, MergeField[]>;

// ─── Request Models ──────────────────────────────────────────────────────────

export interface CreateEmailTemplateRequest {
  name: string;
  subject?: string | null;
  designJson: string;
  htmlBody: string;
  categoryId?: string | null;
  isShared: boolean;
}

export interface UpdateEmailTemplateRequest {
  name: string;
  subject?: string | null;
  designJson: string;
  htmlBody: string;
  categoryId?: string | null;
  isShared: boolean;
}

export interface PreviewRequest {
  entityType?: string | null;
  entityId?: string | null;
}

export interface PreviewResponse {
  renderedHtml: string;
  renderedSubject: string;
}

export interface CloneRequest {
  name: string;
}

/**
 * Quote template entity models matching backend DTOs.
 * Used by QuoteTemplateService, QuoteTemplateStore, and quote template components.
 */

// ─── Quote Template Models ──────────────────────────────────────────────────

export interface QuoteTemplate {
  id: string;
  name: string;
  designJson: string;
  htmlBody: string;
  isDefault: boolean;
  pageSize: string;
  pageOrientation: string;
  pageMarginTop: string;
  pageMarginRight: string;
  pageMarginBottom: string;
  pageMarginLeft: string;
  thumbnailUrl: string | null;
  ownerId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface QuoteTemplateListItem {
  id: string;
  name: string;
  isDefault: boolean;
  pageSize: string;
  pageOrientation: string;
  thumbnailUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Request Models ──────────────────────────────────────────────────────────

export interface CreateQuoteTemplateRequest {
  name: string;
  designJson: string;
  htmlBody: string;
  pageSize: string;
  pageOrientation: string;
  pageMarginTop: string;
  pageMarginRight: string;
  pageMarginBottom: string;
  pageMarginLeft: string;
  isDefault: boolean;
}

export interface UpdateQuoteTemplateRequest {
  name: string;
  designJson: string;
  htmlBody: string;
  pageSize: string;
  pageOrientation: string;
  pageMarginTop: string;
  pageMarginRight: string;
  pageMarginBottom: string;
  pageMarginLeft: string;
  isDefault: boolean;
}

// ─── Merge Tag Models ────────────────────────────────────────────────────────

export interface MergeTagGroup {
  name: string;
  mergeTags: Record<string, { name: string; value: string; sample?: string }>;
  rules?: {
    repeat?: {
      name: string;
      before: string;
      after: string;
    };
  };
}

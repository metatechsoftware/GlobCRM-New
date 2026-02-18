/**
 * Quote entity models matching backend DTOs.
 * Used by QuoteService and QuoteStore.
 * Includes line item models, calculation helpers, and status workflow constants.
 */

// ─── Status & Workflow ─────────────────────────────────────────────────────

export type QuoteStatus = 'Draft' | 'Sent' | 'Accepted' | 'Rejected' | 'Expired';

export const QUOTE_STATUSES: { value: QuoteStatus; label: string; color: string }[] = [
  { value: 'Draft', label: 'Draft', color: 'var(--color-text-muted)' },
  { value: 'Sent', label: 'Sent', color: 'var(--color-info)' },
  { value: 'Accepted', label: 'Accepted', color: 'var(--color-success)' },
  { value: 'Rejected', label: 'Rejected', color: 'var(--color-danger)' },
  { value: 'Expired', label: 'Expired', color: 'var(--color-warning)' },
];

export const QUOTE_TRANSITIONS: Record<QuoteStatus, QuoteStatus[]> = {
  Draft: ['Sent'],
  Sent: ['Accepted', 'Rejected', 'Expired', 'Draft'],
  Accepted: [],
  Rejected: ['Draft'],
  Expired: ['Draft'],
};

// ─── Line Item DTOs ────────────────────────────────────────────────────────

export interface QuoteLineItemDto {
  id: string;
  productId: string | null;
  description: string;
  sortOrder: number;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  taxPercent: number;
  lineTotal: number;
  discountAmount: number;
  taxAmount: number;
  netTotal: number;
}

// ─── Version DTO ───────────────────────────────────────────────────────────

export interface QuoteVersionDto {
  id: string;
  versionNumber: number;
  status: QuoteStatus;
  createdAt: string;
}

// ─── List DTO (lightweight for table) ──────────────────────────────────────

export interface QuoteListDto {
  id: string;
  quoteNumber: string;
  title: string;
  status: QuoteStatus;
  grandTotal: number;
  contactName: string | null;
  companyName: string | null;
  dealTitle: string | null;
  ownerName: string | null;
  versionNumber: number;
  issueDate: string;
  createdAt: string;
}

// ─── Detail DTO (full load for detail page) ────────────────────────────────

export interface QuoteDetailDto extends QuoteListDto {
  description: string | null;
  notes: string | null;
  expiryDate: string | null;
  lineItems: QuoteLineItemDto[];
  customFields: Record<string, any>;
  originalQuoteId: string | null;
  versions: QuoteVersionDto[];
}

// ─── Request DTOs ──────────────────────────────────────────────────────────

export interface CreateQuoteLineItemRequest {
  productId?: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  taxPercent: number;
}

export interface CreateQuoteRequest {
  title: string;
  description?: string | null;
  dealId?: string | null;
  contactId?: string | null;
  companyId?: string | null;
  issueDate: string;
  expiryDate?: string | null;
  notes?: string | null;
  lineItems: CreateQuoteLineItemRequest[];
  customFields?: Record<string, any>;
}

export interface UpdateQuoteRequest {
  title: string;
  description?: string | null;
  dealId?: string | null;
  contactId?: string | null;
  companyId?: string | null;
  issueDate: string;
  expiryDate?: string | null;
  notes?: string | null;
  lineItems: CreateQuoteLineItemRequest[];
  customFields?: Record<string, any>;
}

export interface UpdateQuoteStatusRequest {
  status: string;
}

// ─── Calculation Helpers (frontend live preview) ───────────────────────────

export interface LineTotals {
  lineTotal: number;
  discountAmount: number;
  taxAmount: number;
  netTotal: number;
}

export interface QuoteTotals {
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
}

/**
 * Calculate totals for a single line item.
 * Used for live preview in the quote form as user edits quantities/prices.
 */
export function calculateLineTotals(item: {
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  taxPercent: number;
}): LineTotals {
  const lineTotal = item.quantity * item.unitPrice;
  const discountAmount = Math.round(lineTotal * (item.discountPercent / 100) * 100) / 100;
  const taxableAmount = lineTotal - discountAmount;
  const taxAmount = Math.round(taxableAmount * (item.taxPercent / 100) * 100) / 100;
  const netTotal = lineTotal - discountAmount + taxAmount;

  return { lineTotal, discountAmount, taxAmount, netTotal };
}

/**
 * Calculate aggregate totals for all line items in a quote.
 * Used for live preview of subtotal, discount total, tax total, and grand total.
 */
export function calculateQuoteTotals(
  items: { quantity: number; unitPrice: number; discountPercent: number; taxPercent: number }[],
): QuoteTotals {
  let subtotal = 0;
  let discountTotal = 0;
  let taxTotal = 0;

  for (const item of items) {
    const totals = calculateLineTotals(item);
    subtotal += totals.lineTotal;
    discountTotal += totals.discountAmount;
    taxTotal += totals.taxAmount;
  }

  return {
    subtotal,
    discountTotal,
    taxTotal,
    grandTotal: subtotal - discountTotal + taxTotal,
  };
}

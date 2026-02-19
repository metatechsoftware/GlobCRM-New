/**
 * Duplicate detection and merge models matching backend DTOs.
 * Used by DuplicateService and duplicate feature components.
 */

export interface ContactDuplicateMatch {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  companyName: string | null;
  score: number;
  updatedAt: string;
}

export interface CompanyDuplicateMatch {
  id: string;
  name: string;
  website: string | null;
  email: string | null;
  phone: string | null;
  score: number;
  updatedAt: string;
}

export interface DuplicatePair {
  recordA: ContactDuplicateMatch | CompanyDuplicateMatch;
  recordB: ContactDuplicateMatch | CompanyDuplicateMatch;
  score: number;
}

export interface DuplicateScanResult {
  items: DuplicatePair[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface MergePreview {
  contactCount: number;
  dealCount: number;
  quoteCount: number;
  requestCount: number;
  noteCount: number;
  attachmentCount: number;
  activityCount: number;
  emailCount: number;
  feedItemCount: number;
  notificationCount: number;
  leadCount: number;
  totalCount: number;
}

export interface MergeRequest {
  survivorId: string;
  loserId: string;
  fieldSelections: Record<string, any>;
}

export interface MergeResult {
  survivorId: string;
  transferCounts: Record<string, number>;
  mergedAt: string;
}

export interface DuplicateSettings {
  id: string;
  entityType: string;
  autoDetectionEnabled: boolean;
  similarityThreshold: number;
  matchingFields: string[];
  updatedAt: string;
}

export interface ContactComparisonRecord {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  mobilePhone: string | null;
  jobTitle: string | null;
  department: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postalCode: string | null;
  description: string | null;
  companyId: string | null;
  companyName: string | null;
  ownerId: string | null;
  ownerName: string | null;
  customFields: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface ContactComparison {
  contactA: ContactComparisonRecord;
  contactB: ContactComparisonRecord;
}

export interface CompanyComparisonRecord {
  id: string;
  name: string;
  industry: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postalCode: string | null;
  size: string | null;
  description: string | null;
  ownerId: string | null;
  ownerName: string | null;
  customFields: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyComparison {
  companyA: CompanyComparisonRecord;
  companyB: CompanyComparisonRecord;
}

/** Field row for comparison table */
export interface ComparisonFieldRow {
  fieldName: string;
  label: string;
  valueA: any;
  valueB: any;
  isDifferent: boolean;
  isCustomField: boolean;
}

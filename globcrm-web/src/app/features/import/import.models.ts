/**
 * TypeScript interfaces for CSV import wizard.
 * Matches backend ImportJob, ImportJobError entities and ImportsController DTOs.
 */

export type ImportEntityType = 'Contact' | 'Company' | 'Deal';
export type ImportStatus = 'Pending' | 'Mapping' | 'Previewing' | 'Processing' | 'Completed' | 'Failed';
export type DuplicateStrategy = 'skip' | 'overwrite' | 'merge';

export interface ImportFieldMapping {
  csvColumn: string;
  entityField: string;
  isCustomField: boolean;
}

export interface ImportJob {
  id: string;
  entityType: ImportEntityType;
  status: ImportStatus;
  originalFileName: string;
  totalRows: number;
  processedRows: number;
  successCount: number;
  errorCount: number;
  duplicateCount: number;
  mappings: ImportFieldMapping[];
  duplicateStrategy: DuplicateStrategy;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  errors: ImportJobError[];
}

export interface ImportJobError {
  id: string;
  rowNumber: number;
  fieldName: string;
  errorMessage: string;
  rawValue?: string;
}

export interface UploadResponse {
  importJobId: string;
  headers: string[];
  sampleRows: Record<string, string>[];
  totalRows: number;
}

export interface PreviewResponse {
  validCount: number;
  invalidCount: number;
  duplicateCount: number;
  errors: PreviewError[];
  duplicates: DuplicateMatch[];
}

export interface PreviewError {
  rowNumber: number;
  fieldName: string;
  errorMessage: string;
  rawValue?: string;
}

export interface DuplicateMatch {
  rowIndex: number;
  existingEntityId: string;
  matchField: string;
  matchValue: string;
}

export interface ImportProgress {
  importJobId: string;
  processedRows: number;
  totalRows: number;
  successCount: number;
  errorCount: number;
  status: ImportStatus;
}

// Entity field definitions for mapping UI
export interface EntityFieldDef {
  key: string;
  label: string;
  required: boolean;
  type: string;
}

export const COMPANY_CORE_FIELDS: EntityFieldDef[] = [
  { key: 'name', label: 'Company Name', required: true, type: 'text' },
  { key: 'industry', label: 'Industry', required: false, type: 'text' },
  { key: 'website', label: 'Website', required: false, type: 'text' },
  { key: 'phone', label: 'Phone', required: false, type: 'text' },
  { key: 'email', label: 'Email', required: false, type: 'text' },
  { key: 'address', label: 'Address', required: false, type: 'text' },
  { key: 'city', label: 'City', required: false, type: 'text' },
  { key: 'state', label: 'State', required: false, type: 'text' },
  { key: 'country', label: 'Country', required: false, type: 'text' },
  { key: 'postalCode', label: 'Postal Code', required: false, type: 'text' },
  { key: 'size', label: 'Company Size', required: false, type: 'text' },
  { key: 'description', label: 'Description', required: false, type: 'text' },
];

export const CONTACT_CORE_FIELDS: EntityFieldDef[] = [
  { key: 'firstName', label: 'First Name', required: true, type: 'text' },
  { key: 'lastName', label: 'Last Name', required: true, type: 'text' },
  { key: 'email', label: 'Email', required: false, type: 'text' },
  { key: 'phone', label: 'Phone', required: false, type: 'text' },
  { key: 'mobilePhone', label: 'Mobile Phone', required: false, type: 'text' },
  { key: 'jobTitle', label: 'Job Title', required: false, type: 'text' },
  { key: 'department', label: 'Department', required: false, type: 'text' },
  { key: 'address', label: 'Address', required: false, type: 'text' },
  { key: 'city', label: 'City', required: false, type: 'text' },
  { key: 'state', label: 'State', required: false, type: 'text' },
  { key: 'country', label: 'Country', required: false, type: 'text' },
  { key: 'postalCode', label: 'Postal Code', required: false, type: 'text' },
  { key: 'companyName', label: 'Company Name (link by name)', required: false, type: 'text' },
  { key: 'description', label: 'Description', required: false, type: 'text' },
];

export const DEAL_CORE_FIELDS: EntityFieldDef[] = [
  { key: 'title', label: 'Deal Title', required: true, type: 'text' },
  { key: 'value', label: 'Value', required: false, type: 'number' },
  { key: 'probability', label: 'Probability', required: false, type: 'number' },
  { key: 'expectedCloseDate', label: 'Expected Close Date', required: false, type: 'date' },
  { key: 'pipelineName', label: 'Pipeline (name lookup)', required: false, type: 'text' },
  { key: 'stageName', label: 'Stage (name lookup)', required: false, type: 'text' },
  { key: 'companyName', label: 'Company (name lookup)', required: false, type: 'text' },
  { key: 'description', label: 'Description', required: false, type: 'text' },
];

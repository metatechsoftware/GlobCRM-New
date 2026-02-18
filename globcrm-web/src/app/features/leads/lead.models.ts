/**
 * Lead entity models matching backend DTOs.
 * Used by LeadService, LeadStore, and lead components.
 */

// ─── Enums ─────────────────────────────────────────────────────────────────

export type LeadTemperature = 'hot' | 'warm' | 'cold';

// ─── Lead List/Detail Models ───────────────────────────────────────────────

export interface LeadListDto {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  companyName: string | null;
  stageName: string;
  stageColor: string;
  sourceName: string | null;
  temperature: LeadTemperature;
  ownerName: string | null;
  isConverted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LeadDetailDto extends LeadListDto {
  mobilePhone: string | null;
  jobTitle: string | null;
  description: string | null;
  customFields: Record<string, any>;
  ownerId: string | null;
  leadStageId: string;
  leadSourceId: string | null;
  convertedAt: string | null;
  convertedByUserName: string | null;
  convertedContactId: string | null;
  convertedCompanyId: string | null;
  convertedDealId: string | null;
  conversionDetails: LeadConversionDetailDto | null;
}

export interface LeadConversionDetailDto {
  contactId: string;
  contactName: string | null;
  companyId: string | null;
  companyName: string | null;
  dealId: string | null;
  dealTitle: string | null;
  convertedByUserName: string | null;
  convertedAt: string;
  notes: string | null;
}

// ─── Lead Stage & Source Models ────────────────────────────────────────────

export interface LeadStageDto {
  id: string;
  name: string;
  sortOrder: number;
  color: string;
  isConverted: boolean;
  isLost: boolean;
  leadCount?: number;
}

export interface LeadSourceDto {
  id: string;
  name: string;
  sortOrder: number;
  isDefault: boolean;
  leadCount?: number;
}

// ─── Kanban Models ─────────────────────────────────────────────────────────

export interface LeadKanbanCardDto {
  id: string;
  fullName: string;
  companyName: string | null;
  email: string | null;
  sourceName: string | null;
  temperature: LeadTemperature;
  ownerName: string | null;
  ownerInitials: string | null;
  leadStageId: string;
  daysInStage: number;
  createdAt: string;
}

export interface LeadKanbanDto {
  stages: LeadKanbanStageDto[];
  leads: LeadKanbanCardDto[];
}

export interface LeadKanbanStageDto {
  id: string;
  name: string;
  sortOrder: number;
  color: string;
  isConverted: boolean;
  isLost: boolean;
}

// ─── Timeline Models ───────────────────────────────────────────────────────

export interface LeadTimelineEventDto {
  type: string;
  description: string;
  timestamp: string;
  userId: string | null;
  userName: string | null;
}

// ─── Request Models ────────────────────────────────────────────────────────

export interface CreateLeadRequest {
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  mobilePhone?: string | null;
  jobTitle?: string | null;
  companyName?: string | null;
  leadStageId: string;
  leadSourceId?: string | null;
  temperature?: LeadTemperature;
  ownerId?: string | null;
  description?: string | null;
  customFields?: Record<string, any>;
}

export interface UpdateLeadRequest {
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  mobilePhone?: string | null;
  jobTitle?: string | null;
  companyName?: string | null;
  leadStageId: string;
  leadSourceId?: string | null;
  temperature?: LeadTemperature;
  ownerId?: string | null;
  description?: string | null;
  customFields?: Record<string, any>;
}

export interface UpdateLeadStageRequest {
  stageId: string;
}

export interface ReopenLeadRequest {
  stageId: string;
}

export interface ConvertLeadRequest {
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  mobilePhone?: string | null;
  jobTitle?: string | null;
  existingCompanyId?: string | null;
  createCompany: boolean;
  newCompanyName?: string | null;
  newCompanyWebsite?: string | null;
  newCompanyPhone?: string | null;
  createDeal: boolean;
  dealTitle?: string | null;
  dealValue?: number | null;
  dealPipelineId?: string | null;
}

export interface ConvertLeadResult {
  contactId: string;
  companyId: string | null;
  dealId: string | null;
}

// ─── Duplicate Check Models ────────────────────────────────────────────────

export interface DuplicateCheckResult {
  contactMatches: ContactMatchDto[];
  companyMatches: CompanyMatchDto[];
}

export interface ContactMatchDto {
  id: string;
  fullName: string;
  email: string | null;
  companyName: string | null;
}

export interface CompanyMatchDto {
  id: string;
  name: string;
  phone: string | null;
  website: string | null;
}

// ─── Admin Request Models ──────────────────────────────────────────────────

export interface CreateLeadStageRequest {
  name: string;
  sortOrder: number;
  color?: string | null;
  isConverted: boolean;
  isLost: boolean;
}

export interface UpdateLeadStageAdminRequest {
  name: string;
  sortOrder: number;
  color?: string | null;
  isConverted: boolean;
  isLost: boolean;
}

export interface ReorderLeadStagesRequest {
  stageIds: string[];
}

export interface CreateLeadSourceRequest {
  name: string;
  sortOrder: number;
  isDefault: boolean;
}

export interface UpdateLeadSourceRequest {
  name: string;
  sortOrder: number;
  isDefault: boolean;
}

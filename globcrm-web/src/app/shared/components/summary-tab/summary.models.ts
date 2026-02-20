/**
 * Frontend TypeScript interfaces matching backend summary DTOs.
 *
 * The backend uses entity-prefixed DTO names (CompanySummaryActivityDto,
 * ContactSummaryActivityDto, etc.) to avoid namespace collisions in C# since
 * DTOs are co-located per controller file. The frontend uses shared interfaces
 * (SummaryActivityDto, SummaryNoteDto, etc.) since all entity-specific variants
 * have identical shapes.
 */

// --- Shared sub-DTOs (identical shape across all entity types) ---

export interface SummaryActivityDto {
  id: string;
  subject: string;
  type: string;
  status: string;
  dueDate: string | null;
  createdAt: string;
}

export interface SummaryNoteDto {
  id: string;
  title: string;
  preview: string | null;
  authorName: string | null;
  createdAt: string;
}

export interface SummaryAssociationDto {
  entityType: string;
  label: string;
  icon: string;
  count: number;
}

// --- Deal pipeline sub-DTOs ---

export interface DealStageSummaryDto {
  stageName: string;
  color: string;
  count: number;
  value: number;
}

export interface DealPipelineSummaryDto {
  totalValue: number;
  totalDeals: number;
  winRate: number;
  dealsByStage: DealStageSummaryDto[];
}

// --- Email engagement sub-DTO (Contact only) ---

export interface EmailEngagementDto {
  totalEmails: number;
  sentCount: number;
  receivedCount: number;
  lastSentAt: string | null;
  lastReceivedAt: string | null;
  isEnrolledInSequence: boolean;
  sequenceName: string | null;
}

// --- Stage info DTOs (Deal and Lead pipeline steppers) ---

export interface DealStageInfoDto {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  isCurrent: boolean;
}

export interface LeadStageInfoDto {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  isCurrent: boolean;
  isTerminal: boolean;
}

// --- Base summary fields (shared across all 6 entity types) ---

export interface BaseSummaryFields {
  recentActivities: SummaryActivityDto[];
  upcomingActivities: SummaryActivityDto[];
  recentNotes: SummaryNoteDto[];
  associations: SummaryAssociationDto[];
  attachmentCount: number;
  lastContacted: string | null;
}

// --- Entity-specific summary DTOs ---

export interface CompanySummaryDto extends BaseSummaryFields {
  id: string;
  name: string;
  industry: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  ownerName: string | null;
  location: string | null;
  size: string | null;
  dealPipeline: DealPipelineSummaryDto | null;
}

export interface ContactSummaryDto extends BaseSummaryFields {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  jobTitle: string | null;
  companyName: string | null;
  ownerName: string | null;
  department: string | null;
  dealPipeline: DealPipelineSummaryDto | null;
  emailEngagement: EmailEngagementDto | null;
}

export interface DealSummaryDto extends BaseSummaryFields {
  id: string;
  title: string;
  value: number | null;
  probability: number | null;
  expectedCloseDate: string | null;
  pipelineName: string;
  stageName: string;
  companyName: string | null;
  ownerName: string | null;
  stages: DealStageInfoDto[];
}

export interface LeadSummaryDto extends BaseSummaryFields {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  companyName: string | null;
  sourceName: string | null;
  temperature: string;
  ownerName: string | null;
  stages: LeadStageInfoDto[];
}

export interface QuoteSummaryDto extends BaseSummaryFields {
  id: string;
  quoteNumber: string;
  title: string;
  status: string;
  grandTotal: number;
  contactName: string | null;
  companyName: string | null;
  issueDate: string;
  expiryDate: string | null;
}

export interface RequestSummaryDto extends BaseSummaryFields {
  id: string;
  subject: string;
  status: string;
  priority: string;
  category: string | null;
  contactName: string | null;
  companyName: string | null;
  ownerName: string | null;
  assignedToName: string | null;
}

// --- Discriminated union type for all summary data ---

export type EntitySummaryData =
  | CompanySummaryDto
  | ContactSummaryDto
  | DealSummaryDto
  | LeadSummaryDto
  | QuoteSummaryDto
  | RequestSummaryDto;

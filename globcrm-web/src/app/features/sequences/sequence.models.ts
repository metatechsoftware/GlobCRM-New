/**
 * Email sequence models matching backend DTOs from SequencesController.
 * Used by SequenceService, SequenceStore, and all sequence components.
 */

// ---- Enums ----

export type SequenceStatus = 'draft' | 'active' | 'paused' | 'archived';

export type EnrollmentStatus =
  | 'active'
  | 'paused'
  | 'completed'
  | 'replied'
  | 'bounced'
  | 'unenrolled';

// ---- List / Detail Models ----

export interface SequenceListItem {
  id: string;
  name: string;
  description: string | null;
  status: SequenceStatus;
  stepCount: number;
  totalEnrolled: number;
  activeEnrollments: number;
  completedEnrollments: number;
  replyRate: number;
  createdByUserName: string | null;
  createdAt: string;
}

export interface SequenceDetail {
  id: string;
  name: string;
  description: string | null;
  status: SequenceStatus;
  steps: SequenceStep[];
  createdByUserId: string;
  createdByUserName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SequenceStep {
  id: string;
  stepNumber: number;
  emailTemplateId: string;
  emailTemplateName: string | null;
  subjectOverride: string | null;
  delayDays: number;
  preferredSendTime: string | null;
  createdAt: string;
}

// ---- Enrollment Models ----

export interface EnrollmentListItem {
  id: string;
  contactId: string;
  contactName: string | null;
  contactEmail: string | null;
  status: EnrollmentStatus;
  currentStepNumber: number;
  stepsSent: number;
  startFromStep: number;
  lastStepSentAt: string | null;
  completedAt: string | null;
  repliedAt: string | null;
  replyStepNumber: number | null;
  pausedAt: string | null;
  bouncedAt: string | null;
  createdAt: string;
}

export interface PagedEnrollments {
  items: EnrollmentListItem[];
  totalCount: number;
  page: number;
  pageSize: number;
}

// ---- Analytics Models ----

export interface SequenceAnalytics {
  totalEnrolled: number;
  active: number;
  completed: number;
  replied: number;
  bounced: number;
  unenrolled: number;
  paused: number;
}

export interface StepMetrics {
  stepNumber: number;
  templateName: string;
  sent: number;
  uniqueOpens: number;
  uniqueClicks: number;
  openRate: number;
  clickRate: number;
}

export interface FunnelData {
  stepNumber: number;
  stepName: string;
  count: number;
}

// ---- Bulk Enrollment Result ----

export interface BulkEnrollResult {
  enrolled: number;
  skipped: number;
  skippedContactIds: string[];
}

// ---- Request Types ----

export interface CreateSequenceRequest {
  name: string;
  description?: string | null;
}

export interface UpdateSequenceRequest {
  name?: string | null;
  description?: string | null;
  status?: SequenceStatus | null;
}

export interface AddStepRequest {
  emailTemplateId: string;
  subjectOverride?: string | null;
  delayDays: number;
  preferredSendTime?: string | null;
}

export interface UpdateStepRequest {
  emailTemplateId?: string | null;
  subjectOverride?: string | null;
  delayDays?: number | null;
  preferredSendTime?: string | null;
}

export interface EnrollContactRequest {
  contactId: string;
  startFromStep?: number | null;
}

export interface BulkEnrollRequest {
  contactIds: string[];
}

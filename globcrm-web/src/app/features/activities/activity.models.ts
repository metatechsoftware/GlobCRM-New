/**
 * Activity entity models matching backend DTOs.
 * Used by ActivityService and ActivityStore.
 */

// ─── Enums (string literal unions) ──────────────────────────────────────────

export type ActivityType = 'Task' | 'Call' | 'Meeting';
export type ActivityStatus = 'Assigned' | 'Accepted' | 'InProgress' | 'Review' | 'Done';
export type ActivityPriority = 'Low' | 'Medium' | 'High' | 'Urgent';

// ─── Workflow Constants ─────────────────────────────────────────────────────

export const ACTIVITY_STATUSES: { value: ActivityStatus; label: string; color: string }[] = [
  { value: 'Assigned', label: 'Assigned', color: 'var(--color-info)' },
  { value: 'Accepted', label: 'Accepted', color: 'var(--color-primary)' },
  { value: 'InProgress', label: 'In Progress', color: 'var(--color-secondary)' },
  { value: 'Review', label: 'Review', color: 'var(--color-accent)' },
  { value: 'Done', label: 'Done', color: 'var(--color-success)' },
];

export const ACTIVITY_TYPES: { value: ActivityType; label: string; icon: string }[] = [
  { value: 'Task', label: 'Task', icon: 'task_alt' },
  { value: 'Call', label: 'Call', icon: 'phone' },
  { value: 'Meeting', label: 'Meeting', icon: 'groups' },
];

export const ACTIVITY_PRIORITIES: { value: ActivityPriority; label: string; color: string }[] = [
  { value: 'Low', label: 'Low', color: 'var(--color-success)' },
  { value: 'Medium', label: 'Medium', color: 'var(--color-info)' },
  { value: 'High', label: 'High', color: 'var(--color-warning)' },
  { value: 'Urgent', label: 'Urgent', color: 'var(--color-danger)' },
];

export const ALLOWED_TRANSITIONS: Record<ActivityStatus, ActivityStatus[]> = {
  Assigned: ['Accepted', 'InProgress', 'Done'],
  Accepted: ['InProgress', 'Done'],
  InProgress: ['Review', 'Done', 'Assigned'],
  Review: ['Done', 'InProgress'],
  Done: ['InProgress'],
};

// ─── List DTO (lightweight for table/Kanban/calendar) ───────────────────────

export interface ActivityListDto {
  id: string;
  subject: string;
  type: ActivityType;
  status: ActivityStatus;
  priority: ActivityPriority;
  dueDate: string | null;
  ownerName: string | null;
  assignedToName: string | null;
  customFields: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

// ─── Detail DTO (full load for detail page) ─────────────────────────────────

export interface ActivityDetailDto extends ActivityListDto {
  description: string | null;
  completedAt: string | null;
  ownerId: string | null;
  assignedToId: string | null;
  comments: ActivityCommentDto[];
  attachments: ActivityAttachmentDto[];
  timeEntries: ActivityTimeEntryDto[];
  followers: ActivityFollowerDto[];
  links: ActivityLinkDto[];
  totalTimeMinutes: number;
}

// ─── Sub-entity DTOs ────────────────────────────────────────────────────────

export interface ActivityCommentDto {
  id: string;
  content: string;
  authorName: string;
  authorId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityAttachmentDto {
  id: string;
  fileName: string;
  contentType: string;
  fileSizeBytes: number;
  uploadedByName: string;
  uploadedAt: string;
}

export interface ActivityTimeEntryDto {
  id: string;
  durationMinutes: number;
  description: string | null;
  entryDate: string;
  userName: string;
  createdAt: string;
}

export interface ActivityFollowerDto {
  userId: string;
  userName: string;
  followedAt: string;
}

export interface ActivityLinkDto {
  id: string;
  entityType: string;
  entityId: string;
  entityName: string | null;
  linkedAt: string;
}

// ─── Kanban DTOs ────────────────────────────────────────────────────────────

export interface ActivityKanbanDto {
  columns: ActivityKanbanColumnDto[];
}

export interface ActivityKanbanColumnDto {
  status: ActivityStatus;
  label: string;
  color: string;
  activities: ActivityKanbanCardDto[];
}

export interface ActivityKanbanCardDto {
  id: string;
  subject: string;
  type: ActivityType;
  priority: ActivityPriority;
  dueDate: string | null;
  assignedToName: string | null;
  ownerName: string | null;
}

// ─── Request DTOs ───────────────────────────────────────────────────────────

export interface CreateActivityRequest {
  subject: string;
  description?: string | null;
  type: ActivityType;
  priority: ActivityPriority;
  dueDate?: string | null;
  assignedToId?: string | null;
  customFields?: Record<string, any>;
}

export interface UpdateActivityRequest {
  subject: string;
  description?: string | null;
  type: ActivityType;
  priority: ActivityPriority;
  dueDate?: string | null;
  assignedToId?: string | null;
  customFields?: Record<string, any>;
}

export interface UpdateActivityStatusRequest {
  status: string;
}

export interface CreateCommentRequest {
  content: string;
}

export interface CreateTimeEntryRequest {
  durationMinutes: number;
  description?: string | null;
  entryDate: string;
}

export interface CreateLinkRequest {
  entityType: string;
  entityId: string;
  entityName?: string | null;
}

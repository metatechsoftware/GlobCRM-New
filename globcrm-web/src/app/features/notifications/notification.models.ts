/**
 * Notification type enum matching backend GlobCRM.Domain.Enums.NotificationType.
 */
export enum NotificationType {
  ActivityAssigned = 'ActivityAssigned',
  DealStageChanged = 'DealStageChanged',
  Mention = 'Mention',
  DueDateApproaching = 'DueDateApproaching',
  EmailReceived = 'EmailReceived',
}

/**
 * DTO for notification list items.
 * Matches backend NotificationDto from NotificationsController.
 */
export interface NotificationDto {
  id: string;
  type: string;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  isRead: boolean;
  createdAt: string;
  createdByName?: string;
}

/**
 * DTO for notification preferences per type.
 * Matches backend NotificationPreferenceDto.
 */
export interface NotificationPreferenceDto {
  notificationType: string;
  inAppEnabled: boolean;
  emailEnabled: boolean;
}

/**
 * Paged response for notifications list.
 * Matches backend NotificationPagedResponse.
 */
export interface NotificationPagedResponse {
  items: NotificationDto[];
  totalCount: number;
  page: number;
  pageSize: number;
}

/**
 * Response for unread notification count.
 * Matches backend UnreadCountResponse.
 */
export interface UnreadCountResponse {
  count: number;
}

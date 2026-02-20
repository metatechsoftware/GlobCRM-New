/**
 * TypeScript interfaces matching the backend MyDayDto response shape.
 * Used by MyDayService and MyDayStore for the My Day personal dashboard.
 */

export interface MyDayDto {
  tasksTodayCount: number;
  overdueCount: number;
  upcomingMeetingsCount: number;
  tasks: MyDayTaskDto[];
  upcomingEvents: MyDayEventDto[];
  pipelineStages: MyDayPipelineStageDto[];
  pipelineTotalValue: number;
  pipelineDealCount: number;
  unreadEmailCount: number;
  recentEmails: MyDayEmailDto[];
  recentFeedItems: MyDayFeedItemDto[];
  notificationGroups: MyDayNotificationGroupDto[];
  todayNotificationCount: number;
  recentRecords: MyDayRecentRecordDto[];
}

export interface MyDayTaskDto {
  id: string;
  subject: string;
  type: string;
  status: string;
  priority: string;
  dueDate: string;
  isOverdue: boolean;
  daysOverdue: number;
  linkedEntityType?: string;
  linkedEntityId?: string;
  linkedEntityName?: string;
}

export interface MyDayEventDto {
  id: string;
  subject: string;
  type: string;
  dueDate: string;
  assignedToName?: string;
}

export interface MyDayPipelineStageDto {
  stageName: string;
  color: string;
  dealCount: number;
  totalValue: number;
}

export interface MyDayEmailDto {
  id: string;
  subject: string;
  fromName: string;
  sentAt: string;
  isInbound: boolean;
  isRead: boolean;
}

export interface MyDayFeedItemDto {
  id: string;
  type: string;
  content: string;
  entityType?: string;
  entityId?: string;
  entityName?: string;
  authorName: string;
  createdAt: string;
}

export interface MyDayNotificationGroupDto {
  type: string;
  count: number;
  items: MyDayNotificationDto[];
}

export interface MyDayNotificationDto {
  id: string;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  isRead: boolean;
  createdAt: string;
}

export interface MyDayRecentRecordDto {
  entityType: string;
  entityId: string;
  entityName: string;
  viewedAt: string;
}

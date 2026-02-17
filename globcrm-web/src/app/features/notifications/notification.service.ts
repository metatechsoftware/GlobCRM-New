import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/api/api.service';
import {
  NotificationPreferenceDto,
  NotificationPagedResponse,
  UnreadCountResponse,
} from './notification.models';

/**
 * HTTP service for notification API endpoints.
 * Matches backend NotificationsController routes at /api/notifications.
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly api = inject(ApiService);

  /** Gets a paged list of notifications for the current user. */
  getNotifications(page: number = 1, pageSize: number = 20): Observable<NotificationPagedResponse> {
    return this.api.get<NotificationPagedResponse>(
      `/api/notifications?page=${page}&pageSize=${pageSize}`
    );
  }

  /** Gets the count of unread notifications. */
  getUnreadCount(): Observable<UnreadCountResponse> {
    return this.api.get<UnreadCountResponse>('/api/notifications/unread-count');
  }

  /** Marks a single notification as read. */
  markAsRead(id: string): Observable<void> {
    return this.api.patch<void>(`/api/notifications/${id}/read`);
  }

  /** Marks a single notification as unread. */
  markAsUnread(id: string): Observable<void> {
    return this.api.patch<void>(`/api/notifications/${id}/unread`);
  }

  /** Marks all unread notifications as read. */
  markAllAsRead(): Observable<void> {
    return this.api.post<void>('/api/notifications/mark-all-read');
  }

  /** Gets notification preferences for the current user. */
  getPreferences(): Observable<NotificationPreferenceDto[]> {
    return this.api.get<NotificationPreferenceDto[]>('/api/notifications/preferences');
  }

  /** Updates notification preferences. */
  updatePreferences(prefs: NotificationPreferenceDto[]): Observable<void> {
    return this.api.put<void>('/api/notifications/preferences', prefs);
  }
}

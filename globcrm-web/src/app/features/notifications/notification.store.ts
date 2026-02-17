import { inject } from '@angular/core';
import { computed } from '@angular/core';
import {
  signalStore,
  withState,
  withComputed,
  withMethods,
  patchState,
} from '@ngrx/signals';
import { NotificationDto } from './notification.models';
import { NotificationService } from './notification.service';
import { SignalRService } from '../../core/signalr/signalr.service';

interface NotificationState {
  notifications: NotificationDto[];
  unreadCount: number;
  isLoading: boolean;
  isOpen: boolean;
}

const initialState: NotificationState = {
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  isOpen: false,
};

/**
 * Root-provided notification state management store.
 * CRITICAL: providedIn 'root' ensures the store persists across navigation.
 * Manages notification list, unread count, panel open state, and real-time push.
 * Subscribes to SignalRService.notification$ for live notification delivery.
 */
export const NotificationStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    hasUnread: computed(() => store.unreadCount() > 0),
  })),
  withMethods((store) => {
    const notificationService = inject(NotificationService);
    const signalRService = inject(SignalRService);

    // Subscribe to real-time notifications
    signalRService.notification$.subscribe((dto) => {
      patchState(store, {
        notifications: [dto, ...store.notifications()],
        unreadCount: store.unreadCount() + 1,
      });
    });

    return {
      /** Loads the first page of notifications. */
      loadNotifications(): void {
        patchState(store, { isLoading: true });
        notificationService.getNotifications(1, 20).subscribe({
          next: (result) => {
            patchState(store, {
              notifications: result.items,
              isLoading: false,
            });
          },
          error: () => {
            patchState(store, { isLoading: false });
          },
        });
      },

      /** Loads the current unread count from the API. */
      loadUnreadCount(): void {
        notificationService.getUnreadCount().subscribe({
          next: (result) => {
            patchState(store, { unreadCount: result.count });
          },
          error: () => {
            // Silent fail for count
          },
        });
      },

      /** Marks a notification as read and updates local state. */
      markAsRead(id: string): void {
        notificationService.markAsRead(id).subscribe({
          next: () => {
            const notifications = store.notifications().map((n) =>
              n.id === id ? { ...n, isRead: true } : n
            );
            const wasUnread = store.notifications().find((n) => n.id === id && !n.isRead);
            patchState(store, {
              notifications,
              unreadCount: wasUnread
                ? Math.max(0, store.unreadCount() - 1)
                : store.unreadCount(),
            });
          },
        });
      },

      /** Marks a notification as unread and updates local state. */
      markAsUnread(id: string): void {
        notificationService.markAsUnread(id).subscribe({
          next: () => {
            const notifications = store.notifications().map((n) =>
              n.id === id ? { ...n, isRead: false } : n
            );
            const wasRead = store.notifications().find((n) => n.id === id && n.isRead);
            patchState(store, {
              notifications,
              unreadCount: wasRead
                ? store.unreadCount() + 1
                : store.unreadCount(),
            });
          },
        });
      },

      /** Marks all notifications as read. */
      markAllAsRead(): void {
        notificationService.markAllAsRead().subscribe({
          next: () => {
            const notifications = store.notifications().map((n) => ({
              ...n,
              isRead: true,
            }));
            patchState(store, { notifications, unreadCount: 0 });
          },
        });
      },

      /** Adds a notification from real-time push (called by subscription). */
      addNotification(dto: NotificationDto): void {
        patchState(store, {
          notifications: [dto, ...store.notifications()],
          unreadCount: store.unreadCount() + 1,
        });
      },

      /** Toggles the notification panel open/closed. */
      togglePanel(): void {
        const wasOpen = store.isOpen();
        patchState(store, { isOpen: !wasOpen });
        // Load notifications when opening
        if (!wasOpen) {
          this.loadNotifications();
        }
      },

      /** Closes the panel. */
      closePanel(): void {
        patchState(store, { isOpen: false });
      },
    };
  })
);

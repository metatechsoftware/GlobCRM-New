import { Component, inject, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatBadgeModule } from '@angular/material/badge';
import { NotificationStore } from '../notification.store';
import { NotificationDto } from '../notification.models';

/**
 * Bell icon with unread badge and dropdown notification panel.
 * Integrated into the navbar. Inline template/styles for single-file simplicity.
 * Uses relative time display and entity navigation on click.
 */
@Component({
  selector: 'app-notification-center',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, MatBadgeModule],
  template: `
    <div class="notification-center">
      <button
        mat-icon-button
        class="notification-center__bell"
        (click)="store.togglePanel()"
        aria-label="Notifications"
      >
        <mat-icon
          [matBadge]="store.unreadCount()"
          [matBadgeHidden]="!store.hasUnread()"
          matBadgeColor="warn"
          matBadgeSize="small"
        >notifications</mat-icon>
      </button>

      @if (store.isOpen()) {
        <div class="notification-center__panel">
          <div class="notification-center__header">
            <span class="notification-center__title">Notifications</span>
            @if (store.hasUnread()) {
              <button
                class="notification-center__mark-all"
                (click)="onMarkAllAsRead()"
              >Mark all as read</button>
            }
          </div>

          <div class="notification-center__list">
            @if (store.isLoading()) {
              <div class="notification-center__loading">Loading...</div>
            } @else if (store.notifications().length === 0) {
              <div class="notification-center__empty">
                <mat-icon class="notification-center__empty-icon">notifications_none</mat-icon>
                <span>No notifications yet</span>
              </div>
            } @else {
              @for (notification of store.notifications(); track notification.id) {
                <div
                  class="notification-center__item"
                  [class.notification-center__item--unread]="!notification.isRead"
                  (click)="onNotificationClick(notification)"
                >
                  <mat-icon class="notification-center__item-icon">{{ getIcon(notification.type) }}</mat-icon>
                  <div class="notification-center__item-content">
                    <div class="notification-center__item-title">{{ notification.title }}</div>
                    <div class="notification-center__item-message">{{ truncateMessage(notification.message) }}</div>
                    <div class="notification-center__item-time">{{ getRelativeTime(notification.createdAt) }}</div>
                  </div>
                  @if (notification.isRead) {
                    <button
                      mat-icon-button
                      class="notification-center__unread-btn"
                      (click)="onMarkAsUnread($event, notification)"
                      title="Mark as unread"
                      aria-label="Mark as unread"
                    >
                      <mat-icon>markunread</mat-icon>
                    </button>
                  }
                </div>
              }
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .notification-center {
      position: relative;
    }

    .notification-center__bell {
      color: var(--color-text-secondary);
    }

    .notification-center__panel {
      position: absolute;
      top: 100%;
      right: 0;
      width: 360px;
      max-height: 400px;
      background: var(--color-surface);
      border: 1px solid var(--color-border-subtle);
      border-radius: var(--radius-lg);
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12);
      z-index: 1000;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .notification-center__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--space-3) var(--space-4);
      border-bottom: 1px solid var(--color-border-subtle);
      flex-shrink: 0;
    }

    .notification-center__title {
      font-size: var(--text-md);
      font-weight: var(--font-semibold);
      color: var(--color-text);
    }

    .notification-center__mark-all {
      background: none;
      border: none;
      cursor: pointer;
      font-size: var(--text-xs);
      font-weight: var(--font-medium);
      color: var(--color-primary);
      padding: var(--space-1) var(--space-2);
      border-radius: var(--radius-sm);
      transition: background-color var(--duration-fast) var(--ease-default);

      &:hover {
        background: var(--color-primary-soft);
      }
    }

    .notification-center__list {
      overflow-y: auto;
      flex: 1;
    }

    .notification-center__loading,
    .notification-center__empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--space-2);
      padding: var(--space-8) var(--space-4);
      color: var(--color-text-muted);
      font-size: var(--text-sm);
    }

    .notification-center__empty-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
      color: var(--color-text-muted);
    }

    .notification-center__item {
      display: flex;
      gap: var(--space-3);
      padding: var(--space-3) var(--space-4);
      cursor: pointer;
      transition: background-color var(--duration-fast) var(--ease-default);

      &:hover {
        background: var(--color-highlight);
      }

      &--unread {
        background: var(--color-primary-soft);

        &:hover {
          background: var(--color-primary-soft-hover);
        }
      }
    }

    .notification-center__item-icon {
      flex-shrink: 0;
      font-size: 20px;
      width: 20px;
      height: 20px;
      color: var(--color-primary);
      margin-top: 2px;
    }

    .notification-center__item-content {
      flex: 1;
      min-width: 0;
    }

    .notification-center__item-title {
      font-size: var(--text-sm);
      font-weight: var(--font-medium);
      color: var(--color-text);
      line-height: 1.3;
    }

    .notification-center__item-message {
      font-size: var(--text-xs);
      color: var(--color-text-secondary);
      line-height: 1.4;
      margin-top: 2px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .notification-center__item-time {
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      margin-top: var(--space-1);
    }

    .notification-center__unread-btn {
      flex-shrink: 0;
      width: 28px;
      height: 28px;
      line-height: 28px;
      align-self: center;
      opacity: 0;
      transition: opacity var(--duration-fast) var(--ease-default);

      mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
        color: var(--color-text-muted);
      }
    }

    .notification-center__item:hover .notification-center__unread-btn {
      opacity: 1;
    }
  `],
})
export class NotificationCenterComponent {
  readonly store = inject(NotificationStore);
  private readonly router = inject(Router);
  private readonly elementRef = inject(ElementRef);

  /** Close panel when clicking outside. */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (
      this.store.isOpen() &&
      !this.elementRef.nativeElement.contains(event.target)
    ) {
      this.store.closePanel();
    }
  }

  /** Gets icon name based on notification type. */
  getIcon(type: string): string {
    switch (type) {
      case 'ActivityAssigned':
        return 'assignment_ind';
      case 'DealStageChanged':
        return 'swap_horiz';
      case 'Mention':
        return 'alternate_email';
      case 'DueDateApproaching':
        return 'schedule';
      case 'EmailReceived':
        return 'email';
      default:
        return 'notifications';
    }
  }

  /** Truncates message to reasonable display length. */
  truncateMessage(message: string): string {
    return message.length > 80 ? message.substring(0, 80) + '...' : message;
  }

  /** Converts ISO date string to relative time (e.g., "5m ago", "2h ago"). */
  getRelativeTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);

    if (diffSec < 60) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
    return date.toLocaleDateString();
  }

  /** Mark all notifications as read. */
  onMarkAllAsRead(): void {
    this.store.markAllAsRead();
  }

  /** Mark a single notification as unread. Stops propagation to prevent navigation. */
  onMarkAsUnread(event: MouseEvent, notification: NotificationDto): void {
    event.stopPropagation();
    this.store.markAsUnread(notification.id);
  }

  /** Handle notification click: mark as read and navigate to entity. */
  onNotificationClick(notification: NotificationDto): void {
    if (!notification.isRead) {
      this.store.markAsRead(notification.id);
    }

    if (notification.entityType && notification.entityId) {
      const route = this.getEntityRoute(notification.entityType, notification.entityId);
      if (route) {
        this.router.navigate(route);
        this.store.closePanel();
      }
    }
  }

  /** Maps entity type + ID to Angular route. */
  private getEntityRoute(entityType: string, entityId: string): string[] | null {
    const typeMap: Record<string, string> = {
      Deal: '/deals',
      Activity: '/activities',
      Contact: '/contacts',
      Company: '/companies',
      Email: '/emails',
      FeedItem: '/feed',
    };

    const basePath = typeMap[entityType];
    if (!basePath) return null;
    return [basePath, entityId];
  }
}

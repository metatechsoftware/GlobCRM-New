import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { PreviewEntityLinkComponent } from '../../../../shared/components/entity-preview/preview-entity-link.component';
import { MyDayNotificationGroupDto } from '../../my-day.models';

@Component({
  selector: 'app-notification-digest-widget',
  standalone: true,
  imports: [MatCardModule, MatIconModule, PreviewEntityLinkComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-card class="notif-widget">
      <mat-card-header>
        <div class="widget-header-icon">
          <mat-icon>notifications</mat-icon>
        </div>
        <mat-card-title>Notifications</mat-card-title>
        @if (!isLoading() && totalCount() > 0) {
          <span class="notif-widget__badge">{{ totalCount() }} today</span>
        }
      </mat-card-header>

      <mat-card-content>
        @if (isLoading()) {
          <div class="notif-widget__loading">
            @for (i of [1, 2, 3]; track i) {
              <div class="notif-widget__shimmer-group"></div>
            }
          </div>
        } @else if (notificationGroups().length === 0) {
          <div class="notif-widget__empty">
            <mat-icon class="notif-widget__empty-icon">notifications_none</mat-icon>
            <span class="notif-widget__empty-text">All caught up!</span>
          </div>
        } @else {
          <div class="notif-widget__groups">
            @for (group of notificationGroups(); track group.type) {
              <div class="notif-widget__group">
                <div class="notif-widget__group-header">
                  <div class="notif-widget__group-icon-wrap">
                    <mat-icon class="notif-widget__group-icon">{{ typeIcon(group.type) }}</mat-icon>
                  </div>
                  <span class="notif-widget__group-label">{{ typeLabel(group.type) }}</span>
                  <span class="notif-widget__group-count">{{ group.count }}</span>
                </div>
                <div class="notif-widget__items">
                  @for (item of group.items.slice(0, 3); track item.id) {
                    <div class="notif-widget__item">
                      <span class="notif-widget__item-title">{{ item.title }}</span>
                      @if (item.entityType && item.entityId) {
                        <app-preview-entity-link
                          [entityType]="item.entityType"
                          [entityId]="item.entityId"
                          [entityName]="item.entityType + ' ' + item.entityId.substring(0, 6)" />
                      }
                      <span class="notif-widget__item-time">{{ relativeTime(item.createdAt) }}</span>
                    </div>
                  }
                  @if (group.items.length > 3) {
                    <span class="notif-widget__more">+{{ group.items.length - 3 }} more</span>
                  }
                </div>
              </div>
            }
          </div>
        }
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    @keyframes shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }

    .notif-widget {
      width: 100%;
      height: fit-content;
      border: none;
      border-radius: var(--radius-xl, 16px);
      box-shadow:
        0 1px 3px rgba(0, 0, 0, 0.04),
        0 6px 20px rgba(0, 0, 0, 0.05);
      transition: box-shadow 250ms ease;

      &:hover {
        box-shadow:
          0 1px 3px rgba(0, 0, 0, 0.04),
          0 8px 28px rgba(0, 0, 0, 0.07);
      }
    }

    mat-card-header {
      display: flex;
      align-items: center;
      gap: var(--space-3, 12px);
      margin-bottom: var(--space-4, 16px);
    }

    .widget-header-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border-radius: var(--radius-md, 8px);
      background: var(--color-primary-soft);

      mat-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
        color: #F97316;
      }
    }

    mat-card-title {
      margin: 0;
      font-size: var(--text-lg, 1.125rem);
      font-weight: var(--font-semibold, 600);
      letter-spacing: -0.01em;
    }

    .notif-widget__badge {
      display: inline-flex;
      align-items: center;
      margin-left: auto;
      padding: 3px 10px;
      border-radius: var(--radius-full, 9999px);
      font-size: var(--text-xs, 0.75rem);
      font-weight: var(--font-semibold, 600);
      background: #F97316;
      color: #fff;
      box-shadow: 0 2px 6px rgba(249, 115, 22, 0.3);
    }

    /* Groups */
    .notif-widget__groups {
      display: flex;
      flex-direction: column;
      gap: var(--space-3, 12px);
    }

    .notif-widget__group {
      border-bottom: 1px solid var(--color-border-subtle);
      padding-bottom: var(--space-3, 12px);

      &:last-child {
        border-bottom: none;
        padding-bottom: 0;
      }
    }

    .notif-widget__group-header {
      display: flex;
      align-items: center;
      gap: var(--space-2, 8px);
      margin-bottom: var(--space-2, 8px);
    }

    .notif-widget__group-icon-wrap {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 26px;
      height: 26px;
      border-radius: var(--radius-sm, 4px);
      background: var(--color-surface-hover);
    }

    .notif-widget__group-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      color: var(--color-text-muted);
    }

    .notif-widget__group-label {
      font-size: var(--text-sm, 0.875rem);
      font-weight: var(--font-semibold, 600);
      color: var(--color-text);
    }

    .notif-widget__group-count {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 20px;
      height: 20px;
      padding: 0 6px;
      border-radius: var(--radius-full, 9999px);
      background: var(--color-surface-hover);
      font-size: var(--text-xs, 0.75rem);
      font-weight: var(--font-semibold, 600);
      color: var(--color-text-secondary);
    }

    .notif-widget__items {
      display: flex;
      flex-direction: column;
      gap: var(--space-1, 4px);
      padding-left: 34px;
    }

    .notif-widget__item {
      display: flex;
      align-items: center;
      gap: var(--space-2, 8px);
      padding: var(--space-1, 4px) 0;
    }

    .notif-widget__item-title {
      flex: 1;
      min-width: 0;
      font-size: var(--text-sm, 0.875rem);
      color: var(--color-text);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .notif-widget__item-time {
      flex-shrink: 0;
      font-size: var(--text-xs, 0.75rem);
      color: var(--color-text-muted);
      font-variant-numeric: tabular-nums;
    }

    .notif-widget__more {
      font-size: var(--text-xs, 0.75rem);
      color: #F97316;
      font-weight: var(--font-medium, 500);
      padding: var(--space-1, 4px) 0;
    }

    /* Empty state */
    .notif-widget__empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-3, 12px);
      padding: var(--space-10, 40px) 0;
    }

    .notif-widget__empty-icon {
      font-size: 44px;
      width: 44px;
      height: 44px;
      color: var(--color-success, #22C55E);
      opacity: 0.5;
    }

    .notif-widget__empty-text {
      font-size: var(--text-sm, 0.875rem);
      color: var(--color-text-muted);
    }

    /* Loading state */
    .notif-widget__loading {
      display: flex;
      flex-direction: column;
      gap: var(--space-3, 12px);
    }

    .notif-widget__shimmer-group {
      height: 48px;
      border-radius: var(--radius-md, 8px);
      background: linear-gradient(
        90deg,
        var(--color-border-subtle) 25%,
        var(--color-primary-soft) 37%,
        var(--color-border-subtle) 63%
      );
      background-size: 200% 100%;
      animation: shimmer 1.8s ease-in-out infinite;

      &:nth-child(2) { animation-delay: 120ms; }
      &:nth-child(3) { animation-delay: 240ms; }
    }

    @media (prefers-reduced-motion: reduce) {
      .notif-widget {
        transition: none;
      }
    }
  `],
})
export class NotificationDigestWidgetComponent {
  readonly notificationGroups = input<MyDayNotificationGroupDto[]>([]);
  readonly totalCount = input<number>(0);
  readonly isLoading = input<boolean>(false);
  readonly notificationClicked = output<{ type: string; id: string }>();

  typeIcon(type: string): string {
    const icons: Record<string, string> = {
      assignment: 'assignment',
      mention: 'alternate_email',
      status_change: 'swap_horiz',
      comment: 'comment',
      due_date: 'schedule',
      new_lead: 'trending_up',
      deal_won: 'emoji_events',
      deal_lost: 'thumb_down',
    };
    return icons[type] ?? 'notifications';
  }

  typeLabel(type: string): string {
    const labels: Record<string, string> = {
      assignment: 'Assignments',
      mention: 'Mentions',
      status_change: 'Status Changes',
      comment: 'Comments',
      due_date: 'Due Dates',
      new_lead: 'New Leads',
      deal_won: 'Deals Won',
      deal_lost: 'Deals Lost',
    };
    return labels[type] ?? type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  relativeTime(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
}

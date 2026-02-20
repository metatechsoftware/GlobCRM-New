import { Component, ChangeDetectionStrategy, input, output, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MyDayEmailDto } from '../../my-day.models';

@Component({
  selector: 'app-email-summary-widget',
  standalone: true,
  imports: [MatCardModule, MatIconModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-card class="email-widget">
      <mat-card-header>
        <mat-icon class="email-widget__header-icon">email</mat-icon>
        <mat-card-title>Email</mat-card-title>
        @if (!isLoading()) {
          <span class="email-widget__badge"
                [class.email-widget__badge--active]="unreadCount() > 0">
            {{ unreadCount() }} unread
          </span>
        }
      </mat-card-header>

      <mat-card-content>
        @if (isLoading()) {
          <div class="email-widget__loading">
            @for (i of [1, 2, 3, 4, 5]; track i) {
              <div class="email-widget__shimmer-row"></div>
            }
          </div>
        } @else if (!hasEmails()) {
          <div class="email-widget__empty">
            <mat-icon class="email-widget__empty-icon">mail_outline</mat-icon>
            @if (recentEmails().length === 0 && unreadCount() === 0) {
              <span class="email-widget__empty-text">Connect your email to see messages here</span>
              <a class="email-widget__setup-link" routerLink="/settings">Set up email</a>
            } @else {
              <span class="email-widget__empty-text">No recent emails</span>
            }
          </div>
        } @else {
          <div class="email-widget__list">
            @for (email of recentEmails(); track email.id) {
              <button class="email-widget__row"
                      [class.email-widget__row--unread]="!email.isRead"
                      (click)="emailClicked.emit(email.id)">
                <mat-icon class="email-widget__direction-icon">
                  {{ email.isInbound ? 'call_received' : 'send' }}
                </mat-icon>
                <div class="email-widget__content">
                  <span class="email-widget__subject">{{ truncate(email.subject, 40) }}</span>
                  <span class="email-widget__from">{{ email.fromName }}</span>
                </div>
                <span class="email-widget__time">{{ relativeTime(email.sentAt) }}</span>
              </button>
            }
          </div>
        }
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    .email-widget {
      width: 100%;
      height: fit-content;
    }

    mat-card-header {
      display: flex;
      align-items: center;
      gap: var(--space-2, 8px);
      margin-bottom: var(--space-3, 12px);
    }

    .email-widget__header-icon {
      color: var(--color-primary);
    }

    mat-card-title {
      margin: 0;
      font-size: var(--text-lg, 1.125rem);
      font-weight: var(--font-semibold, 600);
    }

    .email-widget__badge {
      display: inline-flex;
      align-items: center;
      margin-left: auto;
      padding: 2px 10px;
      border-radius: var(--radius-full, 9999px);
      font-size: var(--text-xs, 0.75rem);
      font-weight: var(--font-semibold, 600);
      background: var(--color-surface-hover);
      color: var(--color-text-muted);
    }

    .email-widget__badge--active {
      background: var(--color-primary);
      color: var(--color-primary-fg);
    }

    /* Email list */
    .email-widget__list {
      display: flex;
      flex-direction: column;
    }

    .email-widget__row {
      display: flex;
      align-items: center;
      gap: var(--space-2, 8px);
      padding: var(--space-2, 8px) var(--space-1, 4px);
      border-radius: var(--radius-md, 8px);
      width: 100%;
      background: none;
      border: none;
      cursor: pointer;
      font-family: inherit;
      text-align: left;
      transition: background-color 0.15s ease;

      &:hover {
        background: var(--color-surface-hover);
      }
    }

    .email-widget__row--unread {
      .email-widget__subject {
        font-weight: var(--font-semibold, 600);
        color: var(--color-text);
      }

      .email-widget__from {
        font-weight: var(--font-medium, 500);
      }
    }

    .email-widget__direction-icon {
      flex-shrink: 0;
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: var(--color-text-muted);
    }

    .email-widget__content {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .email-widget__subject {
      font-size: var(--text-sm, 0.875rem);
      color: var(--color-text-secondary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .email-widget__from {
      font-size: var(--text-xs, 0.75rem);
      color: var(--color-text-muted);
    }

    .email-widget__time {
      flex-shrink: 0;
      font-size: var(--text-xs, 0.75rem);
      color: var(--color-text-muted);
    }

    /* Empty state */
    .email-widget__empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-2, 8px);
      padding: var(--space-8, 32px) 0;
    }

    .email-widget__empty-icon {
      font-size: 40px;
      width: 40px;
      height: 40px;
      color: var(--color-text-muted);
      opacity: 0.5;
    }

    .email-widget__empty-text {
      font-size: var(--text-sm, 0.875rem);
      color: var(--color-text-muted);
    }

    .email-widget__setup-link {
      font-size: var(--text-sm, 0.875rem);
      color: var(--color-primary);
      text-decoration: none;
      font-weight: var(--font-medium, 500);

      &:hover {
        text-decoration: underline;
      }
    }

    /* Loading state */
    .email-widget__loading {
      display: flex;
      flex-direction: column;
      gap: var(--space-2, 8px);
    }

    .email-widget__shimmer-row {
      height: 44px;
      border-radius: var(--radius-md, 8px);
      background: linear-gradient(
        90deg,
        var(--color-border-subtle) 25%,
        var(--color-primary-soft) 37%,
        var(--color-border-subtle) 63%
      );
      background-size: 200% 100%;
      animation: shimmer 1.8s ease-in-out infinite;

      &:nth-child(2) { animation-delay: 80ms; }
      &:nth-child(3) { animation-delay: 160ms; }
      &:nth-child(4) { animation-delay: 240ms; }
      &:nth-child(5) { animation-delay: 320ms; }
    }

    @keyframes shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
  `],
})
export class EmailSummaryWidgetComponent {
  readonly unreadCount = input<number>(0);
  readonly recentEmails = input<MyDayEmailDto[]>([]);
  readonly isLoading = input<boolean>(false);
  readonly emailClicked = output<string>();

  readonly hasEmails = computed(() => this.recentEmails().length > 0);

  truncate(text: string, maxLength: number): string {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  }

  relativeTime(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}

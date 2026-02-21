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
        <div class="widget-header-icon">
          <mat-icon>email</mat-icon>
        </div>
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
                <div class="email-widget__direction-dot"
                     [class.email-widget__direction-dot--outbound]="!email.isInbound"></div>
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
    @keyframes shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }

    .email-widget {
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

    .email-widget__badge {
      display: inline-flex;
      align-items: center;
      margin-left: auto;
      padding: 3px 10px;
      border-radius: var(--radius-full, 9999px);
      font-size: var(--text-xs, 0.75rem);
      font-weight: var(--font-semibold, 600);
      background: var(--color-surface-hover);
      color: var(--color-text-muted);
    }

    .email-widget__badge--active {
      background: #F97316;
      color: #fff;
      box-shadow: 0 2px 6px rgba(249, 115, 22, 0.3);
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
      padding: var(--space-2, 8px);
      border-radius: var(--radius-md, 8px);
      width: 100%;
      background: none;
      border: none;
      cursor: pointer;
      font-family: inherit;
      text-align: left;
      transition: background-color 150ms ease;

      &:hover {
        background: rgba(249, 115, 22, 0.04);
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

    .email-widget__direction-dot {
      flex-shrink: 0;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--color-accent, #14B8A6);
    }

    .email-widget__direction-dot--outbound {
      background: #F97316;
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
      font-variant-numeric: tabular-nums;
    }

    /* Empty state */
    .email-widget__empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-3, 12px);
      padding: var(--space-10, 40px) 0;
    }

    .email-widget__empty-icon {
      font-size: 44px;
      width: 44px;
      height: 44px;
      color: var(--color-text-muted);
      opacity: 0.4;
    }

    .email-widget__empty-text {
      font-size: var(--text-sm, 0.875rem);
      color: var(--color-text-muted);
    }

    .email-widget__setup-link {
      font-size: var(--text-sm, 0.875rem);
      color: #F97316;
      text-decoration: none;
      font-weight: var(--font-medium, 500);
      transition: color 150ms ease;

      &:hover {
        color: #EA580C;
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

    @media (prefers-reduced-motion: reduce) {
      .email-widget {
        transition: none;
      }
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

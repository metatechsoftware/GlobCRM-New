import { Component, ChangeDetectionStrategy, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-greeting-banner',
  standalone: true,
  imports: [MatButtonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="greeting-banner">
      <div class="greeting-banner__top">
        <div class="greeting-banner__greeting">
          <div class="greeting-banner__icon-wrapper">
            <mat-icon>{{ timeIcon() }}</mat-icon>
          </div>
          <div class="greeting-banner__text">
            <h2 class="greeting-banner__title">{{ greeting() }}, {{ firstName() }}</h2>
            <span class="greeting-banner__date">{{ dateStr() }}</span>
          </div>
        </div>
      </div>

      <div class="greeting-banner__stats">
        @if (isLoading()) {
          <div class="greeting-banner__stat-chip greeting-banner__shimmer"></div>
          <div class="greeting-banner__stat-chip greeting-banner__shimmer"></div>
          <div class="greeting-banner__stat-chip greeting-banner__shimmer"></div>
        } @else {
          <div class="greeting-banner__stat-chip">
            <mat-icon class="greeting-banner__stat-icon">task_alt</mat-icon>
            <span>{{ stats().tasksToday }} tasks today</span>
          </div>
          <div class="greeting-banner__stat-chip" [class.greeting-banner__stat-chip--danger]="stats().overdue > 0">
            <mat-icon class="greeting-banner__stat-icon">warning</mat-icon>
            <span>{{ stats().overdue }} overdue</span>
          </div>
          <div class="greeting-banner__stat-chip">
            <mat-icon class="greeting-banner__stat-icon">videocam</mat-icon>
            <span>{{ stats().meetings }} meetings</span>
          </div>
        }
      </div>

      <div class="greeting-banner__actions">
        <button mat-stroked-button class="greeting-banner__action-btn" (click)="quickAction.emit('Contact')">
          <mat-icon>person_add</mat-icon> New Contact
        </button>
        <button mat-stroked-button class="greeting-banner__action-btn" (click)="quickAction.emit('Deal')">
          <mat-icon>handshake</mat-icon> New Deal
        </button>
        <button mat-stroked-button class="greeting-banner__action-btn" (click)="quickAction.emit('Activity')">
          <mat-icon>task_alt</mat-icon> Log Activity
        </button>
        <button mat-stroked-button class="greeting-banner__action-btn" (click)="quickAction.emit('Note')">
          <mat-icon>note_add</mat-icon> New Note
        </button>
        <button mat-stroked-button class="greeting-banner__action-btn" (click)="quickAction.emit('Email')">
          <mat-icon>email</mat-icon> Send Email
        </button>
      </div>
    </div>
  `,
  styles: [`
    .greeting-banner {
      border-radius: var(--radius-lg, 12px);
      padding: var(--space-6, 24px);
      background: linear-gradient(135deg, var(--color-primary-soft) 0%, var(--color-primary-soft-hover) 100%);
      border: 1px solid var(--color-border-subtle);
    }

    .greeting-banner__top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: var(--space-4, 16px);
    }

    .greeting-banner__greeting {
      display: flex;
      align-items: center;
      gap: var(--space-3, 12px);
    }

    .greeting-banner__icon-wrapper {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      min-width: 40px;
      border-radius: var(--radius-md, 8px);
      background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-hover) 100%);
      color: var(--color-primary-fg);
      box-shadow: 0 2px 8px rgba(249, 115, 22, 0.25);

      mat-icon {
        font-size: 22px;
        width: 22px;
        height: 22px;
      }
    }

    .greeting-banner__text {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .greeting-banner__title {
      margin: 0;
      font-size: var(--text-2xl, 1.5rem);
      font-weight: var(--font-bold, 700);
      color: var(--color-text);
      letter-spacing: -0.02em;
      line-height: var(--leading-tight, 1.25);
    }

    .greeting-banner__date {
      font-size: var(--text-sm, 0.875rem);
      color: var(--color-text-secondary);
      font-weight: var(--font-medium, 500);
    }

    .greeting-banner__stats {
      display: flex;
      align-items: center;
      gap: var(--space-3, 12px);
      margin-bottom: var(--space-4, 16px);
      flex-wrap: wrap;
    }

    .greeting-banner__stat-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      background: var(--color-surface);
      border-radius: var(--radius-full, 9999px);
      font-size: var(--text-sm, 0.875rem);
      font-weight: var(--font-medium, 500);
      color: var(--color-text);
      border: 1px solid var(--color-border-subtle);
    }

    .greeting-banner__stat-chip--danger {
      color: var(--color-danger-text, #B91C1C);
      border-color: var(--color-danger, #EF4444);
      background: var(--color-danger-soft, #FEF2F2);
    }

    .greeting-banner__stat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      color: var(--color-text-muted);
    }

    .greeting-banner__stat-chip--danger .greeting-banner__stat-icon {
      color: var(--color-danger, #EF4444);
    }

    .greeting-banner__shimmer {
      width: 120px;
      height: 32px;
      background: linear-gradient(
        90deg,
        var(--color-border-subtle) 25%,
        var(--color-primary-soft) 37%,
        var(--color-border-subtle) 63%
      );
      background-size: 200% 100%;
      animation: shimmer 1.8s ease-in-out infinite;
      border: none;
    }

    .greeting-banner__actions {
      display: flex;
      align-items: center;
      gap: var(--space-2, 8px);
      flex-wrap: wrap;
    }

    .greeting-banner__action-btn {
      font-size: var(--text-sm, 0.875rem) !important;
      border-radius: var(--radius-full, 9999px) !important;
      height: 32px !important;
      padding: 0 12px !important;
      line-height: 32px !important;

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        margin-right: 4px;
      }
    }

    @keyframes shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }

    @media (max-width: 768px) {
      .greeting-banner {
        padding: var(--space-4, 16px);
      }

      .greeting-banner__title {
        font-size: var(--text-xl, 1.25rem);
      }

      .greeting-banner__actions {
        gap: var(--space-1, 4px);
      }

      .greeting-banner__action-btn {
        font-size: var(--text-xs, 0.75rem) !important;
        padding: 0 8px !important;
      }
    }
  `],
})
export class GreetingBannerComponent {
  readonly firstName = input.required<string>();
  readonly stats = input.required<{ tasksToday: number; overdue: number; meetings: number }>();
  readonly isLoading = input<boolean>(false);
  readonly quickAction = output<string>();

  readonly greeting = computed(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  });

  readonly timeIcon = computed(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'wb_sunny';
    if (hour >= 12 && hour < 17) return 'wb_cloudy';
    if (hour >= 17 && hour < 21) return 'wb_twilight';
    return 'dark_mode';
  });

  readonly dateStr = computed(() => {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }).format(new Date());
  });
}

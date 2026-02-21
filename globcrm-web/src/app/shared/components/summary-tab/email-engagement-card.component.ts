import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { EmailEngagementDto } from './summary.models';

@Component({
  selector: 'app-email-engagement-card',
  standalone: true,
  imports: [DatePipe, MatIconModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (hasEmails()) {
      <div class="engagement-stats">
        <div class="engagement-row">
          <div class="engagement-stat">
            <span class="stat-icon-circle icon-sent">
              <mat-icon>send</mat-icon>
            </span>
            <span class="stat-value">{{ engagement().sentCount }}</span>
            <span class="stat-label">{{ 'common.summaryTab.emailEngagement.sent' | transloco }}</span>
          </div>
          <div class="engagement-stat">
            <span class="stat-icon-circle icon-received">
              <mat-icon>inbox</mat-icon>
            </span>
            <span class="stat-value">{{ engagement().receivedCount }}</span>
            <span class="stat-label">{{ 'common.summaryTab.emailEngagement.received' | transloco }}</span>
          </div>
          <div class="engagement-stat">
            <span class="stat-icon-circle icon-total">
              <mat-icon>email</mat-icon>
            </span>
            <span class="stat-value">{{ engagement().totalEmails }}</span>
            <span class="stat-label">{{ 'common.summaryTab.emailEngagement.total' | transloco }}</span>
          </div>
        </div>
        <div class="engagement-timestamps">
          @if (engagement().lastSentAt) {
            <div class="timestamp-row">
              <mat-icon class="timestamp-icon">schedule</mat-icon>
              <span class="timestamp-label">{{ 'common.summaryTab.emailEngagement.lastSent' | transloco }}</span>
              <span class="timestamp-value">{{ engagement().lastSentAt | date:'mediumDate' }}</span>
            </div>
          }
          @if (engagement().lastReceivedAt) {
            <div class="timestamp-row">
              <mat-icon class="timestamp-icon">schedule</mat-icon>
              <span class="timestamp-label">{{ 'common.summaryTab.emailEngagement.lastReceived' | transloco }}</span>
              <span class="timestamp-value">{{ engagement().lastReceivedAt | date:'mediumDate' }}</span>
            </div>
          }
        </div>
        @if (engagement().isEnrolledInSequence) {
          <div class="sequence-badge">
            <mat-icon class="sequence-icon">playlist_play</mat-icon>
            <span>Enrolled in: {{ engagement().sequenceName }}</span>
          </div>
        }
      </div>
    } @else {
      <div class="engagement-empty">
        <mat-icon>email</mat-icon>
        <span>{{ 'common.summaryTab.emailEngagement.noActivity' | transloco }}</span>
      </div>
    }
  `,
  styles: [`
    @keyframes pulse-subtle {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.6; }
    }

    .engagement-stats {
      display: flex;
      flex-direction: column;
      gap: var(--space-4, 16px);
    }

    .engagement-row {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: var(--space-4, 16px);
    }

    .engagement-stat {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: var(--space-1, 4px);
    }

    .stat-icon-circle {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border-radius: var(--radius-full, 9999px);
      margin-bottom: var(--space-1, 4px);

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }

      &.icon-sent {
        background: var(--color-primary-soft, #FFF7ED);
        mat-icon { color: var(--color-primary, #F97316); }
      }

      &.icon-received {
        background: var(--color-info-soft, #EFF6FF);
        mat-icon { color: var(--color-info, #3B82F6); }
      }

      &.icon-total {
        background: var(--color-secondary-soft, #F5F3FF);
        mat-icon { color: var(--color-secondary, #8B5CF6); }
      }
    }

    .stat-value {
      font-size: var(--text-xl, 20px);
      font-weight: var(--font-bold, 700);
      color: var(--color-text, #1A1A1A);
      line-height: 1;
    }

    .stat-label {
      font-size: var(--text-xs, 12px);
      color: var(--color-text-muted, #9CA3AF);
    }

    .engagement-timestamps {
      display: flex;
      flex-direction: column;
      gap: var(--space-1-5, 6px);
    }

    .timestamp-row {
      display: flex;
      align-items: center;
      gap: var(--space-1-5, 6px);
    }

    .timestamp-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
      color: var(--color-text-muted, #9CA3AF);
    }

    .timestamp-label {
      font-size: var(--text-xs, 12px);
      color: var(--color-text-secondary, #6B7280);
    }

    .timestamp-value {
      font-size: var(--text-sm, 13px);
      font-weight: var(--font-medium, 500);
      color: var(--color-text, #1A1A1A);
    }

    .sequence-badge {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1, 4px);
      background: var(--color-primary-soft, #FFF7ED);
      color: var(--color-primary-text, #C2410C);
      padding: var(--space-1, 4px) var(--space-3, 12px);
      border-radius: var(--radius-full, 9999px);
      font-size: var(--text-sm, 13px);
      font-weight: var(--font-medium, 500);
      width: fit-content;

      .sequence-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        animation: pulse-subtle 2s ease-in-out infinite;
      }
    }

    .engagement-empty {
      display: flex;
      align-items: center;
      gap: var(--space-2, 8px);
      color: var(--color-text-muted, #9CA3AF);
      padding: var(--space-4, 16px) 0;
    }
  `],
})
export class EmailEngagementCardComponent {
  readonly engagement = input.required<EmailEngagementDto>();

  readonly hasEmails = computed(() => this.engagement().totalEmails > 0);
}

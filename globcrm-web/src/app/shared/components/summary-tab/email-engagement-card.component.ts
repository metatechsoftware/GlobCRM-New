import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { EmailEngagementDto } from './summary.models';

@Component({
  selector: 'app-email-engagement-card',
  standalone: true,
  imports: [DatePipe, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (hasEmails()) {
      <div class="engagement-stats">
        <div class="engagement-row">
          <div class="engagement-stat">
            <mat-icon class="stat-icon">send</mat-icon>
            <div class="stat-content">
              <span class="stat-value">{{ engagement().sentCount }}</span>
              <span class="stat-label">Sent</span>
            </div>
          </div>
          <div class="engagement-stat">
            <mat-icon class="stat-icon">inbox</mat-icon>
            <div class="stat-content">
              <span class="stat-value">{{ engagement().receivedCount }}</span>
              <span class="stat-label">Received</span>
            </div>
          </div>
          <div class="engagement-stat">
            <mat-icon class="stat-icon">email</mat-icon>
            <div class="stat-content">
              <span class="stat-value">{{ engagement().totalEmails }}</span>
              <span class="stat-label">Total</span>
            </div>
          </div>
        </div>
        <div class="engagement-timestamps">
          @if (engagement().lastSentAt) {
            <div class="timestamp-row">
              <span class="timestamp-label">Last sent:</span>
              <span class="timestamp-value">{{ engagement().lastSentAt | date:'mediumDate' }}</span>
            </div>
          }
          @if (engagement().lastReceivedAt) {
            <div class="timestamp-row">
              <span class="timestamp-label">Last received:</span>
              <span class="timestamp-value">{{ engagement().lastReceivedAt | date:'mediumDate' }}</span>
            </div>
          }
        </div>
        @if (engagement().isEnrolledInSequence) {
          <div class="sequence-badge">
            <mat-icon>playlist_play</mat-icon>
            <span>Enrolled in: {{ engagement().sequenceName }}</span>
          </div>
        }
      </div>
    } @else {
      <div class="engagement-empty">
        <mat-icon>email</mat-icon>
        <span>No email activity</span>
      </div>
    }
  `,
  styles: [`
    .engagement-stats {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .engagement-row {
      display: flex;
      gap: 24px;
      flex-wrap: wrap;
    }

    .engagement-stat {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .stat-icon {
      color: var(--text-secondary, #666);
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .stat-content {
      display: flex;
      flex-direction: column;
    }

    .stat-value {
      font-size: 20px;
      font-weight: 600;
      color: var(--text-primary, #212121);
    }

    .stat-label {
      font-size: 12px;
      color: var(--text-secondary, #666);
      text-transform: uppercase;
    }

    .engagement-timestamps {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .timestamp-row {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .timestamp-label {
      font-size: 12px;
      color: var(--text-secondary, #666);
    }

    .timestamp-value {
      font-size: 14px;
      color: var(--text-primary, #212121);
    }

    .sequence-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: var(--primary-50, #fff3e0);
      color: var(--primary-700, #e65100);
      padding: 4px 12px;
      border-radius: 16px;
      font-size: 13px;
      width: fit-content;

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
    }

    .engagement-empty {
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--text-secondary, #666);
      padding: 16px 0;
    }
  `],
})
export class EmailEngagementCardComponent {
  readonly engagement = input.required<EmailEngagementDto>();

  readonly hasEmails = computed(() => this.engagement().totalEmails > 0);
}

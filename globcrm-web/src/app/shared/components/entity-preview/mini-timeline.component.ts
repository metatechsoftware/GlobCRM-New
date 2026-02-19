import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { RecentActivityDto } from '../../models/entity-preview.models';

@Component({
  selector: 'app-mini-timeline',
  standalone: true,
  imports: [MatIconModule, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="preview-section">
      <div class="section-title">Recent Activities</div>
      <div class="mini-timeline">
        @for (activity of activities(); track activity.id) {
          <div class="timeline-item">
            <div class="timeline-left">
              <div class="timeline-dot" [style.background-color]="getActivityColor(activity.type)"></div>
              @if (!$last) {
                <div class="timeline-line"></div>
              }
            </div>
            <div class="timeline-content">
              <div class="timeline-subject">{{ activity.subject }}</div>
              <div class="timeline-meta">
                <span class="activity-type-badge">{{ activity.type }}</span>
                <span class="timeline-time">{{ getRelativeTime(activity.createdAt) }}</span>
              </div>
            </div>
          </div>
        }
      </div>
      <button mat-button color="primary" class="view-all-btn" (click)="viewAllClick.emit()">
        View all activities
      </button>
    </div>
  `,
  styles: [`
    .preview-section {
      border-top: 1px solid var(--color-border);
      padding-top: 16px;
      margin-top: 16px;
    }

    .section-title {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--color-text-muted);
      margin-bottom: 8px;
      font-weight: 600;
    }

    .mini-timeline {
      display: flex;
      flex-direction: column;
    }

    .timeline-item {
      display: flex;
      gap: 12px;
      min-height: 40px;
    }

    .timeline-left {
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 12px;
      flex-shrink: 0;
    }

    .timeline-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      margin-top: 6px;
      flex-shrink: 0;
    }

    .timeline-line {
      width: 2px;
      flex-grow: 1;
      background-color: var(--color-border);
      margin: 2px 0;
    }

    .timeline-content {
      flex: 1;
      padding-bottom: 8px;
    }

    .timeline-subject {
      font-size: 13px;
      color: var(--color-text);
      line-height: 1.3;
    }

    .timeline-meta {
      display: flex;
      gap: 8px;
      align-items: center;
      margin-top: 2px;
    }

    .activity-type-badge {
      font-size: 11px;
      padding: 1px 6px;
      border-radius: 4px;
      background-color: var(--color-bg-secondary);
      color: var(--color-text-secondary);
      text-transform: capitalize;
    }

    .timeline-time {
      font-size: 11px;
      color: var(--color-text-muted);
    }

    .view-all-btn {
      margin-top: 4px;
      font-size: 13px;
    }
  `],
})
export class MiniTimelineComponent {
  readonly activities = input.required<RecentActivityDto[]>();
  readonly entityType = input.required<string>();
  readonly entityId = input.required<string>();
  readonly viewAllClick = output<void>();

  getActivityColor(type: string): string {
    switch (type.toLowerCase()) {
      case 'call': return 'var(--color-info)';
      case 'email': return 'var(--color-primary)';
      case 'meeting': return 'var(--color-secondary)';
      case 'task': return 'var(--color-success)';
      case 'note': return 'var(--color-warning)';
      default: return 'var(--color-accent)';
    }
  }

  getRelativeTime(dateStr: string): string {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    const diffWeeks = Math.floor(diffDays / 7);
    if (diffWeeks < 4) return `${diffWeeks}w ago`;
    return date.toLocaleDateString();
  }
}

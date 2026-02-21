import { Component, ChangeDetectionStrategy, input, inject, signal, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslocoPipe } from '@jsverse/transloco';
import { ActivityService } from '../../../features/activities/activity.service';

@Component({
  selector: 'app-preview-activities-tab',
  standalone: true,
  imports: [DatePipe, MatIconModule, MatProgressSpinnerModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (isLoading()) {
      <div class="tab-loading">
        <mat-spinner diameter="32"></mat-spinner>
      </div>
    } @else if (activities().length === 0) {
      <div class="tab-empty">
        <mat-icon>task_alt</mat-icon>
        <span>{{ 'common.preview.noActivities' | transloco }}</span>
      </div>
    } @else {
      <div class="activities-list">
        @for (activity of activities(); track activity.id) {
          <div class="activity-card">
            <div class="activity-subject">{{ activity.subject }}</div>
            <div class="activity-badges">
              <span class="badge badge-type">{{ activity.type }}</span>
              <span class="badge" [class]="'badge-status badge-status-' + activity.status.toString().toLowerCase()">{{ activity.status }}</span>
              <span class="badge" [class]="'badge-priority badge-priority-' + activity.priority.toString().toLowerCase()">{{ activity.priority }}</span>
            </div>
            @if (activity.dueDate) {
              <div class="activity-due">
                <mat-icon>schedule</mat-icon>
                <span>Due {{ activity.dueDate | date:'MMM d, y' }}</span>
              </div>
            }
          </div>
        }
      </div>
    }
  `,
  styles: [`
    .tab-loading {
      display: flex;
      justify-content: center;
      padding: 24px;
    }

    .tab-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 32px 16px;
      color: var(--color-text-secondary);
      text-align: center;

      mat-icon {
        font-size: 40px;
        width: 40px;
        height: 40px;
        opacity: 0.5;
      }
    }

    .activities-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .activity-card {
      padding: 12px;
      border: 1px solid var(--color-border);
      border-radius: 8px;
      background: var(--color-surface);
    }

    .activity-subject {
      font-size: 14px;
      font-weight: 500;
      color: var(--color-text);
      margin-bottom: 6px;
    }

    .activity-badges {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      margin-bottom: 4px;
    }

    .badge {
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 4px;
      font-weight: 600;
      text-transform: capitalize;
    }

    .badge-type {
      background-color: var(--color-bg-secondary);
      color: var(--color-text-secondary);
    }

    .badge-status-done { background-color: var(--color-success-soft, #e8f5e9); color: var(--color-success-text, #2e7d32); }
    .badge-status-inprogress { background-color: var(--color-info-soft); color: var(--color-info-text); }
    .badge-status-assigned,
    .badge-status-accepted { background-color: var(--color-bg-secondary); color: var(--color-text-secondary); }
    .badge-status-review { background-color: var(--color-warning-soft); color: var(--color-warning-text); }

    .badge-priority-urgent,
    .badge-priority-high { background-color: var(--color-danger-soft); color: var(--color-danger-text); }
    .badge-priority-medium { background-color: var(--color-warning-soft); color: var(--color-warning-text); }
    .badge-priority-low { background-color: var(--color-info-soft); color: var(--color-info-text); }

    .activity-due {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      color: var(--color-text-muted);
      margin-top: 6px;

      mat-icon {
        font-size: 14px;
        width: 14px;
        height: 14px;
      }
    }
  `],
})
export class PreviewActivitiesTabComponent implements OnInit {
  readonly entityType = input.required<string>();
  readonly entityId = input.required<string>();

  private readonly activityService = inject(ActivityService);

  readonly isLoading = signal(true);
  readonly activities = signal<any[]>([]);

  ngOnInit(): void {
    this.activityService.getList({
      linkedEntityType: this.entityType(),
      linkedEntityId: this.entityId(),
      pageSize: 10,
    }).subscribe({
      next: (result) => {
        this.activities.set(result.items);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      },
    });
  }
}

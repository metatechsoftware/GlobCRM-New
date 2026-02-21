import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { PreviewEntityLinkComponent } from '../../../../shared/components/entity-preview/preview-entity-link.component';
import { MyDayTaskDto } from '../../my-day.models';

@Component({
  selector: 'app-tasks-widget',
  standalone: true,
  imports: [MatCardModule, MatCheckboxModule, MatIconModule, PreviewEntityLinkComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-card class="tasks-widget">
      <mat-card-header>
        <div class="widget-header-icon">
          <mat-icon>checklist</mat-icon>
        </div>
        <mat-card-title>Today's Tasks</mat-card-title>
      </mat-card-header>

      <mat-card-content>
        @if (isLoading()) {
          <div class="tasks-widget__loading">
            @for (i of [1, 2, 3, 4, 5]; track i) {
              <div class="tasks-widget__shimmer-row"></div>
            }
          </div>
        } @else if (overdueTasks().length === 0 && todayTasks().length === 0) {
          <div class="tasks-widget__empty">
            <mat-icon class="tasks-widget__empty-icon">check_circle</mat-icon>
            <span class="tasks-widget__empty-text">No tasks for today -- nice work!</span>
          </div>
        } @else {
          <!-- Overdue section -->
          @if (overdueTasks().length > 0) {
            <div class="tasks-widget__section tasks-widget__section--overdue">
              <div class="tasks-widget__section-header tasks-widget__section-header--overdue">
                <mat-icon>warning</mat-icon>
                <span>Overdue</span>
              </div>
              @for (task of overdueTasks(); track task.id) {
                <div class="tasks-widget__row tasks-widget__row--overdue"
                     [class.tasks-widget__row--highlighted]="highlightedItemId() === task.id"
                     [class.tasks-widget__row--completing]="completingTaskIds().includes(task.id)">
                  <mat-checkbox
                    class="tasks-widget__checkbox"
                    (change)="taskCompleted.emit(task.id)"
                    [disabled]="completingTaskIds().includes(task.id)">
                  </mat-checkbox>
                  <div class="tasks-widget__content">
                    <span class="tasks-widget__subject">{{ task.subject }}</span>
                    <span class="tasks-widget__overdue-badge">{{ task.daysOverdue }}d overdue</span>
                  </div>
                  @if (task.linkedEntityType && task.linkedEntityId && task.linkedEntityName) {
                    <app-preview-entity-link
                      [entityType]="task.linkedEntityType"
                      [entityId]="task.linkedEntityId"
                      [entityName]="task.linkedEntityName" />
                  }
                </div>
              }
            </div>
          }

          <!-- Today section -->
          @if (todayTasks().length > 0) {
            <div class="tasks-widget__section">
              @if (overdueTasks().length > 0) {
                <div class="tasks-widget__section-header">
                  <mat-icon>today</mat-icon>
                  <span>Due Today</span>
                </div>
              }
              @for (task of todayTasks(); track task.id) {
                <div class="tasks-widget__row"
                     [class.tasks-widget__row--highlighted]="highlightedItemId() === task.id"
                     [class.tasks-widget__row--completing]="completingTaskIds().includes(task.id)">
                  <mat-checkbox
                    class="tasks-widget__checkbox"
                    (change)="taskCompleted.emit(task.id)"
                    [disabled]="completingTaskIds().includes(task.id)">
                  </mat-checkbox>
                  <div class="tasks-widget__content">
                    <span class="tasks-widget__subject">{{ task.subject }}</span>
                    @if (task.priority === 'High' || task.priority === 'Urgent') {
                      <span class="tasks-widget__priority-badge"
                            [class.tasks-widget__priority-badge--urgent]="task.priority === 'Urgent'">
                        {{ task.priority }}
                      </span>
                    }
                  </div>
                  @if (task.linkedEntityType && task.linkedEntityId && task.linkedEntityName) {
                    <app-preview-entity-link
                      [entityType]="task.linkedEntityType"
                      [entityId]="task.linkedEntityId"
                      [entityName]="task.linkedEntityName" />
                  }
                </div>
              }
            </div>
          }
        }
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    @keyframes shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }

    @keyframes pulse-highlight {
      0% { box-shadow: 0 0 0 0 rgba(249, 115, 22, 0.4); }
      50% { box-shadow: 0 0 0 6px rgba(249, 115, 22, 0); }
      100% { box-shadow: 0 0 0 0 rgba(249, 115, 22, 0); }
    }

    .tasks-widget {
      width: 100%;
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

    .tasks-widget__section {
      margin-bottom: var(--space-3, 12px);

      &:last-child {
        margin-bottom: 0;
      }
    }

    .tasks-widget__section--overdue {
      border-left: 3px solid var(--color-danger, #EF4444);
      padding-left: var(--space-3, 12px);
      margin-left: calc(-1 * var(--space-1, 4px));
    }

    .tasks-widget__section-header {
      display: flex;
      align-items: center;
      gap: var(--space-1, 4px);
      font-size: var(--text-xs, 0.75rem);
      font-weight: var(--font-semibold, 600);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--color-text-secondary);
      margin-bottom: var(--space-2, 8px);
      padding-bottom: var(--space-1, 4px);
      border-bottom: 1px solid var(--color-border-subtle);

      mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
      }
    }

    .tasks-widget__section-header--overdue {
      color: var(--color-danger-text, #B91C1C);
      border-bottom-color: rgba(239, 68, 68, 0.2);

      mat-icon {
        color: var(--color-danger, #EF4444);
      }
    }

    .tasks-widget__row {
      display: flex;
      align-items: center;
      gap: var(--space-2, 8px);
      padding: var(--space-2, 8px) var(--space-2, 8px);
      border-radius: var(--radius-md, 8px);
      transition: background-color 150ms ease, opacity 300ms ease;

      &:hover {
        background: rgba(249, 115, 22, 0.04);
      }
    }

    .tasks-widget__row--overdue {
      background: var(--color-danger-soft, #FEF2F2);

      &:hover {
        background: rgba(239, 68, 68, 0.08);
      }
    }

    .tasks-widget__row--completing {
      opacity: 0.4;
      text-decoration: line-through;
      pointer-events: none;
    }

    .tasks-widget__row--highlighted {
      animation: pulse-highlight 2s ease-out;
    }

    .tasks-widget__checkbox {
      flex-shrink: 0;
    }

    .tasks-widget__content {
      flex: 1;
      min-width: 0;
      display: flex;
      align-items: center;
      gap: var(--space-2, 8px);
    }

    .tasks-widget__subject {
      font-size: var(--text-sm, 0.875rem);
      color: var(--color-text);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .tasks-widget__overdue-badge {
      flex-shrink: 0;
      display: inline-flex;
      align-items: center;
      padding: 2px 8px;
      background: var(--color-danger, #EF4444);
      color: white;
      border-radius: var(--radius-full, 9999px);
      font-size: 0.7rem;
      font-weight: var(--font-semibold, 600);
      line-height: 1.4;
      letter-spacing: 0.02em;
    }

    .tasks-widget__priority-badge {
      flex-shrink: 0;
      display: inline-flex;
      align-items: center;
      padding: 2px 8px;
      background: var(--color-warning-soft, #FFFBEB);
      color: var(--color-warning-text, #B45309);
      border-radius: var(--radius-full, 9999px);
      font-size: 0.7rem;
      font-weight: var(--font-semibold, 600);
      line-height: 1.4;
    }

    .tasks-widget__priority-badge--urgent {
      background: var(--color-danger-soft, #FEF2F2);
      color: var(--color-danger-text, #B91C1C);
    }

    .tasks-widget__empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-3, 12px);
      padding: var(--space-10, 40px) 0;
    }

    .tasks-widget__empty-icon {
      font-size: 44px;
      width: 44px;
      height: 44px;
      color: var(--color-success, #22C55E);
      opacity: 0.5;
    }

    .tasks-widget__empty-text {
      font-size: var(--text-sm, 0.875rem);
      color: var(--color-text-muted);
    }

    .tasks-widget__loading {
      display: flex;
      flex-direction: column;
      gap: var(--space-2, 8px);
    }

    .tasks-widget__shimmer-row {
      height: 40px;
      border-radius: var(--radius-md, 8px);
      background: linear-gradient(
        90deg,
        var(--color-border-subtle) 25%,
        var(--color-primary-soft) 37%,
        var(--color-border-subtle) 63%
      );
      background-size: 200% 100%;
      animation: shimmer 1.8s ease-in-out infinite;

      &:nth-child(2) { animation-delay: 100ms; }
      &:nth-child(3) { animation-delay: 200ms; }
      &:nth-child(4) { animation-delay: 300ms; }
      &:nth-child(5) { animation-delay: 400ms; }
    }

    @media (prefers-reduced-motion: reduce) {
      .tasks-widget {
        transition: none;
      }
    }
  `],
})
export class TasksWidgetComponent {
  readonly overdueTasks = input<MyDayTaskDto[]>([]);
  readonly todayTasks = input<MyDayTaskDto[]>([]);
  readonly isLoading = input<boolean>(false);
  readonly completingTaskIds = input<string[]>([]);
  readonly highlightedItemId = input<string | null>(null);

  readonly taskCompleted = output<string>();
  readonly entityClicked = output<{ type: string; id: string }>();
}

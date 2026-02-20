import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { PreviewEntityLinkComponent } from '../../../../shared/components/entity-preview/preview-entity-link.component';
import { ENTITY_TYPE_REGISTRY } from '../../../../shared/services/entity-type-registry';
import { MyDayRecentRecordDto } from '../../my-day.models';

@Component({
  selector: 'app-recent-records-widget',
  standalone: true,
  imports: [MatCardModule, MatIconModule, PreviewEntityLinkComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-card class="records-widget">
      <mat-card-header>
        <mat-icon class="records-widget__header-icon">history</mat-icon>
        <mat-card-title>Recent Records</mat-card-title>
      </mat-card-header>

      <mat-card-content>
        @if (isLoading()) {
          <div class="records-widget__loading">
            @for (i of [1, 2, 3, 4, 5, 6]; track i) {
              <div class="records-widget__shimmer-row">
                <div class="records-widget__shimmer-icon"></div>
                <div class="records-widget__shimmer-text"></div>
              </div>
            }
          </div>
        } @else if (records().length === 0) {
          <div class="records-widget__empty">
            <mat-icon class="records-widget__empty-icon">history</mat-icon>
            <span class="records-widget__empty-text">No recently viewed records</span>
          </div>
        } @else {
          <div class="records-widget__list">
            @for (record of records(); track record.entityId) {
              <div class="records-widget__row">
                <mat-icon class="records-widget__type-icon"
                          [style.color]="getColor(record.entityType)">
                  {{ getIcon(record.entityType) }}
                </mat-icon>
                <div class="records-widget__content">
                  <app-preview-entity-link
                    [entityType]="record.entityType"
                    [entityId]="record.entityId"
                    [entityName]="record.entityName" />
                  <span class="records-widget__type-label">{{ getLabel(record.entityType) }}</span>
                </div>
                <span class="records-widget__time">{{ relativeTime(record.viewedAt) }}</span>
              </div>
            }
          </div>
        }
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    .records-widget {
      width: 100%;
      height: fit-content;
    }

    mat-card-header {
      display: flex;
      align-items: center;
      gap: var(--space-2, 8px);
      margin-bottom: var(--space-3, 12px);
    }

    .records-widget__header-icon {
      color: var(--color-primary);
    }

    mat-card-title {
      margin: 0;
      font-size: var(--text-lg, 1.125rem);
      font-weight: var(--font-semibold, 600);
    }

    /* Records list */
    .records-widget__list {
      display: flex;
      flex-direction: column;
    }

    .records-widget__row {
      display: flex;
      align-items: center;
      gap: var(--space-2, 8px);
      padding: var(--space-2, 8px) var(--space-1, 4px);
      border-radius: var(--radius-md, 8px);
      transition: background-color 0.15s ease;

      &:hover {
        background: var(--color-surface-hover);
      }
    }

    .records-widget__type-icon {
      flex-shrink: 0;
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .records-widget__content {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .records-widget__type-label {
      font-size: var(--text-xs, 0.75rem);
      color: var(--color-text-muted);
    }

    .records-widget__time {
      flex-shrink: 0;
      font-size: var(--text-xs, 0.75rem);
      color: var(--color-text-muted);
    }

    /* Empty state */
    .records-widget__empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-2, 8px);
      padding: var(--space-8, 32px) 0;
    }

    .records-widget__empty-icon {
      font-size: 40px;
      width: 40px;
      height: 40px;
      color: var(--color-text-muted);
      opacity: 0.5;
    }

    .records-widget__empty-text {
      font-size: var(--text-sm, 0.875rem);
      color: var(--color-text-muted);
    }

    /* Loading state */
    .records-widget__loading {
      display: flex;
      flex-direction: column;
      gap: var(--space-2, 8px);
    }

    .records-widget__shimmer-row {
      display: flex;
      align-items: center;
      gap: var(--space-2, 8px);
      padding: var(--space-2, 8px) 0;
    }

    .records-widget__shimmer-icon {
      width: 20px;
      height: 20px;
      border-radius: var(--radius-sm, 4px);
      flex-shrink: 0;
      background: linear-gradient(
        90deg,
        var(--color-border-subtle) 25%,
        var(--color-primary-soft) 37%,
        var(--color-border-subtle) 63%
      );
      background-size: 200% 100%;
      animation: shimmer 1.8s ease-in-out infinite;
    }

    .records-widget__shimmer-text {
      height: 14px;
      width: 70%;
      border-radius: var(--radius-sm, 4px);
      background: linear-gradient(
        90deg,
        var(--color-border-subtle) 25%,
        var(--color-primary-soft) 37%,
        var(--color-border-subtle) 63%
      );
      background-size: 200% 100%;
      animation: shimmer 1.8s ease-in-out infinite;
    }

    @keyframes shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
  `],
})
export class RecentRecordsWidgetComponent {
  readonly records = input<MyDayRecentRecordDto[]>([]);
  readonly isLoading = input<boolean>(false);
  readonly recordClicked = output<{ type: string; id: string }>();

  getIcon(entityType: string): string {
    return ENTITY_TYPE_REGISTRY[entityType]?.icon ?? 'link';
  }

  getColor(entityType: string): string {
    return ENTITY_TYPE_REGISTRY[entityType]?.color ?? 'var(--color-text-muted)';
  }

  getLabel(entityType: string): string {
    return ENTITY_TYPE_REGISTRY[entityType]?.label ?? entityType;
  }

  relativeTime(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}

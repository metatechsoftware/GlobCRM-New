import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { PreviewEntityLinkComponent } from '../../../../shared/components/entity-preview/preview-entity-link.component';
import { ENTITY_TYPE_REGISTRY } from '../../../../shared/services/entity-type-registry';
import { MyDayRecentRecordDto } from '../../my-day.models';

@Component({
  selector: 'app-recent-records-widget',
  standalone: true,
  imports: [MatCardModule, MatIconModule, TranslocoPipe, PreviewEntityLinkComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-card class="records-widget">
      <mat-card-header>
        <div class="widget-header-icon">
          <mat-icon>history</mat-icon>
        </div>
        <mat-card-title>{{ 'myDay.widgets.recentRecords.title' | transloco }}</mat-card-title>
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
            <span class="records-widget__empty-text">{{ 'myDay.widgets.recentRecords.empty' | transloco }}</span>
          </div>
        } @else {
          <div class="records-widget__list">
            @for (record of records(); track record.entityId) {
              <div class="records-widget__row">
                <div class="records-widget__type-icon-wrap" [style.background]="getColorSoft(record.entityType)">
                  <mat-icon class="records-widget__type-icon"
                            [style.color]="getColor(record.entityType)">
                    {{ getIcon(record.entityType) }}
                  </mat-icon>
                </div>
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
    @keyframes shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }

    .records-widget {
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

    /* Records list */
    .records-widget__list {
      display: flex;
      flex-direction: column;
    }

    .records-widget__row {
      display: flex;
      align-items: center;
      gap: var(--space-3, 12px);
      padding: var(--space-2, 8px);
      border-radius: var(--radius-md, 8px);
      transition: background-color 150ms ease;

      &:hover {
        background: rgba(249, 115, 22, 0.04);
      }
    }

    .records-widget__type-icon-wrap {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: var(--radius-md, 8px);
      flex-shrink: 0;
    }

    .records-widget__type-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
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
      font-variant-numeric: tabular-nums;
    }

    /* Empty state */
    .records-widget__empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-3, 12px);
      padding: var(--space-10, 40px) 0;
    }

    .records-widget__empty-icon {
      font-size: 44px;
      width: 44px;
      height: 44px;
      color: var(--color-text-muted);
      opacity: 0.4;
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
      gap: var(--space-3, 12px);
      padding: var(--space-2, 8px) 0;
    }

    .records-widget__shimmer-icon {
      width: 32px;
      height: 32px;
      border-radius: var(--radius-md, 8px);
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

    @media (prefers-reduced-motion: reduce) {
      .records-widget {
        transition: none;
      }
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

  getColorSoft(entityType: string): string {
    const color = this.getColor(entityType);
    // Use a soft tinted background based on the entity color
    if (color.startsWith('#')) {
      return `${color}15`;
    }
    return 'var(--color-surface-hover)';
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

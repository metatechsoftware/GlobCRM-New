import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { PreviewEntityLinkComponent } from '../../../../shared/components/entity-preview/preview-entity-link.component';
import { MyDayFeedItemDto } from '../../my-day.models';

@Component({
  selector: 'app-feed-preview-widget',
  standalone: true,
  imports: [MatCardModule, MatIconModule, RouterLink, PreviewEntityLinkComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-card class="feed-widget">
      <mat-card-header>
        <mat-icon class="feed-widget__header-icon">dynamic_feed</mat-icon>
        <mat-card-title>Activity Feed</mat-card-title>
      </mat-card-header>

      <mat-card-content>
        @if (isLoading()) {
          <div class="feed-widget__loading">
            @for (i of [1, 2, 3, 4, 5]; track i) {
              <div class="feed-widget__shimmer-row">
                <div class="feed-widget__shimmer-avatar"></div>
                <div class="feed-widget__shimmer-content">
                  <div class="feed-widget__shimmer-line"></div>
                  <div class="feed-widget__shimmer-line feed-widget__shimmer-line--short"></div>
                </div>
              </div>
            }
          </div>
        } @else if (feedItems().length === 0) {
          <div class="feed-widget__empty">
            <mat-icon class="feed-widget__empty-icon">dynamic_feed</mat-icon>
            <span class="feed-widget__empty-text">No recent activity</span>
          </div>
        } @else {
          <div class="feed-widget__list">
            @for (item of feedItems(); track item.id) {
              <div class="feed-widget__row">
                <div class="feed-widget__avatar" [attr.aria-label]="item.authorName">
                  {{ initial(item.authorName) }}
                </div>
                <div class="feed-widget__content">
                  <div class="feed-widget__text">
                    <span class="feed-widget__author">{{ item.authorName }}</span>
                    {{ truncate(item.content, 80) }}
                    @if (item.entityType && item.entityId && item.entityName) {
                      <app-preview-entity-link
                        [entityType]="item.entityType"
                        [entityId]="item.entityId"
                        [entityName]="item.entityName" />
                    }
                  </div>
                  <span class="feed-widget__time">{{ relativeTime(item.createdAt) }}</span>
                </div>
              </div>
            }
          </div>

          <a class="feed-widget__view-all" routerLink="/feed">View all activity</a>
        }
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    .feed-widget {
      width: 100%;
      height: fit-content;
    }

    mat-card-header {
      display: flex;
      align-items: center;
      gap: var(--space-2, 8px);
      margin-bottom: var(--space-3, 12px);
    }

    .feed-widget__header-icon {
      color: var(--color-primary);
    }

    mat-card-title {
      margin: 0;
      font-size: var(--text-lg, 1.125rem);
      font-weight: var(--font-semibold, 600);
    }

    /* Feed list */
    .feed-widget__list {
      display: flex;
      flex-direction: column;
    }

    .feed-widget__row {
      display: flex;
      gap: var(--space-2, 8px);
      padding: var(--space-2, 8px) 0;
      border-bottom: 1px solid var(--color-border-subtle);

      &:last-child {
        border-bottom: none;
      }
    }

    .feed-widget__avatar {
      flex-shrink: 0;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: var(--color-primary-soft);
      color: var(--color-primary);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: var(--text-xs, 0.75rem);
      font-weight: var(--font-semibold, 600);
      text-transform: uppercase;
    }

    .feed-widget__content {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .feed-widget__text {
      font-size: var(--text-sm, 0.875rem);
      color: var(--color-text-secondary);
      line-height: 1.4;
      word-break: break-word;
    }

    .feed-widget__author {
      font-weight: var(--font-semibold, 600);
      color: var(--color-text);
    }

    .feed-widget__time {
      font-size: var(--text-xs, 0.75rem);
      color: var(--color-text-muted);
    }

    /* View all link */
    .feed-widget__view-all {
      display: block;
      text-align: center;
      padding: var(--space-2, 8px) 0;
      margin-top: var(--space-2, 8px);
      font-size: var(--text-sm, 0.875rem);
      font-weight: var(--font-medium, 500);
      color: var(--color-primary);
      text-decoration: none;
      border-top: 1px solid var(--color-border-subtle);

      &:hover {
        text-decoration: underline;
      }
    }

    /* Empty state */
    .feed-widget__empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-2, 8px);
      padding: var(--space-8, 32px) 0;
    }

    .feed-widget__empty-icon {
      font-size: 40px;
      width: 40px;
      height: 40px;
      color: var(--color-text-muted);
      opacity: 0.5;
    }

    .feed-widget__empty-text {
      font-size: var(--text-sm, 0.875rem);
      color: var(--color-text-muted);
    }

    /* Loading state */
    .feed-widget__loading {
      display: flex;
      flex-direction: column;
      gap: var(--space-2, 8px);
    }

    .feed-widget__shimmer-row {
      display: flex;
      gap: var(--space-2, 8px);
      padding: var(--space-2, 8px) 0;
    }

    .feed-widget__shimmer-avatar {
      width: 28px;
      height: 28px;
      border-radius: 50%;
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

    .feed-widget__shimmer-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .feed-widget__shimmer-line {
      height: 14px;
      width: 90%;
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

    .feed-widget__shimmer-line--short {
      width: 50%;
    }

    @keyframes shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
  `],
})
export class FeedPreviewWidgetComponent {
  readonly feedItems = input<MyDayFeedItemDto[]>([]);
  readonly isLoading = input<boolean>(false);
  readonly entityClicked = output<{ type: string; id: string }>();

  initial(name: string): string {
    return name ? name.charAt(0).toUpperCase() : '?';
  }

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
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}

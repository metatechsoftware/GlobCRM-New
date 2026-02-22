import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { PreviewEntityLinkComponent } from '../../../../shared/components/entity-preview/preview-entity-link.component';
import { MyDayFeedItemDto } from '../../my-day.models';

@Component({
  selector: 'app-feed-preview-widget',
  standalone: true,
  imports: [MatCardModule, MatIconModule, RouterLink, TranslocoPipe, PreviewEntityLinkComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-card class="feed-widget">
      <mat-card-header>
        <div class="widget-header-icon">
          <mat-icon>dynamic_feed</mat-icon>
        </div>
        <mat-card-title>{{ 'myDay.widgets.feed.title' | transloco }}</mat-card-title>
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
            <span class="feed-widget__empty-text">{{ 'myDay.widgets.feed.noRecentActivity' | transloco }}</span>
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

          <a class="feed-widget__view-all" routerLink="/feed">
            {{ 'myDay.widgets.feed.viewAll' | transloco }}
            <mat-icon class="feed-widget__view-all-icon">arrow_forward</mat-icon>
          </a>
        }
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    @keyframes shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }

    .feed-widget {
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

    /* Feed list */
    .feed-widget__list {
      display: flex;
      flex-direction: column;
    }

    .feed-widget__row {
      display: flex;
      gap: var(--space-3, 12px);
      padding: var(--space-2, 8px) 0;
      border-bottom: 1px solid var(--color-border-subtle);

      &:last-child {
        border-bottom: none;
      }
    }

    .feed-widget__avatar {
      flex-shrink: 0;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--color-primary-soft) 0%, rgba(249, 115, 22, 0.15) 100%);
      color: #F97316;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: var(--text-xs, 0.75rem);
      font-weight: var(--font-bold, 700);
      text-transform: uppercase;
    }

    .feed-widget__content {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    .feed-widget__text {
      font-size: var(--text-sm, 0.875rem);
      color: var(--color-text-secondary);
      line-height: 1.45;
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
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      padding: var(--space-3, 12px) 0 var(--space-1, 4px);
      margin-top: var(--space-1, 4px);
      font-size: var(--text-sm, 0.875rem);
      font-weight: var(--font-medium, 500);
      color: #F97316;
      text-decoration: none;
      border-top: 1px solid var(--color-border-subtle);
      transition: color 150ms ease;

      &:hover {
        color: #EA580C;
      }
    }

    .feed-widget__view-all-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      transition: transform 150ms ease;

      .feed-widget__view-all:hover & {
        transform: translateX(2px);
      }
    }

    /* Empty state */
    .feed-widget__empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-3, 12px);
      padding: var(--space-10, 40px) 0;
    }

    .feed-widget__empty-icon {
      font-size: 44px;
      width: 44px;
      height: 44px;
      color: var(--color-text-muted);
      opacity: 0.4;
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
      gap: var(--space-3, 12px);
      padding: var(--space-2, 8px) 0;
    }

    .feed-widget__shimmer-avatar {
      width: 32px;
      height: 32px;
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

    @media (prefers-reduced-motion: reduce) {
      .feed-widget {
        transition: none;
      }

      .feed-widget__view-all-icon {
        transition: none;
      }
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

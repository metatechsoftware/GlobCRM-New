import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  OnDestroy,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subscription } from 'rxjs';
import { FeedStore } from '../feed.store';
import { FeedItemDto, FeedItemType } from '../feed.models';
import { FeedPostFormComponent } from '../feed-post-form/feed-post-form.component';
import { SignalRService } from '../../../core/signalr/signalr.service';
import { AuthStore } from '../../../core/auth/auth.store';
import { PreviewSidebarStore } from '../../../shared/stores/preview-sidebar.store';
import { getEntityConfig, getEntityRoute } from '../../../shared/services/entity-type-registry';

/**
 * Feed list page combining activity stream and social posts.
 * Provides FeedStore at component level (each feed page gets its own instance).
 * Subscribes to SignalR feedUpdate$ for real-time new items.
 */
@Component({
  selector: 'app-feed-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    FeedPostFormComponent,
  ],
  providers: [FeedStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
      max-width: 680px;
      margin: 0 auto;
      padding: 24px 16px;
    }

    .feed-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 20px;

      h1 {
        font-size: 24px;
        font-weight: 600;
        color: var(--color-text, #1a1a1a);
        margin: 0;
      }

      mat-icon {
        color: var(--color-primary, #d97b3a);
        font-size: 28px;
        width: 28px;
        height: 28px;
      }
    }

    .feed-items {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .feed-item-card {
      padding: 16px;
      border-radius: 12px;
      border: 1px solid var(--color-border-subtle, #e0e0e0);
    }

    .feed-item-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 10px;
    }

    .feed-author-avatar {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      min-width: 36px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--color-primary-soft, #fff3e0) 0%, var(--color-secondary-soft, #e8f5e9) 100%);
      color: var(--color-primary-text, #e65100);
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.5px;
    }

    .feed-author-info {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .feed-author-name {
      font-size: 14px;
      font-weight: 600;
      color: var(--color-text, #1a1a1a);
    }

    .feed-time {
      font-size: 12px;
      color: var(--color-text-muted, #9e9e9e);
    }

    .feed-type-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .feed-type-icon.system-event {
      color: var(--color-text-muted, #9e9e9e);
    }

    .feed-type-icon.social-post {
      color: var(--color-primary, #d97b3a);
    }

    .feed-item-content {
      font-size: 14px;
      line-height: 1.6;
      color: var(--color-text, #1a1a1a);
      margin-bottom: 10px;
      white-space: pre-wrap;
      word-wrap: break-word;
    }

    .feed-entity-link {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: var(--color-primary, #d97b3a);
      text-decoration: none;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      padding: 2px 0;
      margin-bottom: 8px;
      transition: color 0.15s ease;

      &:hover {
        text-decoration: underline;
        color: var(--color-primary-dark, var(--color-primary, #d97b3a));
      }

      .entity-link-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
      }
    }

    .feed-item-actions {
      display: flex;
      align-items: center;
      gap: 16px;
      padding-top: 8px;
      border-top: 1px solid var(--color-border-subtle, #e0e0e0);
    }

    .action-btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 13px;
      color: var(--color-text-secondary, #666);
      cursor: pointer;
      background: none;
      border: none;
      padding: 4px 8px;
      border-radius: 6px;
      transition: background 0.15s, color 0.15s;

      &:hover {
        background: var(--color-highlight, #f5f5f5);
        color: var(--color-text, #1a1a1a);
      }

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
    }

    .comments-section {
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid var(--color-border-subtle, #e0e0e0);
    }

    .comment-item {
      display: flex;
      gap: 8px;
      margin-bottom: 10px;
    }

    .comment-avatar {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      min-width: 28px;
      border-radius: 50%;
      background: var(--color-bg-secondary, #f5f5f5);
      color: var(--color-text-secondary, #666);
      font-size: 11px;
      font-weight: 600;
    }

    .comment-body {
      flex: 1;
    }

    .comment-author {
      font-size: 13px;
      font-weight: 600;
      color: var(--color-text, #1a1a1a);
    }

    .comment-time {
      font-size: 11px;
      color: var(--color-text-muted, #9e9e9e);
      margin-left: 6px;
    }

    .comment-text {
      font-size: 13px;
      line-height: 1.5;
      color: var(--color-text, #1a1a1a);
      margin-top: 2px;
    }

    .add-comment-row {
      display: flex;
      gap: 8px;
      margin-top: 8px;
      align-items: flex-start;
    }

    .add-comment-row mat-form-field {
      flex: 1;
    }

    .load-more-container {
      display: flex;
      justify-content: center;
      margin-top: 16px;
    }

    .empty-feed {
      text-align: center;
      padding: 48px 16px;
      color: var(--color-text-muted, #9e9e9e);

      mat-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        margin-bottom: 12px;
        color: var(--color-text-muted, #9e9e9e);
      }

      p {
        font-size: 14px;
        margin: 0;
      }
    }

    .loading-spinner {
      display: flex;
      justify-content: center;
      padding: 24px;
    }
  `,
  template: `
    <div class="feed-header">
      <mat-icon>dynamic_feed</mat-icon>
      <h1>Feed</h1>
    </div>

    <app-feed-post-form (postCreated)="onPostCreated($event)" />

    @if (store.isLoading() && store.items().length === 0) {
      <div class="loading-spinner">
        <mat-spinner diameter="36"></mat-spinner>
      </div>
    } @else if (store.items().length === 0) {
      <div class="empty-feed">
        <mat-icon>dynamic_feed</mat-icon>
        <p>No feed items yet. Be the first to post!</p>
      </div>
    } @else {
      <div class="feed-items">
        @for (item of store.items(); track item.id) {
          <mat-card class="feed-item-card" appearance="outlined">
            <div class="feed-item-header">
              <div class="feed-author-avatar">{{ getInitials(item.authorName) }}</div>
              <div class="feed-author-info">
                <span class="feed-author-name">{{ item.authorName }}</span>
                <span class="feed-time">{{ getRelativeTime(item.createdAt) }}</span>
              </div>
              <mat-icon class="feed-type-icon"
                        [class.system-event]="item.type === 'SystemEvent'"
                        [class.social-post]="item.type === 'SocialPost'">
                {{ item.type === 'SystemEvent' ? 'auto_awesome' : 'chat' }}
              </mat-icon>
            </div>

            <div class="feed-item-content">{{ item.content }}</div>

            @if (item.entityType && item.entityId) {
              <a class="feed-entity-link"
                 [matTooltip]="getEntityTooltip(item)"
                 matTooltipShowDelay="300"
                 (click)="onEntityClick($event, item)"
                 (auxclick)="onEntityMiddleClick($event, item)">
                <mat-icon class="entity-link-icon">{{ getEntityIcon(item.entityType) }}</mat-icon>
                {{ item.entityName || ('View ' + item.entityType) }}
              </a>
            }

            <div class="feed-item-actions">
              <button class="action-btn" (click)="toggleComments(item.id)">
                <mat-icon>comment</mat-icon>
                {{ item.commentCount }}{{ item.commentCount === 1 ? ' comment' : ' comments' }}
              </button>
              @if (canDelete(item)) {
                <button class="action-btn" (click)="deleteItem(item.id)">
                  <mat-icon>delete_outline</mat-icon>
                  Delete
                </button>
              }
            </div>

            @if (expandedComments().has(item.id)) {
              <div class="comments-section">
                @if (store.selectedItem()?.id === item.id) {
                  @for (comment of store.comments(); track comment.id) {
                    <div class="comment-item">
                      <div class="comment-avatar">{{ getInitials(comment.authorName) }}</div>
                      <div class="comment-body">
                        <span class="comment-author">{{ comment.authorName }}</span>
                        <span class="comment-time">{{ getRelativeTime(comment.createdAt) }}</span>
                        <div class="comment-text">{{ comment.content }}</div>
                      </div>
                    </div>
                  }
                }

                <div class="add-comment-row">
                  <div class="comment-avatar">{{ currentUserInitials }}</div>
                  <mat-form-field appearance="outline" subscriptSizing="dynamic">
                    <input matInput
                           placeholder="Write a comment..."
                           [ngModel]="commentTexts()[item.id] || ''"
                           (ngModelChange)="setCommentText(item.id, $event)"
                           (keydown.enter)="submitComment(item.id)" />
                  </mat-form-field>
                  <button mat-icon-button
                          color="primary"
                          [disabled]="!(commentTexts()[item.id]?.trim())"
                          (click)="submitComment(item.id)">
                    <mat-icon>send</mat-icon>
                  </button>
                </div>
              </div>
            }
          </mat-card>
        }
      </div>

      @if (store.items().length < store.total()) {
        <div class="load-more-container">
          <button mat-stroked-button
                  [disabled]="store.isLoading()"
                  (click)="store.loadMore()">
            @if (store.isLoading()) {
              Loading...
            } @else {
              Load more
            }
          </button>
        </div>
      }
    }
  `,
})
export class FeedListComponent implements OnInit, OnDestroy {
  readonly store = inject(FeedStore);
  readonly previewStore = inject(PreviewSidebarStore);
  private readonly signalRService = inject(SignalRService);
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);

  /** Track which items have expanded comment sections. */
  readonly expandedComments = signal(new Set<string>());

  /** Track comment text per feed item. */
  readonly commentTexts = signal<Record<string, string>>({});

  private feedUpdateSub?: Subscription;
  private feedCommentSub?: Subscription;

  get currentUserInitials(): string {
    const user = this.authStore.user();
    if (!user) return '';
    const first = user.firstName?.charAt(0) ?? '';
    const last = user.lastName?.charAt(0) ?? '';
    return (first + last).toUpperCase();
  }

  ngOnInit(): void {
    this.store.loadFeed();

    // Real-time: new feed items
    this.feedUpdateSub = this.signalRService.feedUpdate$.subscribe((item) => {
      this.store.prependItem(item as FeedItemDto);
    });

    // Real-time: comment count updates
    this.feedCommentSub = this.signalRService.feedComment$.subscribe((event: any) => {
      if (event?.feedItemId) {
        const currentItems = this.store.items();
        const updatedItems = currentItems.map((i) =>
          i.id === event.feedItemId
            ? { ...i, commentCount: i.commentCount + 1 }
            : i,
        );
        // We cannot patchState directly from outside the store, but prependItem pattern shows
        // the store is the source of truth. For comment count, we rely on the store's addComment
        // which already updates count. Real-time FeedCommentAdded just tells us someone else commented.
        // For simplicity, reload the items from the server on external comment events.
        // Or since we track items in the store, we can re-load just the count.
        // Actually, the simplest approach: if the comment is for an item we have expanded, reload it.
        if (this.expandedComments().has(event.feedItemId) &&
            this.store.selectedItem()?.id === event.feedItemId) {
          this.store.loadFeedItem(event.feedItemId);
        }
      }
    });
  }

  ngOnDestroy(): void {
    this.feedUpdateSub?.unsubscribe();
    this.feedCommentSub?.unsubscribe();
  }

  onPostCreated(content: string): void {
    this.store.createPost(content);
  }

  /** Toggle the inline comment section for a feed item. */
  toggleComments(itemId: string): void {
    const expanded = new Set(this.expandedComments());
    if (expanded.has(itemId)) {
      expanded.delete(itemId);
    } else {
      expanded.add(itemId);
      // Load the feed item with comments when expanding
      this.store.loadFeedItem(itemId);
    }
    this.expandedComments.set(expanded);
  }

  /** Set comment text for a specific feed item. */
  setCommentText(itemId: string, text: string): void {
    this.commentTexts.set({ ...this.commentTexts(), [itemId]: text });
  }

  /** Submit a comment for a feed item. */
  submitComment(itemId: string): void {
    const text = this.commentTexts()[itemId]?.trim();
    if (!text) return;

    this.store.addComment(itemId, text);
    this.setCommentText(itemId, '');
  }

  /** Handle entity link click -- normal click opens preview, Ctrl/Cmd+click navigates to detail. */
  onEntityClick(event: MouseEvent, item: FeedItemDto): void {
    if (!item.entityType || !item.entityId) return;

    // Ctrl/Cmd+click: navigate to full detail page
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      const route = getEntityRoute(item.entityType, item.entityId);
      this.router.navigateByUrl(route);
      return;
    }

    // Normal click: open preview sidebar
    this.previewStore.open({
      entityType: item.entityType,
      entityId: item.entityId,
      entityName: item.entityName ?? undefined,
    });
  }

  /** Handle middle-click to open in new tab (standard browser behavior). */
  onEntityMiddleClick(event: MouseEvent, item: FeedItemDto): void {
    if (event.button === 1 && item.entityType && item.entityId) {
      const route = getEntityRoute(item.entityType, item.entityId);
      window.open(route, '_blank');
    }
  }

  /** Get tooltip text for entity link hover (no API call -- uses data from feed item). */
  getEntityTooltip(item: FeedItemDto): string {
    const config = getEntityConfig(item.entityType ?? '');
    const name = item.entityName || item.entityType || '';
    return config ? `${config.label}: ${name}` : name;
  }

  /** Get Material icon for entity type from registry. */
  getEntityIcon(entityType: string | null): string {
    if (!entityType) return 'open_in_new';
    return getEntityConfig(entityType)?.icon ?? 'open_in_new';
  }

  /** Check if the current user can delete this item. */
  canDelete(item: FeedItemDto): boolean {
    const user = this.authStore.user();
    if (!user) return false;
    return item.authorId === user.id || user.role === 'Admin';
  }

  deleteItem(id: string): void {
    this.store.deleteFeedItem(id);
  }

  /** Get initials from a name string. */
  getInitials(name: string): string {
    if (!name) return '';
    const parts = name.trim().split(/\s+/);
    const first = parts[0]?.charAt(0) ?? '';
    const last = parts.length > 1 ? parts[parts.length - 1]?.charAt(0) ?? '' : '';
    return (first + last).toUpperCase();
  }

  /** Get relative time string from a date string. */
  getRelativeTime(dateStr: string): string {
    if (!dateStr) return '';
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diffMs = now - then;
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSeconds < 60) return 'just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(dateStr));
  }
}

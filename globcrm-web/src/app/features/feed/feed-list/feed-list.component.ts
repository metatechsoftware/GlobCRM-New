import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  OnDestroy,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subscription } from 'rxjs';
import { FeedStore } from '../feed.store';
import { FeedItemDto, FeedItemType, CreateFeedPostPayload } from '../feed.models';
import { FeedPostFormComponent } from '../feed-post-form/feed-post-form.component';
import { RenderMentionsPipe } from '../mention-render.pipe';
import { SignalRService } from '../../../core/signalr/signalr.service';
import { AuthStore } from '../../../core/auth/auth.store';
import { PreviewSidebarStore } from '../../../shared/stores/preview-sidebar.store';
import { getEntityConfig, getEntityRoute } from '../../../shared/services/entity-type-registry';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';
import { UserPreviewService } from '../../../shared/services/user-preview.service';

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
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    FeedPostFormComponent,
    RenderMentionsPipe,
    AvatarComponent,
  ],
  providers: [FeedStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    /* ── Keyframe Animations ── */
    @keyframes feedCardEnter {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes commentEnter {
      from {
        opacity: 0;
        transform: translateX(-6px);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }

    @keyframes shimmer {
      0% { background-position: -400px 0; }
      100% { background-position: 400px 0; }
    }

    @keyframes emptyFloat {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-8px); }
    }

    /* ── Host ── */
    :host {
      display: block;
      max-width: 680px;
      margin: 0 auto;
      padding: 24px 16px;
    }

    /* ── Hero Gradient Bar ── */
    .hero-accent {
      height: 3px;
      border-radius: var(--radius-full, 9999px);
      background: linear-gradient(90deg, var(--color-primary, #F97316), var(--color-secondary, #8B5CF6));
      margin-bottom: 20px;
    }

    /* ── Page Header ── */
    .feed-header {
      display: flex;
      align-items: center;
      gap: 14px;
      margin-bottom: 24px;
    }

    .list-header__icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      border-radius: var(--radius-lg, 12px);
      background: var(--color-primary-soft, #FFF7ED);
      color: var(--color-primary, #F97316);
      flex-shrink: 0;

      mat-icon {
        font-size: 22px;
        width: 22px;
        height: 22px;
      }
    }

    .feed-header-text {
      display: flex;
      flex-direction: column;
      gap: 2px;

      h1 {
        font-size: var(--text-2xl, 1.5rem);
        font-weight: var(--font-semibold, 600);
        color: var(--color-text, #1a1a1a);
        margin: 0;
        line-height: var(--leading-tight, 1.25);
      }

      .feed-subtitle {
        font-size: var(--text-sm, 0.8125rem);
        color: var(--color-text-muted, #9CA3AF);
      }
    }

    /* ── Skeleton Loading ── */
    .skeleton-container {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .skeleton-card {
      padding: 16px;
      border-radius: var(--radius-lg, 12px);
      border: 1px solid var(--color-border-subtle, #F0F0EE);
      background: var(--color-surface, #fff);
    }

    .skeleton-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 12px;
    }

    .skeleton-avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: linear-gradient(90deg, var(--color-bg-secondary, #F0F0EE) 25%, var(--color-surface-hover, #F7F7F5) 50%, var(--color-bg-secondary, #F0F0EE) 75%);
      background-size: 800px 100%;
      animation: shimmer 1.5s infinite linear;
    }

    .skeleton-lines {
      display: flex;
      flex-direction: column;
      gap: 6px;
      flex: 1;
    }

    .skeleton-line {
      height: 10px;
      border-radius: var(--radius-sm, 4px);
      background: linear-gradient(90deg, var(--color-bg-secondary, #F0F0EE) 25%, var(--color-surface-hover, #F7F7F5) 50%, var(--color-bg-secondary, #F0F0EE) 75%);
      background-size: 800px 100%;
      animation: shimmer 1.5s infinite linear;
    }

    .skeleton-line--short { width: 40%; }
    .skeleton-line--medium { width: 70%; }
    .skeleton-line--long { width: 90%; }

    .skeleton-body {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .skeleton-body-line {
      height: 12px;
      border-radius: var(--radius-sm, 4px);
      background: linear-gradient(90deg, var(--color-bg-secondary, #F0F0EE) 25%, var(--color-surface-hover, #F7F7F5) 50%, var(--color-bg-secondary, #F0F0EE) 75%);
      background-size: 800px 100%;
      animation: shimmer 1.5s infinite linear;
    }

    /* ── Empty State ── */
    .empty-feed {
      text-align: center;
      padding: 56px 16px;
    }

    .empty-icon-wrap {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 72px;
      height: 72px;
      border-radius: 50%;
      background: var(--color-primary-soft, #FFF7ED);
      margin-bottom: 16px;
      animation: emptyFloat 3s ease-in-out infinite;

      mat-icon {
        font-size: 36px;
        width: 36px;
        height: 36px;
        color: var(--color-primary, #F97316);
      }
    }

    .empty-title {
      font-size: var(--text-lg, 1.125rem);
      font-weight: var(--font-semibold, 600);
      color: var(--color-text, #1a1a1a);
      margin: 0 0 6px;
    }

    .empty-description {
      font-size: var(--text-base, 0.875rem);
      color: var(--color-text-muted, #9CA3AF);
      margin: 0;
      max-width: 320px;
      margin-left: auto;
      margin-right: auto;
      line-height: var(--leading-relaxed, 1.625);
    }

    /* ── Feed Items List ── */
    .feed-items {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    /* ── Feed Item Card ── */
    .feed-item-card {
      padding: 16px;
      border-radius: var(--radius-lg, 12px);
      border: 1px solid var(--color-border-subtle, #F0F0EE);
      background: var(--color-surface, #fff);
      transition:
        box-shadow var(--duration-normal, 200ms) var(--ease-default),
        transform var(--duration-normal, 200ms) var(--ease-default),
        border-color var(--duration-normal, 200ms) var(--ease-default);
      animation: feedCardEnter var(--duration-slow, 300ms) var(--ease-out) both;
      animation-delay: calc(var(--item-index, 0) * 40ms);
    }

    .feed-item-card:hover {
      box-shadow: inset 3px 0 0 var(--color-primary, #F97316), var(--shadow-md);
      transform: translateY(-1px);
    }

    .feed-item-card--system {
      background: linear-gradient(135deg, var(--color-bg-secondary, #F0F0EE) 0%, var(--color-surface, #fff) 100%);
    }

    .feed-item-card--system:hover {
      box-shadow: inset 3px 0 0 var(--color-text-muted, #9CA3AF), var(--shadow-sm);
    }

    .feed-item-card--social {
      background: var(--color-surface, #fff);
    }

    /* ── Feed Item Header ── */
    .feed-item-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 10px;
    }

    .feed-author-info {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .feed-author-name {
      font-size: var(--text-base, 0.875rem);
      font-weight: var(--font-semibold, 600);
      color: var(--color-text, #1a1a1a);
    }

    .feed-time {
      font-size: var(--text-xs, 0.75rem);
      color: var(--color-text-muted, #9CA3AF);
    }

    /* ── Type Badge ── */
    .feed-type-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 10px;
      border-radius: var(--radius-full, 9999px);
      font-size: var(--text-xs, 0.75rem);
      font-weight: var(--font-medium, 500);
      letter-spacing: 0.3px;

      mat-icon {
        font-size: 14px;
        width: 14px;
        height: 14px;
      }
    }

    .feed-type-badge--system {
      background: var(--color-bg-secondary, #F0F0EE);
      color: var(--color-text-secondary, #6B7280);
    }

    .feed-type-badge--social {
      background: var(--color-primary-soft, #FFF7ED);
      color: var(--color-primary-text, #C2410C);
    }

    /* ── Feed Content ── */
    .feed-item-content {
      font-size: var(--text-base, 0.875rem);
      line-height: var(--leading-relaxed, 1.625);
      color: var(--color-text, #1a1a1a);
      margin-bottom: 10px;
      white-space: pre-wrap;
      word-wrap: break-word;
    }

    /* ── Mention Chip Overrides ── */
    :host ::ng-deep .mention-chip {
      display: inline;
      padding: 1px 6px;
      border-radius: var(--radius-sm, 4px);
      font-weight: var(--font-medium, 500);
      font-size: var(--text-sm, 0.8125rem);
      cursor: pointer;
      transition: background var(--duration-fast, 100ms), color var(--duration-fast, 100ms), box-shadow var(--duration-fast, 100ms);
    }

    :host ::ng-deep .mention-user {
      background: var(--color-primary-soft, #FFF7ED);
      color: var(--color-primary, #F97316);
    }

    :host ::ng-deep .mention-user:hover {
      background: var(--color-primary, #F97316);
      color: #fff;
      box-shadow: var(--shadow-xs);
    }

    :host ::ng-deep .mention-entity {
      background: var(--color-info-soft, #EFF6FF);
      color: var(--color-info, #3B82F6);
      border: 1px solid transparent;
    }

    :host ::ng-deep .mention-entity:hover {
      background: var(--color-info, #3B82F6);
      color: #fff;
      border-color: var(--color-info, #3B82F6);
      box-shadow: var(--shadow-xs);
    }

    /* ── Entity Link Chip ── */
    .feed-entity-link {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: var(--radius-md, 8px);
      border: 1px solid var(--color-border, #E8E8E6);
      background: var(--color-surface, #fff);
      color: var(--color-text, #1a1a1a);
      text-decoration: none;
      cursor: pointer;
      font-size: var(--text-sm, 0.8125rem);
      font-weight: var(--font-medium, 500);
      margin-bottom: 8px;
      transition:
        border-color var(--duration-fast, 100ms),
        box-shadow var(--duration-fast, 100ms),
        background var(--duration-fast, 100ms);

      &:hover {
        border-color: var(--color-primary, #F97316);
        box-shadow: var(--shadow-xs);
        background: var(--color-primary-soft, #FFF7ED);
      }

      .entity-link-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
      }

      .entity-link-arrow {
        font-size: 14px;
        width: 14px;
        height: 14px;
        color: var(--color-text-muted, #9CA3AF);
      }
    }

    /* ── Attachments ── */
    .feed-attachments {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: var(--text-xs, 0.75rem);
      color: var(--color-text-muted, #9CA3AF);
      margin-bottom: 8px;

      mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
      }
    }

    /* ── Action Buttons ── */
    .feed-item-actions {
      display: flex;
      align-items: center;
      gap: 12px;
      padding-top: 8px;
      border-top: 1px solid var(--color-border-subtle, #F0F0EE);
    }

    .action-btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: var(--text-sm, 0.8125rem);
      color: var(--color-text-secondary, #6B7280);
      cursor: pointer;
      background: none;
      border: none;
      padding: 4px 10px;
      border-radius: var(--radius-md, 8px);
      transition:
        background var(--duration-fast, 100ms),
        color var(--duration-fast, 100ms),
        transform var(--duration-fast, 100ms);

      &:hover {
        background: var(--color-highlight, rgba(249, 115, 22, 0.06));
        color: var(--color-text, #1a1a1a);
      }

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
    }

    .action-btn--active {
      background: var(--color-primary-soft, #FFF7ED);
      color: var(--color-primary, #F97316);
    }

    .action-btn--danger:hover {
      background: var(--color-danger-soft, #FEF2F2);
      color: var(--color-danger, #EF4444);
    }

    /* ── Comments Section ── */
    .comments-section {
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid var(--color-border-subtle, #F0F0EE);
    }

    .comment-item {
      display: flex;
      gap: 8px;
      margin-bottom: 10px;
      animation: commentEnter var(--duration-slow, 300ms) var(--ease-out) both;
      animation-delay: calc(var(--comment-index, 0) * 30ms);
    }

    .comment-bubble {
      flex: 1;
      background: var(--color-bg-secondary, #F0F0EE);
      border-radius: var(--radius-lg, 12px);
      border-top-left-radius: var(--radius-sm, 4px);
      padding: 8px 12px;
    }

    .comment-author {
      font-size: var(--text-sm, 0.8125rem);
      font-weight: var(--font-semibold, 600);
      color: var(--color-text, #1a1a1a);
    }

    .comment-time {
      font-size: 11px;
      color: var(--color-text-muted, #9CA3AF);
      margin-left: 6px;
    }

    .comment-text {
      font-size: var(--text-sm, 0.8125rem);
      line-height: var(--leading-normal, 1.5);
      color: var(--color-text, #1a1a1a);
      margin-top: 2px;
    }

    /* ── Comment Input ── */
    .add-comment-row {
      display: flex;
      gap: 8px;
      margin-top: 8px;
      align-items: center;
    }

    .comment-input-wrap {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border-radius: var(--radius-full, 9999px);
      border: 1px solid var(--color-border, #E8E8E6);
      background: var(--color-surface, #fff);
      transition:
        border-color var(--duration-fast, 100ms),
        box-shadow var(--duration-fast, 100ms);

      &:focus-within {
        border-color: var(--color-border-focus, #F97316);
        box-shadow: var(--shadow-focus);
      }
    }

    .comment-input {
      flex: 1;
      border: none;
      outline: none;
      background: transparent;
      font-size: var(--text-sm, 0.8125rem);
      color: var(--color-text, #1a1a1a);
      font-family: inherit;

      &::placeholder {
        color: var(--color-text-muted, #9CA3AF);
      }
    }

    .comment-send-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      border: none;
      background: var(--color-primary, #F97316);
      color: var(--color-primary-fg, #fff);
      cursor: pointer;
      flex-shrink: 0;
      transition:
        transform var(--duration-fast, 100ms) var(--ease-spring),
        box-shadow var(--duration-fast, 100ms);

      &:hover {
        transform: scale(1.08);
        box-shadow: 0 2px 8px rgba(249, 115, 22, 0.35);
      }

      &:active {
        transform: scale(0.94);
      }

      &:disabled {
        opacity: 0.4;
        cursor: default;
        transform: none;
        box-shadow: none;
      }

      mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
      }
    }

    /* ── Load More ── */
    .load-more-container {
      display: flex;
      justify-content: center;
      margin-top: 20px;
    }

    .load-more-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 24px;
      border-radius: var(--radius-full, 9999px);
      border: 1px solid var(--color-border, #E8E8E6);
      background: var(--color-surface, #fff);
      color: var(--color-text-secondary, #6B7280);
      font-size: var(--text-sm, 0.8125rem);
      font-weight: var(--font-medium, 500);
      cursor: pointer;
      transition:
        border-color var(--duration-fast, 100ms),
        color var(--duration-fast, 100ms),
        box-shadow var(--duration-fast, 100ms);

      &:hover:not(:disabled) {
        border-color: var(--color-primary, #F97316);
        color: var(--color-primary, #F97316);
        box-shadow: var(--shadow-xs);
      }

      &:disabled {
        opacity: 0.5;
        cursor: default;
      }
    }

    /* ── Clickable Author Names ── */
    .feed-author-name--clickable {
      cursor: pointer;
      transition: color var(--duration-fast, 100ms);

      &:hover {
        color: var(--color-primary, #F97316);
      }
    }

    .comment-author--clickable {
      cursor: pointer;

      &:hover {
        color: var(--color-primary, #F97316);
      }
    }

    /* ── Reduced Motion ── */
    @media (prefers-reduced-motion: reduce) {
      .feed-item-card {
        animation: none;
      }
      .comment-item {
        animation: none;
      }
      .empty-icon-wrap {
        animation: none;
      }
      .skeleton-avatar,
      .skeleton-line,
      .skeleton-body-line {
        animation: none;
      }
    }
  `,
  template: `
    <div class="hero-accent"></div>

    <div class="feed-header">
      <div class="list-header__icon">
        <mat-icon>dynamic_feed</mat-icon>
      </div>
      <div class="feed-header-text">
        <h1>Team Feed</h1>
        <span class="feed-subtitle">Activity and updates from your team</span>
      </div>
    </div>

    <app-feed-post-form (postCreated)="onPostCreated($event)" />

    @if (store.isLoading() && store.items().length === 0) {
      <div class="skeleton-container">
        @for (i of [1, 2, 3]; track i) {
          <div class="skeleton-card">
            <div class="skeleton-header">
              <div class="skeleton-avatar"></div>
              <div class="skeleton-lines">
                <div class="skeleton-line skeleton-line--medium"></div>
                <div class="skeleton-line skeleton-line--short"></div>
              </div>
            </div>
            <div class="skeleton-body">
              <div class="skeleton-body-line skeleton-line--long"></div>
              <div class="skeleton-body-line skeleton-line--medium"></div>
            </div>
          </div>
        }
      </div>
    } @else if (store.items().length === 0) {
      <div class="empty-feed">
        <div class="empty-icon-wrap">
          <mat-icon>dynamic_feed</mat-icon>
        </div>
        <p class="empty-title">No activity yet</p>
        <p class="empty-description">Share an update, celebrate a win, or tag a colleague to get the conversation started.</p>
      </div>
    } @else {
      <div class="feed-items">
        @for (item of store.items(); track item.id; let i = $index) {
          <div class="feed-item-card"
               [class.feed-item-card--system]="item.type === 'SystemEvent'"
               [class.feed-item-card--social]="item.type === 'SocialPost'"
               [style.--item-index]="i">
            <div class="feed-item-header">
              <app-avatar
                [avatarUrl]="item.authorAvatarUrl"
                [firstName]="getFirstName(item.authorName)"
                [lastName]="getLastName(item.authorName)"
                size="sm" />
              <div class="feed-author-info">
                <span class="feed-author-name feed-author-name--clickable"
                      (click)="onAuthorClick($event, item)">{{ item.authorName }}</span>
                <span class="feed-time">{{ getRelativeTime(item.createdAt) }}</span>
              </div>
              <span class="feed-type-badge"
                    [class.feed-type-badge--system]="item.type === 'SystemEvent'"
                    [class.feed-type-badge--social]="item.type === 'SocialPost'">
                <mat-icon>{{ item.type === 'SystemEvent' ? 'auto_awesome' : 'chat' }}</mat-icon>
                {{ item.type === 'SystemEvent' ? 'Activity' : 'Post' }}
              </span>
            </div>

            <div class="feed-item-content"
                 [innerHTML]="item.content | renderMentions"
                 (click)="onContentClick($event)"></div>

            @if (item.entityType && item.entityId) {
              <a class="feed-entity-link"
                 [matTooltip]="getEntityTooltip(item)"
                 matTooltipShowDelay="300"
                 (click)="onEntityClick($event, item)"
                 (auxclick)="onEntityMiddleClick($event, item)">
                <mat-icon class="entity-link-icon" [style.color]="getEntityColor(item.entityType)">{{ getEntityIcon(item.entityType) }}</mat-icon>
                {{ item.entityName || ('View ' + item.entityType) }}
                <mat-icon class="entity-link-arrow">chevron_right</mat-icon>
              </a>
            }

            @if (item.attachmentCount > 0) {
              <div class="feed-attachments">
                <mat-icon>attach_file</mat-icon>
                {{ item.attachmentCount }} attachment{{ item.attachmentCount !== 1 ? 's' : '' }}
              </div>
            }

            <div class="feed-item-actions">
              <button class="action-btn"
                      [class.action-btn--active]="expandedComments().has(item.id)"
                      (click)="toggleComments(item.id)">
                <mat-icon>comment</mat-icon>
                {{ item.commentCount }}{{ item.commentCount === 1 ? ' comment' : ' comments' }}
              </button>
              @if (canDelete(item)) {
                <button class="action-btn action-btn--danger" (click)="deleteItem(item.id)">
                  <mat-icon>delete_outline</mat-icon>
                  Delete
                </button>
              }
            </div>

            @if (expandedComments().has(item.id)) {
              <div class="comments-section">
                @if (store.selectedItem()?.id === item.id) {
                  @for (comment of store.comments(); track comment.id; let ci = $index) {
                    <div class="comment-item" [style.--comment-index]="ci">
                      <app-avatar
                        [avatarUrl]="comment.authorAvatarUrl"
                        [firstName]="getFirstName(comment.authorName)"
                        [lastName]="getLastName(comment.authorName)"
                        size="sm" />
                      <div class="comment-bubble">
                        <span class="comment-author comment-author--clickable"
                              (click)="onAuthorClick($event, { authorId: comment.authorId, authorName: comment.authorName })">{{ comment.authorName }}</span>
                        <span class="comment-time">{{ getRelativeTime(comment.createdAt) }}</span>
                        <div class="comment-text">{{ comment.content }}</div>
                      </div>
                    </div>
                  }
                }

                <div class="add-comment-row">
                  <app-avatar
                    [firstName]="currentUserFirstName"
                    [lastName]="currentUserLastName"
                    size="sm" />
                  <div class="comment-input-wrap">
                    <input class="comment-input"
                           placeholder="Write a comment..."
                           [value]="commentTexts()[item.id] || ''"
                           (input)="setCommentText(item.id, $any($event.target).value)"
                           (keydown.enter)="submitComment(item.id)" />
                    <button class="comment-send-btn"
                            [disabled]="!(commentTexts()[item.id]?.trim())"
                            (click)="submitComment(item.id)">
                      <mat-icon>send</mat-icon>
                    </button>
                  </div>
                </div>
              </div>
            }
          </div>
        }
      </div>

      @if (store.items().length < store.total()) {
        <div class="load-more-container">
          <button class="load-more-btn"
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
  private readonly userPreviewService = inject(UserPreviewService);

  /** Track which items have expanded comment sections. */
  readonly expandedComments = signal(new Set<string>());

  /** Track comment text per feed item. */
  readonly commentTexts = signal<Record<string, string>>({});

  private feedUpdateSub?: Subscription;
  private feedCommentSub?: Subscription;

  get currentUserFirstName(): string {
    return this.authStore.user()?.firstName ?? '';
  }

  get currentUserLastName(): string {
    return this.authStore.user()?.lastName ?? '';
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

  onPostCreated(payload: CreateFeedPostPayload): void {
    this.store.createPost(payload);
  }

  /** Handle clicks on rendered mention chips inside feed content. */
  onContentClick(event: Event): void {
    const target = event.target as HTMLElement;
    if (!target.classList.contains('mention-chip')) return;

    const entityType = target.getAttribute('data-entity-type');
    const entityId = target.getAttribute('data-entity-id');
    if (!entityType || !entityId) return;

    if (entityType === 'User') {
      // For user mentions, navigate to team directory or do nothing special
      return;
    }

    // Stop propagation so the mat-sidenav-content click handler doesn't close the sidebar
    event.stopPropagation();

    // Open preview sidebar for entity mentions
    this.previewStore.open({
      entityType,
      entityId,
    });
  }

  /** Open user preview popover when clicking an author name. */
  onAuthorClick(event: MouseEvent, item: { authorId?: string; authorName: string }): void {
    event.stopPropagation();
    if (!item.authorId) return;

    const target = event.target as HTMLElement;
    this.userPreviewService.open(
      { userId: item.authorId, userName: item.authorName },
      target
    );
  }

  /** Toggle the inline comment section for a feed item. */
  toggleComments(itemId: string): void {
    const expanded = new Set(this.expandedComments());
    if (expanded.has(itemId)) {
      expanded.delete(itemId);
    } else {
      expanded.add(itemId);
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

    // Stop propagation so the mat-sidenav-content click handler doesn't close the sidebar
    event.stopPropagation();

    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      const route = getEntityRoute(item.entityType, item.entityId);
      this.router.navigateByUrl(route);
      return;
    }

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

  /** Get tooltip text for entity link hover. */
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

  /** Get color for entity type icon from registry. */
  getEntityColor(entityType: string | null): string | null {
    if (!entityType) return null;
    return getEntityConfig(entityType)?.color ?? null;
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

  /** Get the first name from a full name string. */
  getFirstName(name: string): string {
    if (!name) return '';
    return name.trim().split(/\s+/)[0] ?? '';
  }

  /** Get the last name from a full name string. */
  getLastName(name: string): string {
    if (!name) return '';
    const parts = name.trim().split(/\s+/);
    return parts.length > 1 ? parts[parts.length - 1] ?? '' : '';
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

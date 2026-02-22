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
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
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
    TranslocoPipe,
  ],
  providers: [FeedStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    /* ── Keyframe Animations ── */
    @keyframes timelineSlideIn {
      from {
        opacity: 0;
        transform: translateX(-16px) translateY(6px);
      }
      to {
        opacity: 1;
        transform: translateX(0) translateY(0);
      }
    }

    @keyframes commentCascade {
      from {
        opacity: 0;
        transform: scale(0.96) translateY(4px);
      }
      to {
        opacity: 1;
        transform: scale(1) translateY(0);
      }
    }

    @keyframes shimmer {
      0% { background-position: -400px 0; }
      100% { background-position: 400px 0; }
    }

    @keyframes emptyFloat {
      0%, 100% { transform: translateY(0) scale(1); }
      50% { transform: translateY(-8px) scale(1.03); }
    }

    @keyframes timelinePulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(249, 115, 22, 0.4); }
      50% { box-shadow: 0 0 0 6px rgba(249, 115, 22, 0); }
    }

    /* ── Host ── */
    :host {
      display: block;
      max-width: 680px;
      margin: 0 auto;
      padding: 24px 16px;
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
      box-shadow: var(--shadow-sm);

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
        font-size: var(--text-3xl, 1.875rem);
        font-weight: var(--font-bold, 700);
        color: var(--color-text, #1a1a1a);
        margin: 0;
        line-height: var(--leading-tight, 1.25);
        letter-spacing: var(--tracking-tight, -0.02em);
      }

      .feed-subtitle {
        font-size: var(--text-sm, 0.8125rem);
        color: var(--color-text-muted, #9CA3AF);
      }
    }

    .feed-header-overline {
      font-family: var(--font-mono, 'JetBrains Mono', monospace);
      font-size: 0.6rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--color-primary, #F97316);
    }

    /* ── Skeleton Loading ── */
    .skeleton-container {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .skeleton-timeline-item {
      display: flex;
      gap: 14px;
    }

    .skeleton-node {
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 20px;
      flex-shrink: 0;
    }

    .skeleton-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: linear-gradient(90deg, var(--color-bg-secondary, #F0F0EE) 25%, var(--color-surface-hover, #F7F7F5) 50%, var(--color-bg-secondary, #F0F0EE) 75%);
      background-size: 800px 100%;
      animation: shimmer 1.5s infinite linear;
      flex-shrink: 0;
    }

    .skeleton-connector {
      flex: 1;
      width: 2px;
      background: var(--color-border-subtle, #F0F0EE);
      margin-top: 4px;
    }

    .skeleton-card {
      flex: 1;
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
      padding: 72px 16px;
    }

    .empty-icon-wrap {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 88px;
      height: 88px;
      border-radius: 50%;
      background: var(--color-primary-soft, #FFF7ED);
      margin-bottom: 16px;
      animation: emptyFloat 3s ease-in-out infinite;
      box-shadow: 0 0 40px var(--orange-glow, rgba(249,115,22,0.12)), 0 0 80px var(--orange-glow, rgba(249,115,22,0.12));

      mat-icon {
        font-size: 42px;
        width: 42px;
        height: 42px;
        color: var(--color-primary, #F97316);
      }
    }

    .empty-title {
      font-family: var(--font-serif, 'Fraunces', serif);
      font-size: var(--text-2xl, 1.5rem);
      font-weight: 400;
      font-style: italic;
      color: var(--color-text, #1a1a1a);
      margin: 0 0 6px;
    }

    .empty-description {
      font-size: var(--text-base, 0.875rem);
      color: var(--color-text-muted, #9CA3AF);
      margin: 0;
      max-width: 360px;
      margin-left: auto;
      margin-right: auto;
      line-height: var(--leading-relaxed, 1.625);
    }

    /* ── Timeline Structure ── */
    .feed-timeline {
      display: flex;
      flex-direction: column;
    }

    .feed-timeline-item {
      display: flex;
      gap: 14px;
      animation: timelineSlideIn var(--duration-slow, 300ms) var(--ease-out) both;
      animation-delay: calc(var(--item-index, 0) * 50ms);
    }

    .timeline-node {
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 20px;
      flex-shrink: 0;
      padding-top: 20px;
    }

    .timeline-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      flex-shrink: 0;
      transition: transform 0.25s var(--ease-default, cubic-bezier(0.4, 0, 0.2, 1));
    }

    .timeline-dot--social {
      background: var(--color-primary, #F97316);
      box-shadow: 0 0 8px var(--orange-glow, rgba(249,115,22,0.12));
    }

    .timeline-dot--system {
      background: transparent;
      border: 2px solid var(--color-text-faint, #B0ACA7);
    }

    .timeline-dot--first {
      animation: timelinePulse 2s infinite;
    }

    .feed-timeline-item:hover .timeline-dot {
      transform: scale(1.3);
    }

    .feed-timeline-item:hover .timeline-dot--social {
      box-shadow: 0 0 14px rgba(249, 115, 22, 0.35);
    }

    .timeline-connector {
      flex: 1;
      width: 2px;
      background: var(--color-border-subtle, #F0F0EE);
      margin-top: 4px;
      min-height: 12px;
    }

    /* ── Feed Item Card ── */
    .feed-item-card {
      flex: 1;
      min-width: 0;
      padding: 16px;
      border-radius: var(--radius-lg, 12px);
      background: var(--color-surface, #fff);
      border: 1px solid var(--color-border-subtle, #F0F0EE);
      margin-bottom: 10px;
      transition:
        box-shadow 0.25s var(--ease-default, cubic-bezier(0.4, 0, 0.2, 1)),
        transform 0.25s var(--ease-default, cubic-bezier(0.4, 0, 0.2, 1)),
        border-color 0.25s var(--ease-default, cubic-bezier(0.4, 0, 0.2, 1)),
        background 0.25s var(--ease-default, cubic-bezier(0.4, 0, 0.2, 1));
    }

    .feed-item-card--social {
      padding: 18px 20px;
      border-radius: var(--radius-lg, 12px);
      border: 1px solid var(--color-border-subtle, #F0F0EE);
      background: var(--color-surface, #fff);
      margin-bottom: 12px;
    }

    .feed-item-card--social:hover {
      box-shadow: var(--shadow-md), var(--shadow-glow, 0 0 24px rgba(249,115,22,0.12));
      transform: translateY(-2px);
    }

    .feed-item-card--system {
      padding: 12px 16px 12px 18px;
      border-radius: 0;
      border: none;
      border-left: 2px solid var(--color-border-subtle, #F0F0EE);
      background: transparent;
      margin-bottom: 8px;
    }

    .feed-item-card--system:hover {
      border-left-color: var(--color-text-faint, #B0ACA7);
      background: var(--color-highlight, rgba(249, 115, 22, 0.06));
    }

    /* ── Feed Item Header ── */
    .feed-item-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 10px;
    }

    .feed-system-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: var(--color-bg-secondary, #F0F0EE);
      color: var(--color-text-muted, #9CA3AF);
      flex-shrink: 0;

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
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
      font-family: var(--font-mono, 'JetBrains Mono', monospace);
      font-size: var(--text-xs, 0.75rem);
      color: var(--color-text-faint, #B0ACA7);
      letter-spacing: var(--tracking-wide, 0.02em);
    }

    /* ── Type Badge ── */
    .feed-type-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 10px;
      border-radius: var(--radius-full, 9999px);
      font-family: var(--font-mono, 'JetBrains Mono', monospace);
      font-size: 0.6rem;
      font-weight: var(--font-medium, 500);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide, 0.02em);

      mat-icon {
        font-size: 14px;
        width: 14px;
        height: 14px;
      }
    }

    .feed-type-badge--system {
      background: var(--color-bg-secondary, #F0F0EE);
      color: var(--color-text-secondary, #6B7280);
      border: 1px solid var(--color-border-subtle, #F0F0EE);
    }

    .feed-type-badge--social {
      background: var(--color-primary-soft, #FFF7ED);
      color: var(--color-primary-text, #C2410C);
      border: 1px solid var(--orange-glow, rgba(249,115,22,0.12));
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
      background: var(--color-bg-secondary, #F0F0EE);
      color: var(--color-text, #1a1a1a);
      text-decoration: none;
      cursor: pointer;
      font-size: var(--text-sm, 0.8125rem);
      font-weight: var(--font-medium, 500);
      margin-bottom: 8px;
      transition:
        border-color var(--duration-fast, 100ms),
        box-shadow var(--duration-fast, 100ms),
        background var(--duration-fast, 100ms),
        transform var(--duration-fast, 100ms);

      &:hover {
        border-color: var(--color-primary, #F97316);
        box-shadow: var(--shadow-xs);
        background: var(--color-primary-soft, #FFF7ED);
        transform: translateX(2px);
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
        transition: color var(--duration-fast, 100ms), transform var(--duration-fast, 100ms);
      }

      &:hover .entity-link-arrow {
        color: var(--color-primary, #F97316);
        transform: translateX(2px);
      }
    }

    /* ── Attachments ── */
    .feed-attachments {
      display: flex;
      align-items: center;
      gap: 4px;
      font-family: var(--font-mono, 'JetBrains Mono', monospace);
      font-size: var(--text-xs, 0.75rem);
      color: var(--color-text-muted, #9CA3AF);
      letter-spacing: var(--tracking-wide, 0.02em);
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
        transform: scale(1.02);
      }

      &:active {
        transform: scale(0.97);
      }

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        transition: transform var(--duration-fast, 100ms);
      }

      &:hover mat-icon {
        transform: scale(1.1);
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
      position: relative;
      margin-top: 12px;
      padding-top: 12px;
      padding-left: 20px;
      border-top: 1px solid var(--color-border-subtle, #F0F0EE);
    }

    .comments-thread-line {
      position: absolute;
      left: 6px;
      top: 12px;
      bottom: 0;
      width: 2px;
      background: var(--color-border-subtle, #F0F0EE);
      border-radius: 1px;
    }

    .comment-item {
      display: flex;
      gap: 8px;
      margin-bottom: 10px;
      animation: commentCascade var(--duration-slow, 300ms) var(--ease-out) both;
      animation-delay: calc(var(--comment-index, 0) * 40ms);
    }

    .comment-bubble {
      flex: 1;
      background: var(--color-bg-secondary, #F0F0EE);
      border: 1px solid var(--color-border-subtle, #F0F0EE);
      border-radius: var(--radius-lg, 12px);
      border-top-left-radius: var(--radius-sm, 4px);
      padding: 8px 12px;
      transition: background var(--duration-fast, 100ms);

      &:hover {
        background: var(--color-surface-hover, #F7F7F5);
      }
    }

    .comment-author {
      font-size: var(--text-sm, 0.8125rem);
      font-weight: var(--font-semibold, 600);
      color: var(--color-text, #1a1a1a);
    }

    .comment-time {
      font-family: var(--font-mono, 'JetBrains Mono', monospace);
      font-size: 0.65rem;
      color: var(--color-text-faint, #B0ACA7);
      margin-left: 6px;
    }

    .comment-text {
      font-size: var(--text-sm, 0.8125rem);
      line-height: var(--leading-normal, 1.5);
      color: var(--color-text-secondary, #6B7280);
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
      margin-left: 36px;
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
      .feed-timeline-item {
        animation: none;
      }
      .feed-item-card--social:hover,
      .feed-item-card--system:hover {
        transform: none;
      }
      .timeline-dot--first {
        animation: none;
      }
      .feed-timeline-item:hover .timeline-dot {
        transform: none;
      }
      .comment-item {
        animation: none;
      }
      .empty-icon-wrap {
        animation: none;
      }
      .skeleton-avatar,
      .skeleton-line,
      .skeleton-body-line,
      .skeleton-dot {
        animation: none;
      }
      .action-btn:hover,
      .action-btn:active {
        transform: none;
      }
      .action-btn:hover mat-icon {
        transform: none;
      }
      .feed-entity-link:hover,
      .feed-entity-link:hover .entity-link-arrow {
        transform: none;
      }
    }
  `,
  template: `
    <div class="feed-header">
      <div class="list-header__icon">
        <mat-icon>dynamic_feed</mat-icon>
      </div>
      <div class="feed-header-text">
        <span class="feed-header-overline">{{ 'feed.list.overline' | transloco }}</span>
        <h1>{{ 'feed.list.title' | transloco }}</h1>
        <span class="feed-subtitle">{{ 'feed.list.subtitle' | transloco }}</span>
      </div>
    </div>

    <app-feed-post-form (postCreated)="onPostCreated($event)" />

    @if (store.isLoading() && store.items().length === 0) {
      <div class="skeleton-container">
        @for (i of [1, 2, 3]; track i) {
          <div class="skeleton-timeline-item">
            <div class="skeleton-node">
              <div class="skeleton-dot"></div>
              @if ($index < 2) {
                <div class="skeleton-connector"></div>
              }
            </div>
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
          </div>
        }
      </div>
    } @else if (store.items().length === 0) {
      <div class="empty-feed">
        <div class="empty-icon-wrap">
          <mat-icon>dynamic_feed</mat-icon>
        </div>
        <p class="empty-title">{{ 'feed.list.emptyTitle' | transloco }}</p>
        <p class="empty-description">{{ 'feed.list.emptyDescription' | transloco }}</p>
      </div>
    } @else {
      <div class="feed-timeline">
        @for (item of store.items(); track item.id; let i = $index; let last = $last) {
          <div class="feed-timeline-item" [style.--item-index]="i">
            <div class="timeline-node">
              <div class="timeline-dot"
                   [class.timeline-dot--social]="item.type === 'socialPost'"
                   [class.timeline-dot--system]="item.type === 'systemEvent'"
                   [class.timeline-dot--first]="i === 0 && item.type === 'socialPost'"></div>
              @if (!last) {
                <div class="timeline-connector"></div>
              }
            </div>
            <div class="feed-item-card"
                 [class.feed-item-card--system]="item.type === 'systemEvent'"
                 [class.feed-item-card--social]="item.type === 'socialPost'">
              <div class="feed-item-header">
                @if (item.authorName) {
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
                } @else {
                  <div class="feed-system-icon">
                    <mat-icon>auto_awesome</mat-icon>
                  </div>
                  <div class="feed-author-info">
                    <span class="feed-author-name">{{ 'feed.list.systemAuthor' | transloco }}</span>
                    <span class="feed-time">{{ getRelativeTime(item.createdAt) }}</span>
                  </div>
                }
                <span class="feed-type-badge"
                      [class.feed-type-badge--system]="item.type === 'systemEvent'"
                      [class.feed-type-badge--social]="item.type === 'socialPost'">
                  <mat-icon>{{ item.type === 'systemEvent' ? 'auto_awesome' : 'chat' }}</mat-icon>
                  {{ item.type === 'systemEvent' ? ('feed.list.activity' | transloco) : ('feed.list.post' | transloco) }}
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
                  {{ item.entityName || ('feed.list.viewEntity' | transloco: { entityType: item.entityType }) }}
                  <mat-icon class="entity-link-arrow">chevron_right</mat-icon>
                </a>
              }

              @if (item.attachmentCount > 0) {
                <div class="feed-attachments">
                  <mat-icon>attach_file</mat-icon>
                  {{ (item.attachmentCount !== 1 ? 'feed.list.attachments' : 'feed.list.attachment') | transloco: { count: item.attachmentCount } }}
                </div>
              }

              <div class="feed-item-actions">
                <button class="action-btn"
                        [class.action-btn--active]="expandedComments().has(item.id)"
                        (click)="toggleComments(item.id)">
                  <mat-icon>comment</mat-icon>
                  {{ (item.commentCount === 1 ? 'feed.list.comment' : 'feed.list.comments') | transloco: { count: item.commentCount } }}
                </button>
                @if (canDelete(item)) {
                  <button class="action-btn action-btn--danger" (click)="deleteItem(item.id)">
                    <mat-icon>delete_outline</mat-icon>
                    {{ 'common.delete' | transloco }}
                  </button>
                }
              </div>

              @if (expandedComments().has(item.id)) {
                <div class="comments-section">
                  <div class="comments-thread-line"></div>
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
                             [placeholder]="'feed.comments.placeholder' | transloco"
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
          </div>
        }
      </div>

      @if (store.items().length < store.total()) {
        <div class="load-more-container">
          <button class="load-more-btn"
                  [disabled]="store.isLoading()"
                  (click)="store.loadMore()">
            @if (store.isLoading()) {
              {{ 'feed.list.loadingMore' | transloco }}
            } @else {
              {{ 'feed.list.loadMore' | transloco }}
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
  private readonly translocoService = inject(TranslocoService);

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

    if (diffSeconds < 60) return this.translocoService.translate('feed.time.justNow');
    if (diffMinutes < 60) return this.translocoService.translate('feed.time.minutesAgo', { count: diffMinutes });
    if (diffHours < 24) return this.translocoService.translate('feed.time.hoursAgo', { count: diffHours });
    if (diffDays < 7) return this.translocoService.translate('feed.time.daysAgo', { count: diffDays });
    const locale = this.translocoService.getActiveLang() === 'tr' ? 'tr-TR' : 'en-US';
    return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(new Date(dateStr));
  }
}

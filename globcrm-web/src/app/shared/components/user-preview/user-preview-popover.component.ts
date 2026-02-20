import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { forkJoin } from 'rxjs';

import { ApiService } from '../../../core/api/api.service';
import { USER_PREVIEW_CONFIG, UserPreviewService } from '../../services/user-preview.service';
import { AvatarComponent } from '../avatar/avatar.component';

/** Profile data returned by GET /api/team-directory/{userId} */
interface TeamMemberProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  jobTitle: string | null;
  department: string | null;
  avatarUrl: string | null;
  avatarColor: string | null;
}

/** Activity stats returned by GET /api/team-directory/{userId}/activity-stats */
interface UserActivityStats {
  dealsAssigned: number;
  tasksCompletedToday: number;
  lastActive: string | null;
}

/**
 * Compact user profile popover shown via CDK Overlay.
 * Displays avatar, name, job title, contact info, and activity stats.
 *
 * Injected with USER_PREVIEW_CONFIG token containing userId and userName.
 * Fetches profile and activity stats in parallel via forkJoin.
 */
@Component({
  selector: 'app-user-preview-popover',
  standalone: true,
  imports: [CommonModule, MatIconModule, AvatarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .user-preview {
      background: var(--color-surface, #fff);
      padding: 16px;
      min-height: 120px;
    }

    /* ── Skeleton Loading ── */
    @keyframes shimmer {
      0% { background-position: -200px 0; }
      100% { background-position: 200px 0; }
    }

    .skeleton {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 4px 0;
    }

    .skeleton__header {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .skeleton__avatar {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: linear-gradient(90deg, var(--color-bg-secondary, #F0F0EE) 25%, var(--color-surface-hover, #F7F7F5) 50%, var(--color-bg-secondary, #F0F0EE) 75%);
      background-size: 400px 100%;
      animation: shimmer 1.5s infinite linear;
      flex-shrink: 0;
    }

    .skeleton__lines {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .skeleton__line {
      height: 10px;
      border-radius: 4px;
      background: linear-gradient(90deg, var(--color-bg-secondary, #F0F0EE) 25%, var(--color-surface-hover, #F7F7F5) 50%, var(--color-bg-secondary, #F0F0EE) 75%);
      background-size: 400px 100%;
      animation: shimmer 1.5s infinite linear;
    }

    .skeleton__line--wide { width: 70%; }
    .skeleton__line--narrow { width: 45%; }
    .skeleton__line--full { width: 100%; }

    /* ── Header ── */
    .user-preview__header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
    }

    .user-preview__name-block {
      flex: 1;
      min-width: 0;
    }

    .user-preview__name {
      font-size: var(--text-base, 0.875rem);
      font-weight: var(--font-semibold, 600);
      color: var(--color-text, #1a1a1a);
      margin: 0;
      line-height: var(--leading-tight, 1.25);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .user-preview__title {
      font-size: var(--text-xs, 0.75rem);
      color: var(--color-text-muted, #9CA3AF);
      margin-top: 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* ── Contact ── */
    .user-preview__contact {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 10px 0;
      border-top: 1px solid var(--color-border-subtle, #F0F0EE);
      border-bottom: 1px solid var(--color-border-subtle, #F0F0EE);
      margin-bottom: 10px;
    }

    .user-preview__contact-row {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: var(--text-sm, 0.8125rem);
      color: var(--color-text-secondary, #6B7280);

      mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
        color: var(--color-text-muted, #9CA3AF);
        flex-shrink: 0;
      }
    }

    .user-preview__email-link {
      color: var(--color-primary, #F97316);
      cursor: pointer;
      transition: color var(--duration-fast, 100ms);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;

      &:hover {
        color: var(--color-primary-text, #C2410C);
        text-decoration: underline;
      }
    }

    .user-preview__phone {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* ── Stats ── */
    .user-preview__stats {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 8px;
    }

    .stat-item {
      text-align: center;
      padding: 6px 4px;
      border-radius: var(--radius-md, 8px);
      background: var(--color-bg-secondary, #F0F0EE);
    }

    .stat-item__value {
      font-size: var(--text-base, 0.875rem);
      font-weight: var(--font-semibold, 600);
      color: var(--color-text, #1a1a1a);
      display: block;
      line-height: 1.2;
    }

    .stat-item__label {
      font-size: 10px;
      color: var(--color-text-muted, #9CA3AF);
      text-transform: uppercase;
      letter-spacing: 0.3px;
      display: block;
      margin-top: 2px;
    }

    /* ── Error ── */
    .user-preview__error {
      text-align: center;
      padding: 16px 0;
      color: var(--color-text-muted, #9CA3AF);
      font-size: var(--text-sm, 0.8125rem);

      mat-icon {
        font-size: 32px;
        width: 32px;
        height: 32px;
        color: var(--color-text-muted, #9CA3AF);
        margin-bottom: 8px;
        display: block;
        margin-left: auto;
        margin-right: auto;
      }
    }
  `,
  template: `
    <div class="user-preview">
      @if (isLoading()) {
        <div class="skeleton">
          <div class="skeleton__header">
            <div class="skeleton__avatar"></div>
            <div class="skeleton__lines">
              <div class="skeleton__line skeleton__line--wide"></div>
              <div class="skeleton__line skeleton__line--narrow"></div>
            </div>
          </div>
          <div class="skeleton__line skeleton__line--full"></div>
          <div class="skeleton__line skeleton__line--wide"></div>
        </div>
      } @else if (hasError()) {
        <div class="user-preview__error">
          <mat-icon>person_off</mat-icon>
          <span>Could not load profile</span>
        </div>
      } @else if (profile()) {
        <div class="user-preview__header">
          <app-avatar
            [avatarUrl]="profile()!.avatarUrl"
            [avatarColor]="profile()!.avatarColor"
            [firstName]="profile()!.firstName"
            [lastName]="profile()!.lastName"
            size="md" />
          <div class="user-preview__name-block">
            <p class="user-preview__name">{{ profile()!.firstName }} {{ profile()!.lastName }}</p>
            @if (profile()!.jobTitle || profile()!.department) {
              <div class="user-preview__title">
                {{ profile()!.jobTitle }}@if (profile()!.jobTitle && profile()!.department) { &middot; }{{ profile()!.department }}
              </div>
            }
          </div>
        </div>

        <div class="user-preview__contact">
          @if (profile()!.email) {
            <div class="user-preview__contact-row">
              <mat-icon>email</mat-icon>
              <span class="user-preview__email-link" (click)="onEmailClick()">{{ profile()!.email }}</span>
            </div>
          }
          @if (profile()!.phone) {
            <div class="user-preview__contact-row">
              <mat-icon>phone</mat-icon>
              <span class="user-preview__phone">{{ profile()!.phone }}</span>
            </div>
          }
        </div>

        @if (stats()) {
          <div class="user-preview__stats">
            <div class="stat-item">
              <span class="stat-item__value">{{ stats()!.dealsAssigned }}</span>
              <span class="stat-item__label">Deals</span>
            </div>
            <div class="stat-item">
              <span class="stat-item__value">{{ stats()!.tasksCompletedToday }}</span>
              <span class="stat-item__label">Tasks today</span>
            </div>
            <div class="stat-item">
              <span class="stat-item__value">{{ getRelativeTime(stats()!.lastActive) }}</span>
              <span class="stat-item__label">Last active</span>
            </div>
          </div>
        }
      }
    </div>
  `,
})
export class UserPreviewPopoverComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly config = inject(USER_PREVIEW_CONFIG);
  private readonly router = inject(Router);
  private readonly userPreviewService = inject(UserPreviewService);

  readonly profile = signal<TeamMemberProfile | null>(null);
  readonly stats = signal<UserActivityStats | null>(null);
  readonly isLoading = signal(true);
  readonly hasError = signal(false);

  ngOnInit(): void {
    // Fetch profile and activity stats in parallel (independent HTTP calls)
    forkJoin({
      profile: this.api.get<TeamMemberProfile>(`/api/team-directory/${this.config.userId}`),
      stats: this.api.get<UserActivityStats>(`/api/team-directory/${this.config.userId}/activity-stats`),
    }).subscribe({
      next: ({ profile, stats }) => {
        this.profile.set(profile);
        this.stats.set(stats);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.hasError.set(true);
      },
    });
  }

  onEmailClick(): void {
    this.userPreviewService.close();
    this.router.navigate(['/emails'], { queryParams: { compose: 'true' } });
  }

  getRelativeTime(dateStr: string | null): string {
    if (!dateStr) return 'N/A';

    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diffMs = now - then;
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSeconds < 60) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(dateStr));
  }
}

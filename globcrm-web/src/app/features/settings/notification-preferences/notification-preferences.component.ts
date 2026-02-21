import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { NotificationService } from '../../notifications/notification.service';
import {
  NotificationPreferenceDto,
  NotificationType,
} from '../../notifications/notification.models';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';

interface PreferenceRow {
  type: string;
  label: string;
  inAppEnabled: boolean;
  emailEnabled: boolean;
}

const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  [NotificationType.ActivityAssigned]: 'Activity Assigned',
  [NotificationType.DealStageChanged]: 'Deal Stage Changed',
  [NotificationType.Mention]: 'Mentions',
  [NotificationType.DueDateApproaching]: 'Due Date Approaching',
  [NotificationType.EmailReceived]: 'Email Received',
};

const NOTIFICATION_TYPE_DESCRIPTIONS: Record<string, string> = {
  [NotificationType.ActivityAssigned]: 'Get notified when a task or activity is assigned to you',
  [NotificationType.DealStageChanged]: 'Track when deals move between pipeline stages',
  [NotificationType.Mention]: 'Know when someone mentions you in notes or comments',
  [NotificationType.DueDateApproaching]: 'Receive reminders before tasks and activities are due',
  [NotificationType.EmailReceived]: 'Stay informed when new emails arrive for your contacts',
};

@Component({
  selector: 'app-notification-preferences',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatSlideToggleModule,
    MatButtonModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatIconModule,
    TranslocoPipe,
  ],
  template: `
    <!-- Page container -->
    <div class="np-page">

      <!-- Breadcrumb back-link -->
      <a routerLink="/settings" class="np-breadcrumb">
        <mat-icon class="np-breadcrumb__icon">arrow_back</mat-icon>
        <span class="np-breadcrumb__text">{{ 'notifications.breadcrumb' | transloco }}</span>
      </a>

      <!-- Page header -->
      <header class="np-header">
        <div class="np-header__icon-wrap">
          <mat-icon class="np-header__icon">notifications_active</mat-icon>
        </div>
        <div class="np-header__text">
          <h1 class="np-header__title">{{ 'notifications.pageTitle' | transloco }}</h1>
          <p class="np-header__subtitle">{{ 'notifications.pageSubtitle' | transloco }}</p>
        </div>
      </header>

      @if (loading()) {
        <div class="np-loading">
          <mat-spinner diameter="40"></mat-spinner>
        </div>
      } @else {
        <!-- Section card -->
        <section class="np-section">
          <div class="np-section__header">
            <div class="np-section__header-icon-wrap">
              <mat-icon class="np-section__header-icon">tune</mat-icon>
            </div>
            <div class="np-section__header-text">
              <h2 class="np-section__title">{{ 'notifications.channelsTitle' | transloco }}</h2>
              <p class="np-section__subtitle">{{ 'notifications.channelsSubtitle' | transloco }}</p>
            </div>
          </div>

          <div class="np-section__body">
            <!-- Column headers -->
            <div class="np-col-headers">
              <span class="np-col-headers__spacer"></span>
              <span class="np-col-headers__label">{{ 'notifications.inAppHeader' | transloco }}</span>
              <span class="np-col-headers__label">{{ 'notifications.emailHeader' | transloco }}</span>
            </div>

            <!-- Preference rows -->
            @for (pref of preferences(); track pref.type; let i = $index) {
              <div
                class="np-row"
                [style.animation-delay]="(i * 60 + 120) + 'ms'"
              >
                <div class="np-row__info">
                  <div class="np-row__icon-wrap">
                    <mat-icon class="np-row__icon">{{ getNotificationIcon(pref.type) }}</mat-icon>
                  </div>
                  <div class="np-row__text">
                    <span class="np-row__label">{{ pref.label }}</span>
                    <span class="np-row__description">{{ getNotificationDescription(pref.type) }}</span>
                  </div>
                </div>
                <div class="np-row__toggles">
                  <div class="np-row__toggle-cell">
                    <mat-slide-toggle
                      [(ngModel)]="pref.inAppEnabled"
                      color="primary"
                      aria-label="In-app notification for {{ pref.label }}"
                    ></mat-slide-toggle>
                  </div>
                  <div class="np-row__toggle-cell">
                    <mat-slide-toggle
                      [(ngModel)]="pref.emailEnabled"
                      color="primary"
                      aria-label="Email notification for {{ pref.label }}"
                    ></mat-slide-toggle>
                  </div>
                </div>
              </div>
            }
          </div>
        </section>

        <!-- Actions bar -->
        <div class="np-actions">
          <button
            mat-raised-button
            color="primary"
            class="np-actions__save"
            [disabled]="saving()"
            (click)="save()"
          >
            @if (saving()) {
              <mat-spinner diameter="20" class="np-actions__spinner"></mat-spinner>
            }
            {{ 'notifications.savePreferences' | transloco }}
          </button>
        </div>
      }
    </div>
  `,
  styles: `
    /* ─── Keyframes ──────────────────────────────────── */
    @keyframes fadeSlideUp {
      from { opacity: 0; transform: translateY(16px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    /* ─── Host ───────────────────────────────────────── */
    :host {
      display: block;
    }

    /* ─── Page Container ─────────────────────────────── */
    .np-page {
      max-width: 800px;
      margin: 0 auto;
      padding: var(--space-8) var(--space-6);
    }

    /* ─── Breadcrumb ─────────────────────────────────── */
    .np-breadcrumb {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      text-decoration: none;
      color: var(--color-text-secondary);
      font-size: var(--text-sm);
      font-weight: var(--font-medium);
      margin-bottom: var(--space-6);
      padding: var(--space-1-5) var(--space-2);
      border-radius: var(--radius-md);
      transition:
        color var(--duration-normal) var(--ease-default),
        background var(--duration-normal) var(--ease-default);
      opacity: 0;
      animation: fadeSlideUp 0.35s var(--ease-out) forwards;
    }

    .np-breadcrumb:hover {
      color: var(--color-primary);
      background: var(--color-primary-soft);
    }

    .np-breadcrumb__icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .np-breadcrumb__text {
      line-height: 1;
    }

    /* ─── Header ─────────────────────────────────────── */
    .np-header {
      display: flex;
      align-items: center;
      gap: var(--space-5);
      margin-bottom: var(--space-8);
      opacity: 0;
      animation: fadeSlideUp 0.4s var(--ease-out) 60ms forwards;
    }

    .np-header__icon-wrap {
      width: 56px;
      height: 56px;
      border-radius: var(--radius-xl);
      background: linear-gradient(135deg, var(--color-warning) 0%, var(--color-primary) 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow:
        0 4px 16px rgba(245, 158, 11, 0.25),
        0 0 0 4px rgba(245, 158, 11, 0.08);
      flex-shrink: 0;
    }

    .np-header__icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
      color: #fff;
    }

    .np-header__title {
      font-size: var(--text-2xl);
      font-weight: var(--font-bold);
      letter-spacing: -0.5px;
      margin: 0;
      color: var(--color-text);
      line-height: var(--leading-tight);
    }

    .np-header__subtitle {
      font-size: var(--text-base);
      color: var(--color-text-secondary);
      margin: var(--space-1) 0 0;
      line-height: var(--leading-normal);
    }

    /* ─── Loading ─────────────────────────────────────── */
    .np-loading {
      display: flex;
      justify-content: center;
      padding: var(--space-16) 0;
      opacity: 0;
      animation: fadeSlideUp 0.3s var(--ease-out) forwards;
    }

    /* ─── Section Card ───────────────────────────────── */
    .np-section {
      border: 1.5px solid var(--color-border);
      border-radius: 14px;
      background: var(--color-surface);
      box-shadow: var(--shadow-sm);
      overflow: hidden;
      opacity: 0;
      animation: fadeSlideUp 0.4s var(--ease-out) 100ms forwards;
    }

    .np-section__header {
      display: flex;
      align-items: center;
      gap: var(--space-4);
      padding: var(--space-5) var(--space-6);
      border-bottom: 1.5px solid var(--color-border);
      background: var(--color-surface-hover);
    }

    .np-section__header-icon-wrap {
      width: 40px;
      height: 40px;
      border-radius: var(--radius-lg);
      background: var(--color-warning-soft);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .np-section__header-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
      color: var(--color-warning-text);
    }

    .np-section__title {
      font-size: var(--text-md);
      font-weight: var(--font-semibold);
      margin: 0;
      color: var(--color-text);
      line-height: var(--leading-tight);
    }

    .np-section__subtitle {
      font-size: var(--text-sm);
      color: var(--color-text-secondary);
      margin: var(--space-0-5) 0 0;
      line-height: var(--leading-normal);
    }

    .np-section__body {
      padding: 0;
    }

    /* ─── Column Headers ─────────────────────────────── */
    .np-col-headers {
      display: flex;
      align-items: center;
      padding: var(--space-3) var(--space-6);
      border-bottom: 1px solid var(--color-border-subtle);
    }

    .np-col-headers__spacer {
      flex: 1;
    }

    .np-col-headers__label {
      width: 80px;
      text-align: center;
      font-size: var(--text-xs);
      font-weight: var(--font-semibold);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--color-text-muted);
    }

    /* ─── Preference Row ─────────────────────────────── */
    .np-row {
      display: flex;
      align-items: center;
      padding: var(--space-4) var(--space-6);
      border-bottom: 1px solid var(--color-border-subtle);
      transition: background var(--duration-fast) var(--ease-default);
      opacity: 0;
      animation: fadeSlideUp 0.35s var(--ease-out) forwards;
    }

    .np-row:last-child {
      border-bottom: none;
    }

    .np-row:hover {
      background: var(--color-highlight);
    }

    .np-row__info {
      display: flex;
      align-items: center;
      gap: var(--space-4);
      flex: 1;
      min-width: 0;
    }

    .np-row__icon-wrap {
      width: 40px;
      height: 40px;
      border-radius: var(--radius-lg);
      background: var(--color-primary-soft);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: background var(--duration-normal) var(--ease-default);
    }

    .np-row:hover .np-row__icon-wrap {
      background: var(--color-primary-soft-hover);
    }

    .np-row__icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
      color: var(--color-primary);
    }

    .np-row__text {
      display: flex;
      flex-direction: column;
      gap: var(--space-0-5);
      min-width: 0;
    }

    .np-row__label {
      font-size: var(--text-base);
      font-weight: var(--font-semibold);
      color: var(--color-text);
      line-height: var(--leading-tight);
    }

    .np-row__description {
      font-size: var(--text-sm);
      color: var(--color-text-muted);
      line-height: var(--leading-normal);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .np-row__toggles {
      display: flex;
      align-items: center;
      flex-shrink: 0;
    }

    .np-row__toggle-cell {
      width: 80px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    /* ─── Actions Bar ────────────────────────────────── */
    .np-actions {
      display: flex;
      justify-content: flex-end;
      margin-top: var(--space-6);
      opacity: 0;
      animation: fadeSlideUp 0.4s var(--ease-out) 400ms forwards;
    }

    .np-actions__save {
      min-width: 160px;
      height: 44px;
      border-radius: var(--radius-lg) !important;
      font-size: var(--text-base);
      font-weight: var(--font-semibold);
      letter-spacing: 0.01em;
      box-shadow: var(--shadow-md);
      transition:
        box-shadow var(--duration-normal) var(--ease-default),
        transform var(--duration-normal) var(--ease-default);
    }

    .np-actions__save:not(:disabled):hover {
      box-shadow: var(--shadow-lg);
      transform: translateY(-1px);
    }

    .np-actions__save:not(:disabled):active {
      transform: translateY(0);
    }

    .np-actions__spinner {
      display: inline-block;
      margin-right: var(--space-2);
      vertical-align: middle;
    }

    /* ─── Responsive (mobile) ────────────────────────── */
    @media (max-width: 768px) {
      .np-page {
        padding: var(--space-5) var(--space-4);
      }

      .np-header {
        gap: var(--space-4);
      }

      .np-header__icon-wrap {
        width: 44px;
        height: 44px;
        border-radius: var(--radius-lg);
      }

      .np-header__icon {
        font-size: 22px;
        width: 22px;
        height: 22px;
      }

      .np-header__title {
        font-size: var(--text-xl);
      }

      .np-header__subtitle {
        font-size: var(--text-sm);
      }

      .np-section__header {
        padding: var(--space-4);
      }

      .np-col-headers {
        padding: var(--space-2) var(--space-4);
      }

      .np-col-headers__label {
        width: 60px;
        font-size: 10px;
      }

      .np-row {
        padding: var(--space-3) var(--space-4);
        flex-wrap: wrap;
        gap: var(--space-3);
      }

      .np-row__info {
        flex: 1 1 100%;
      }

      .np-row__icon-wrap {
        width: 36px;
        height: 36px;
        border-radius: var(--radius-md);
      }

      .np-row__icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }

      .np-row__description {
        white-space: normal;
      }

      .np-row__toggles {
        margin-left: auto;
      }

      .np-row__toggle-cell {
        width: 60px;
      }

      .np-actions {
        margin-top: var(--space-5);
      }

      .np-actions__save {
        width: 100%;
      }
    }

    /* ─── Reduced motion ─────────────────────────────── */
    @media (prefers-reduced-motion: reduce) {
      .np-breadcrumb,
      .np-header,
      .np-loading,
      .np-section,
      .np-row,
      .np-actions {
        animation: none;
        opacity: 1;
      }

      .np-row,
      .np-row__icon-wrap,
      .np-actions__save {
        transition: none;
      }
    }
  `,
})
export class NotificationPreferencesComponent implements OnInit {
  private readonly notificationService = inject(NotificationService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly transloco = inject(TranslocoService);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly preferences = signal<PreferenceRow[]>([]);

  ngOnInit(): void {
    this.loadPreferences();
  }

  private loadPreferences(): void {
    this.loading.set(true);
    this.notificationService.getPreferences().subscribe({
      next: (prefs) => {
        if (prefs.length === 0) {
          // Generate default preferences for all 5 notification types
          this.preferences.set(this.generateDefaults());
        } else {
          this.preferences.set(
            prefs.map((p) => ({
              type: p.notificationType,
              label:
                NOTIFICATION_TYPE_LABELS[p.notificationType] ??
                p.notificationType,
              inAppEnabled: p.inAppEnabled,
              emailEnabled: p.emailEnabled,
            }))
          );
        }
        this.loading.set(false);
      },
      error: () => {
        // Fallback to defaults on error
        this.preferences.set(this.generateDefaults());
        this.loading.set(false);
      },
    });
  }

  private generateDefaults(): PreferenceRow[] {
    return Object.values(NotificationType).map((type) => ({
      type,
      label: NOTIFICATION_TYPE_LABELS[type] ?? type,
      inAppEnabled: true,
      emailEnabled: true,
    }));
  }

  save(): void {
    this.saving.set(true);
    const dtos: NotificationPreferenceDto[] = this.preferences().map((p) => ({
      notificationType: p.type,
      inAppEnabled: p.inAppEnabled,
      emailEnabled: p.emailEnabled,
    }));

    this.notificationService.updatePreferences(dtos).subscribe({
      next: () => {
        this.saving.set(false);
        this.snackBar.open(this.transloco.translate('settings.notifications.saveSuccess'), 'Close', {
          duration: 3000,
        });
      },
      error: () => {
        this.saving.set(false);
        this.snackBar.open(this.transloco.translate('settings.notifications.saveFailed'), 'Close', {
          duration: 3000,
        });
      },
    });
  }

  getNotificationIcon(type: string): string {
    const icons: Record<string, string> = {
      [NotificationType.ActivityAssigned]: 'assignment_ind',
      [NotificationType.DealStageChanged]: 'swap_horiz',
      [NotificationType.Mention]: 'alternate_email',
      [NotificationType.DueDateApproaching]: 'schedule',
      [NotificationType.EmailReceived]: 'email',
    };
    return icons[type] ?? 'notifications';
  }

  getNotificationDescription(type: string): string {
    return NOTIFICATION_TYPE_DESCRIPTIONS[type] ?? '';
  }
}

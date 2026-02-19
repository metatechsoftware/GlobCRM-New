import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { EmailService } from '../../emails/email.service';
import { EmailAccountStatusDto } from '../../emails/email.models';

/**
 * Email account settings page for connecting/disconnecting Gmail.
 * Shows connection status, Gmail address, last sync time, and sync controls.
 *
 * OAuth flow: connect() calls EmailService.connect() which returns an authorizationUrl,
 * then redirects browser to Google consent screen via window.location.href.
 * After consent, Google redirects back with ?connected=true query param.
 */
@Component({
  selector: 'app-email-account-settings',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatProgressSpinnerModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    /* ─── Keyframes ──────────────────────────────────── */
    @keyframes eaFadeSlideUp {
      from { opacity: 0; transform: translateY(16px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    @keyframes eaCircleFloat {
      0%, 100% { opacity: 0.4; transform: translateY(0); }
      50%      { opacity: 0.8; transform: translateY(-8px); }
    }

    @keyframes eaPulseGlow {
      0%, 100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.2); }
      50%      { box-shadow: 0 0 0 8px rgba(34, 197, 94, 0); }
    }

    @keyframes eaSpin {
      from { transform: rotate(0deg); }
      to   { transform: rotate(360deg); }
    }

    /* ─── Host ───────────────────────────────────────── */
    :host {
      display: block;
      padding: var(--space-6) var(--space-8);
    }

    /* ─── Page Container ─────────────────────────────── */
    .ea-page {
      max-width: 800px;
      margin: 0 auto;
    }

    /* ─── Header ─────────────────────────────────────── */
    .ea-header {
      margin-bottom: var(--space-8);
      opacity: 0;
      animation: eaFadeSlideUp var(--duration-slower) var(--ease-out) forwards;
    }

    .ea-header__back {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      color: var(--color-text-secondary);
      text-decoration: none;
      font-size: var(--text-sm);
      font-weight: var(--font-medium);
      margin-bottom: var(--space-3);
      transition: color var(--duration-normal) var(--ease-default);
    }

    .ea-header__back mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .ea-header__back:hover {
      color: var(--color-primary);
    }

    .ea-header__row {
      display: flex;
      align-items: center;
      gap: var(--space-4);
    }

    .ea-header__icon-wrap {
      width: 48px;
      height: 48px;
      border-radius: var(--radius-lg);
      background: linear-gradient(135deg, #3B82F6, #2563EB);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3), 0 0 0 4px rgba(59, 130, 246, 0.08);
      flex-shrink: 0;
    }

    .ea-header__icon-wrap mat-icon {
      color: #fff;
      font-size: 24px;
      width: 24px;
      height: 24px;
    }

    .ea-header__title {
      margin: 0;
      font-size: var(--text-3xl);
      font-weight: var(--font-bold);
      letter-spacing: -0.5px;
      color: var(--color-text);
    }

    .ea-header__subtitle {
      margin: var(--space-1) 0 0;
      font-size: var(--text-base);
      color: var(--color-text-secondary);
      line-height: var(--leading-normal);
    }

    /* ─── Section Card ───────────────────────────────── */
    .ea-section {
      background: var(--color-surface);
      border: 1.5px solid var(--color-border);
      border-radius: 14px;
      overflow: hidden;
      opacity: 0;
      animation: eaFadeSlideUp var(--duration-slower) var(--ease-out) forwards;
      animation-delay: 100ms;
    }

    .ea-section__inner {
      padding: var(--space-8) var(--space-6);
    }

    /* ─── Loading State ──────────────────────────────── */
    .ea-loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: var(--space-12) var(--space-6);
      gap: var(--space-4);
    }

    .ea-loading__text {
      margin: 0;
      color: var(--color-text-secondary);
      font-size: var(--text-sm);
    }

    /* ─── Disconnected State ─────────────────────────── */
    .ea-disconnected {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding: var(--space-10) var(--space-6);
      gap: var(--space-5);
    }

    .ea-disconnected__visual {
      position: relative;
      width: 120px;
      height: 120px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .ea-disconnected__circles {
      position: absolute;
      inset: 0;
    }

    .ea-circle {
      position: absolute;
      border-radius: var(--radius-full);
      opacity: 0;
      animation: eaCircleFloat 3s var(--ease-default) infinite;
    }

    .ea-circle--1 {
      width: 40px;
      height: 40px;
      background: var(--color-info-soft);
      border: 2px solid var(--color-info);
      top: 0;
      left: 10px;
      animation-delay: 0s;
    }

    .ea-circle--2 {
      width: 32px;
      height: 32px;
      background: var(--color-primary-soft);
      border: 2px solid var(--color-primary);
      top: 8px;
      right: 5px;
      animation-delay: 0.5s;
    }

    .ea-circle--3 {
      width: 28px;
      height: 28px;
      background: var(--color-secondary-soft);
      border: 2px solid var(--color-secondary);
      bottom: 10px;
      left: 22px;
      animation-delay: 1s;
    }

    .ea-disconnected__icon {
      position: relative;
      z-index: 1;
      font-size: 48px;
      width: 48px;
      height: 48px;
      color: var(--color-text-muted);
    }

    .ea-disconnected__title {
      font-size: var(--text-xl);
      font-weight: var(--font-semibold);
      color: var(--color-text);
      margin: 0;
    }

    .ea-disconnected__desc {
      color: var(--color-text-secondary);
      font-size: var(--text-base);
      max-width: 420px;
      line-height: var(--leading-relaxed);
      margin: 0;
    }

    .ea-connect-btn {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-3) var(--space-6);
      border: none;
      border-radius: var(--radius-md);
      background: linear-gradient(135deg, var(--color-primary), var(--color-primary-hover));
      color: var(--color-primary-fg);
      font-size: var(--text-base);
      font-weight: var(--font-semibold);
      font-family: var(--font-sans);
      cursor: pointer;
      transition: transform var(--duration-normal) var(--ease-default),
                  box-shadow var(--duration-normal) var(--ease-default);
      box-shadow: 0 2px 8px rgba(249, 115, 22, 0.3);
    }

    .ea-connect-btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 16px rgba(249, 115, 22, 0.35);
    }

    .ea-connect-btn:active {
      transform: translateY(0);
    }

    .ea-connect-btn mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    /* ─── Connected State ────────────────────────────── */
    .ea-connected {
      display: flex;
      flex-direction: column;
      gap: var(--space-6);
    }

    /* Connection banner */
    .ea-banner {
      display: flex;
      align-items: center;
      gap: var(--space-4);
      padding: var(--space-5);
      background: var(--color-success-soft);
      border-radius: var(--radius-md);
      border: 1px solid rgba(34, 197, 94, 0.15);
    }

    .ea-banner__check {
      width: 44px;
      height: 44px;
      border-radius: var(--radius-full);
      background: var(--color-success);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      animation: eaPulseGlow 3s var(--ease-default) infinite;
    }

    .ea-banner__check mat-icon {
      font-size: 24px;
      width: 24px;
      height: 24px;
      color: #fff;
    }

    .ea-banner__info {
      flex: 1;
      min-width: 0;
    }

    .ea-banner__title {
      margin: 0;
      font-size: var(--text-md);
      font-weight: var(--font-semibold);
      color: var(--color-success-text);
    }

    .ea-banner__address {
      margin: var(--space-0-5) 0 0;
      font-size: var(--text-base);
      color: var(--color-text);
      font-weight: var(--font-medium);
    }

    /* Sync info cards */
    .ea-info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--space-3);
    }

    .ea-info-card {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-4);
      background: var(--color-bg-secondary);
      border-radius: var(--radius-md);
      border: 1px solid var(--color-border-subtle);
    }

    .ea-info-card__icon-wrap {
      width: 36px;
      height: 36px;
      border-radius: var(--radius-md);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .ea-info-card__icon-wrap--status {
      background: var(--color-info-soft);
    }

    .ea-info-card__icon-wrap--status mat-icon {
      color: var(--color-info);
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .ea-info-card__icon-wrap--sync {
      background: var(--color-accent-soft);
    }

    .ea-info-card__icon-wrap--sync mat-icon {
      color: var(--color-accent);
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .ea-info-card__content {
      flex: 1;
      min-width: 0;
    }

    .ea-info-card__label {
      margin: 0;
      font-size: var(--text-xs);
      font-weight: var(--font-medium);
      color: var(--color-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .ea-info-card__value {
      margin: var(--space-0-5) 0 0;
      font-size: var(--text-base);
      font-weight: var(--font-medium);
      color: var(--color-text);
    }

    /* Status Badge */
    .ea-badge {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      padding: var(--space-0-5) var(--space-2);
      border-radius: var(--radius-full);
      font-size: var(--text-xs);
      font-weight: var(--font-semibold);
    }

    .ea-badge__dot {
      width: 6px;
      height: 6px;
      border-radius: var(--radius-full);
      flex-shrink: 0;
    }

    .ea-badge--active {
      background: var(--color-success-soft);
      color: var(--color-success-text);
    }

    .ea-badge--active .ea-badge__dot {
      background: var(--color-success);
    }

    .ea-badge--error {
      background: var(--color-danger-soft);
      color: var(--color-danger-text);
    }

    .ea-badge--error .ea-badge__dot {
      background: var(--color-danger);
    }

    .ea-badge--paused {
      background: var(--color-bg-secondary);
      color: var(--color-text-muted);
    }

    .ea-badge--paused .ea-badge__dot {
      background: var(--color-text-muted);
    }

    /* Error message */
    .ea-error-msg {
      display: flex;
      align-items: flex-start;
      gap: var(--space-2);
      padding: var(--space-3) var(--space-4);
      background: var(--color-danger-soft);
      border-radius: var(--radius-md);
      border: 1px solid rgba(239, 68, 68, 0.15);
    }

    .ea-error-msg mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      color: var(--color-danger);
      flex-shrink: 0;
      margin-top: 1px;
    }

    .ea-error-msg__text {
      margin: 0;
      font-size: var(--text-sm);
      color: var(--color-danger-text);
      line-height: var(--leading-normal);
    }

    /* Divider */
    .ea-divider {
      height: 1px;
      background: var(--color-border-subtle);
      border: none;
      margin: 0;
    }

    /* Action buttons */
    .ea-actions {
      display: flex;
      align-items: center;
      gap: var(--space-3);
    }

    .ea-sync-btn {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-5);
      border: 1.5px solid var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-surface);
      color: var(--color-text);
      font-size: var(--text-sm);
      font-weight: var(--font-semibold);
      font-family: var(--font-sans);
      cursor: pointer;
      transition: border-color var(--duration-normal) var(--ease-default),
                  background var(--duration-normal) var(--ease-default),
                  box-shadow var(--duration-normal) var(--ease-default);
    }

    .ea-sync-btn:hover:not(:disabled) {
      border-color: var(--color-info);
      background: var(--color-info-soft);
      box-shadow: 0 2px 8px rgba(59, 130, 246, 0.1);
    }

    .ea-sync-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .ea-sync-btn mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .ea-sync-btn__spinner {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      height: 18px;
    }

    .ea-disconnect-btn {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-5);
      border: 1.5px solid var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-surface);
      color: var(--color-text-secondary);
      font-size: var(--text-sm);
      font-weight: var(--font-semibold);
      font-family: var(--font-sans);
      cursor: pointer;
      transition: border-color var(--duration-normal) var(--ease-default),
                  color var(--duration-normal) var(--ease-default),
                  background var(--duration-normal) var(--ease-default);
    }

    .ea-disconnect-btn:hover {
      border-color: var(--color-danger);
      color: var(--color-danger-text);
      background: var(--color-danger-soft);
    }

    .ea-disconnect-btn mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    /* ─── Gmail Brand Accent ─────────────────────────── */
    .ea-gmail-brand {
      display: flex;
      gap: var(--space-1);
      height: 3px;
    }

    .ea-gmail-brand__bar {
      flex: 1;
      border-radius: 2px;
    }

    .ea-gmail-brand__bar--red    { background: #EA4335; }
    .ea-gmail-brand__bar--blue   { background: #4285F4; }
    .ea-gmail-brand__bar--yellow { background: #FBBC04; }
    .ea-gmail-brand__bar--green  { background: #34A853; }

    /* ─── Reduced Motion ─────────────────────────────── */
    @media (prefers-reduced-motion: reduce) {
      .ea-header,
      .ea-section {
        animation: none;
        opacity: 1;
      }

      .ea-circle {
        animation: none;
        opacity: 0.5;
      }

      .ea-banner__check {
        animation: none;
      }
    }

    /* ─── Responsive ─────────────────────────────────── */
    @media (max-width: 768px) {
      :host {
        padding: var(--space-4);
      }

      .ea-header {
        margin-bottom: var(--space-6);
      }

      .ea-header__icon-wrap {
        width: 40px;
        height: 40px;
        border-radius: var(--radius-md);
      }

      .ea-header__icon-wrap mat-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
      }

      .ea-header__title {
        font-size: var(--text-2xl);
      }

      .ea-header__subtitle {
        font-size: var(--text-sm);
      }

      .ea-section__inner {
        padding: var(--space-6) var(--space-4);
      }

      .ea-info-grid {
        grid-template-columns: 1fr;
      }

      .ea-banner {
        flex-direction: column;
        text-align: center;
      }

      .ea-actions {
        flex-direction: column;
        width: 100%;
      }

      .ea-sync-btn,
      .ea-disconnect-btn {
        width: 100%;
        justify-content: center;
      }

      .ea-disconnected {
        padding: var(--space-8) var(--space-4);
      }
    }
  `,
  template: `
    <div class="ea-page">
      <!-- Header -->
      <div class="ea-header">
        <a routerLink="/settings" class="ea-header__back">
          <mat-icon>arrow_back</mat-icon>
          <span>Settings</span>
        </a>
        <div class="ea-header__row">
          <div class="ea-header__icon-wrap">
            <mat-icon>mail</mat-icon>
          </div>
          <div>
            <h1 class="ea-header__title">Email Account</h1>
            <p class="ea-header__subtitle">Connect and manage your email integration</p>
          </div>
        </div>
      </div>

      <!-- Section Card -->
      <div class="ea-section">
        @if (loading()) {
          <!-- Loading -->
          <div class="ea-section__inner">
            <div class="ea-loading">
              <mat-spinner diameter="40"></mat-spinner>
              <p class="ea-loading__text">Loading account status...</p>
            </div>
          </div>
        } @else if (!accountStatus() || !accountStatus()!.connected) {
          <!-- Disconnected State -->
          <div class="ea-section__inner">
            <div class="ea-disconnected">
              <div class="ea-disconnected__visual">
                <div class="ea-disconnected__circles">
                  <div class="ea-circle ea-circle--1"></div>
                  <div class="ea-circle ea-circle--2"></div>
                  <div class="ea-circle ea-circle--3"></div>
                </div>
                <mat-icon class="ea-disconnected__icon">mail_outline</mat-icon>
              </div>
              <h2 class="ea-disconnected__title">No Gmail account connected</h2>
              <p class="ea-disconnected__desc">
                Connect your Gmail account to sync emails with your CRM.
                Emails will be automatically linked to contacts and companies.
              </p>
              <button class="ea-connect-btn" (click)="connect()">
                <mat-icon>link</mat-icon>
                Connect Gmail
              </button>
            </div>
          </div>
        } @else {
          <!-- Connected State -->
          <!-- Gmail brand color bar -->
          <div class="ea-gmail-brand">
            <div class="ea-gmail-brand__bar ea-gmail-brand__bar--red"></div>
            <div class="ea-gmail-brand__bar ea-gmail-brand__bar--blue"></div>
            <div class="ea-gmail-brand__bar ea-gmail-brand__bar--yellow"></div>
            <div class="ea-gmail-brand__bar ea-gmail-brand__bar--green"></div>
          </div>

          <div class="ea-section__inner">
            <div class="ea-connected">
              <!-- Connection banner -->
              <div class="ea-banner">
                <div class="ea-banner__check">
                  <mat-icon>check</mat-icon>
                </div>
                <div class="ea-banner__info">
                  <h3 class="ea-banner__title">Gmail Connected</h3>
                  <p class="ea-banner__address">{{ accountStatus()!.gmailAddress }}</p>
                </div>
              </div>

              <!-- Sync info cards -->
              <div class="ea-info-grid">
                <div class="ea-info-card">
                  <div class="ea-info-card__icon-wrap ea-info-card__icon-wrap--status">
                    <mat-icon>wifi_tethering</mat-icon>
                  </div>
                  <div class="ea-info-card__content">
                    <p class="ea-info-card__label">Sync Status</p>
                    <div class="ea-info-card__value">
                      <span class="ea-badge"
                            [class.ea-badge--active]="accountStatus()!.syncStatus === 'Active'"
                            [class.ea-badge--error]="accountStatus()!.syncStatus === 'Error'"
                            [class.ea-badge--paused]="accountStatus()!.syncStatus === 'Paused'">
                        <span class="ea-badge__dot"></span>
                        {{ accountStatus()!.syncStatus ?? 'Active' }}
                      </span>
                    </div>
                  </div>
                </div>

                <div class="ea-info-card">
                  <div class="ea-info-card__icon-wrap ea-info-card__icon-wrap--sync">
                    <mat-icon>schedule</mat-icon>
                  </div>
                  <div class="ea-info-card__content">
                    <p class="ea-info-card__label">Last Synced</p>
                    <p class="ea-info-card__value">
                      {{ accountStatus()!.lastSyncAt ? formatRelativeTime(accountStatus()!.lastSyncAt!) : 'Never' }}
                    </p>
                  </div>
                </div>
              </div>

              <!-- Error message -->
              @if (accountStatus()!.syncStatus === 'Error' && accountStatus()!.errorMessage) {
                <div class="ea-error-msg">
                  <mat-icon>error_outline</mat-icon>
                  <p class="ea-error-msg__text">{{ accountStatus()!.errorMessage }}</p>
                </div>
              }

              <hr class="ea-divider" />

              <!-- Action buttons -->
              <div class="ea-actions">
                <button class="ea-sync-btn"
                        [disabled]="syncing()"
                        (click)="triggerSync()">
                  @if (syncing()) {
                    <span class="ea-sync-btn__spinner">
                      <mat-spinner diameter="16"></mat-spinner>
                    </span>
                    Syncing...
                  } @else {
                    <mat-icon>sync</mat-icon>
                    Sync Now
                  }
                </button>

                <button class="ea-disconnect-btn" (click)="disconnect()">
                  <mat-icon>link_off</mat-icon>
                  Disconnect
                </button>
              </div>
            </div>
          </div>
        }
      </div>
    </div>
  `,
})
export class EmailAccountSettingsComponent implements OnInit {
  private readonly emailService = inject(EmailService);
  private readonly route = inject(ActivatedRoute);
  private readonly snackBar = inject(MatSnackBar);

  /** Current account status from API. */
  readonly accountStatus = signal<EmailAccountStatusDto | null>(null);

  /** Loading state for initial status fetch. */
  readonly loading = signal(false);

  /** Syncing state for manual sync button. */
  readonly syncing = signal(false);

  ngOnInit(): void {
    this.loadAccountStatus();

    // Check for OAuth callback redirect with ?connected=true
    this.route.queryParams.subscribe((params) => {
      if (params['connected'] === 'true') {
        this.snackBar.open('Gmail account connected successfully!', 'OK', { duration: 5000 });
        this.loadAccountStatus();
      }
    });
  }

  /** Load account status from API. */
  private loadAccountStatus(): void {
    this.loading.set(true);
    this.emailService.getAccountStatus().subscribe({
      next: (status) => {
        this.accountStatus.set(status);
        this.loading.set(false);
      },
      error: () => {
        this.accountStatus.set(null);
        this.loading.set(false);
      },
    });
  }

  /** Initiate Gmail OAuth connection. Redirects to Google consent screen. */
  connect(): void {
    this.emailService.connect().subscribe({
      next: (response) => {
        // Redirect to Google OAuth consent screen
        window.location.href = response.authorizationUrl;
      },
      error: (err) => {
        const message = err?.error?.message ?? 'Failed to initiate Gmail connection';
        this.snackBar.open(message, 'OK', { duration: 5000 });
      },
    });
  }

  /** Disconnect Gmail account with confirmation. */
  disconnect(): void {
    const confirmed = window.confirm(
      'Are you sure you want to disconnect your Gmail account? Synced emails will remain, but no new emails will be synced.',
    );

    if (!confirmed) return;

    this.emailService.disconnect().subscribe({
      next: () => {
        this.snackBar.open('Gmail account disconnected', 'OK', { duration: 3000 });
        this.loadAccountStatus();
      },
      error: (err) => {
        const message = err?.error?.message ?? 'Failed to disconnect Gmail account';
        this.snackBar.open(message, 'OK', { duration: 5000 });
      },
    });
  }

  /** Trigger manual email sync. */
  triggerSync(): void {
    this.syncing.set(true);
    this.emailService.triggerSync().subscribe({
      next: () => {
        this.syncing.set(false);
        this.snackBar.open('Email sync completed', 'OK', { duration: 3000 });
        this.loadAccountStatus();
      },
      error: (err) => {
        this.syncing.set(false);
        const message = err?.error?.message ?? 'Failed to sync emails';
        this.snackBar.open(message, 'OK', { duration: 5000 });
      },
    });
  }

  /**
   * Format a date string as relative time (e.g., "3 minutes ago").
   * Falls back to formatted date for older timestamps.
   */
  formatRelativeTime(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;

    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  }
}

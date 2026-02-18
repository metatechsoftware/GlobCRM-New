import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
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
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatProgressSpinnerModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
      padding: 24px;
    }

    h1 {
      margin: 0 0 24px;
      font-size: 24px;
      font-weight: 600;
      color: var(--color-text);
    }

    .account-card {
      max-width: 600px;
    }

    .status-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding: 32px 24px;
      gap: 16px;
    }

    .status-icon {
      width: 64px;
      height: 64px;
      font-size: 64px;
    }

    .status-icon.disconnected {
      color: var(--color-text-muted);
    }

    .status-icon.connected {
      color: var(--color-success);
    }

    .status-title {
      font-size: 20px;
      font-weight: 500;
      margin: 0;
    }

    .status-description {
      color: var(--color-text-muted);
      font-size: 14px;
      max-width: 400px;
      line-height: 1.5;
    }

    .gmail-address {
      font-size: 16px;
      font-weight: 500;
      color: var(--color-text);
    }

    .sync-status-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
      color: #fff;
    }

    .sync-status-badge.active { background: var(--color-success); }
    .sync-status-badge.error { background: var(--color-danger); }
    .sync-status-badge.paused { background: var(--color-text-muted); }

    .error-message {
      color: var(--color-danger);
      font-size: 13px;
      margin-top: 4px;
    }

    .last-sync {
      color: var(--color-text-muted);
      font-size: 13px;
    }

    .action-buttons {
      display: flex;
      gap: 12px;
      margin-top: 8px;
    }

    .sync-btn-content {
      display: flex;
      align-items: center;
      gap: 8px;
    }
  `,
  template: `
    <h1>Email Account</h1>

    <mat-card class="account-card">
      @if (loading()) {
        <div class="status-content">
          <mat-spinner diameter="40"></mat-spinner>
          <p>Loading account status...</p>
        </div>
      } @else if (!accountStatus() || !accountStatus()!.connected) {
        <!-- Not connected state -->
        <div class="status-content">
          <mat-icon class="status-icon disconnected">email</mat-icon>
          <h2 class="status-title">No Gmail account connected</h2>
          <p class="status-description">
            Connect your Gmail account to sync emails with your CRM.
            Emails will be automatically linked to contacts and companies.
          </p>
          <button mat-raised-button color="primary" (click)="connect()">
            <mat-icon>link</mat-icon> Connect Gmail
          </button>
        </div>
      } @else {
        <!-- Connected state -->
        <div class="status-content">
          <mat-icon class="status-icon connected">check_circle</mat-icon>
          <h2 class="status-title">Gmail Connected</h2>
          <p class="gmail-address">{{ accountStatus()!.gmailAddress }}</p>

          <span class="sync-status-badge"
                [class.active]="accountStatus()!.syncStatus === 'Active'"
                [class.error]="accountStatus()!.syncStatus === 'Error'"
                [class.paused]="accountStatus()!.syncStatus === 'Paused'">
            {{ accountStatus()!.syncStatus ?? 'Active' }}
          </span>

          @if (accountStatus()!.syncStatus === 'Error' && accountStatus()!.errorMessage) {
            <p class="error-message">{{ accountStatus()!.errorMessage }}</p>
          }

          @if (accountStatus()!.lastSyncAt) {
            <p class="last-sync">Last synced {{ formatRelativeTime(accountStatus()!.lastSyncAt!) }}</p>
          }

          <div class="action-buttons">
            <button mat-raised-button
                    [disabled]="syncing()"
                    (click)="triggerSync()">
              <span class="sync-btn-content">
                @if (syncing()) {
                  <mat-spinner diameter="16"></mat-spinner>
                  Syncing...
                } @else {
                  <mat-icon>sync</mat-icon>
                  Sync Now
                }
              </span>
            </button>

            <button mat-stroked-button color="warn"
                    (click)="disconnect()">
              <mat-icon>link_off</mat-icon> Disconnect
            </button>
          </div>
        </div>
      }
    </mat-card>
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

import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { WebhookService } from './webhook.service';

/**
 * Two-step test webhook dialog:
 * Step 1 - Preview: Fetches and displays the sample payload
 * Step 2 - Send: Enqueues the real delivery and shows confirmation
 */
@Component({
  selector: 'app-webhook-test-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .test-dialog__loading {
      display: flex;
      justify-content: center;
      padding: 32px;
    }

    .test-dialog__payload {
      font-family: 'SF Mono', 'Fira Code', monospace;
      font-size: 12px;
      background-color: var(--color-bg);
      color: var(--color-text);
      border: 1px solid var(--color-border);
      padding: 16px;
      border-radius: 8px;
      white-space: pre-wrap;
      word-break: break-all;
      max-height: 400px;
      overflow-y: auto;
      margin: 16px 0;
    }

    .test-dialog__success {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px;
      background-color: var(--color-success-soft);
      border: 1px solid var(--color-success);
      border-radius: 8px;
      margin: 16px 0;
    }

    .test-dialog__success mat-icon {
      color: var(--color-success);
      flex-shrink: 0;
    }

    .test-dialog__success p {
      margin: 0;
      font-size: 14px;
      color: var(--color-success-text);
    }

    .test-dialog__error {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px;
      background-color: var(--color-danger-soft);
      border: 1px solid var(--color-danger);
      border-radius: 8px;
      margin: 16px 0;
    }

    .test-dialog__error mat-icon {
      color: var(--color-danger);
      flex-shrink: 0;
    }

    .test-dialog__error p {
      margin: 0;
      font-size: 14px;
      color: var(--color-danger-text);
    }
  `,
  template: `
    <h2 mat-dialog-title>Test Webhook</h2>
    <mat-dialog-content>
      @if (loadingPreview()) {
        <div class="test-dialog__loading">
          <mat-spinner diameter="32"></mat-spinner>
        </div>
      } @else if (error()) {
        <div class="test-dialog__error">
          <mat-icon>error</mat-icon>
          <p>{{ error() }}</p>
        </div>
      } @else if (sent()) {
        <div class="test-dialog__success">
          <mat-icon>check_circle</mat-icon>
          <p>Test webhook sent! Check delivery logs for results.</p>
        </div>
      } @else if (previewPayload()) {
        <p style="font-size: 14px; color: var(--color-text-secondary)">
          Preview the sample payload that will be sent to your webhook endpoint:
        </p>
        <pre class="test-dialog__payload">{{ previewPayload() }}</pre>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      @if (sent()) {
        <button mat-flat-button color="primary" mat-dialog-close>Close</button>
      } @else {
        <button mat-button mat-dialog-close [disabled]="sending()">Cancel</button>
        @if (previewPayload() && !error()) {
          <button mat-flat-button color="primary"
                  [disabled]="sending()"
                  (click)="sendTest()">
            @if (sending()) {
              <mat-spinner diameter="20"></mat-spinner>
            }
            Send Test
          </button>
        }
      }
    </mat-dialog-actions>
  `,
})
export class WebhookTestDialogComponent implements OnInit {
  readonly data: { subscriptionId: string } = inject(MAT_DIALOG_DATA);
  private readonly service = inject(WebhookService);

  readonly loadingPreview = signal(true);
  readonly sending = signal(false);
  readonly sent = signal(false);
  readonly previewPayload = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    // Step 1: Fetch preview payload
    this.service.testWebhook(this.data.subscriptionId, true).subscribe({
      next: (result) => {
        // Format the payload nicely
        let payload = result.samplePayload;
        try {
          payload = JSON.stringify(JSON.parse(payload), null, 2);
        } catch {
          // Already formatted or not JSON
        }
        this.previewPayload.set(payload);
        this.loadingPreview.set(false);
      },
      error: (err) => {
        this.error.set(err?.message ?? 'Failed to load preview payload');
        this.loadingPreview.set(false);
      },
    });
  }

  sendTest(): void {
    this.sending.set(true);
    this.error.set(null);

    // Step 2: Send actual test
    this.service.testWebhook(this.data.subscriptionId, false).subscribe({
      next: () => {
        this.sending.set(false);
        this.sent.set(true);
      },
      error: (err) => {
        this.sending.set(false);
        this.error.set(err?.message ?? 'Failed to send test webhook');
      },
    });
  }
}

import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  inject,
  input,
  signal,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { WebhookStore } from './webhook.store';
import { WebhookDeliveryLog } from './webhook.models';
import { WebhookTestDialogComponent } from './webhook-test-dialog.component';
import { WebhookSecretDialogComponent } from './webhook-edit.component';
import { ConfirmDeleteDialogComponent } from '../../../shared/components/confirm-delete-dialog/confirm-delete-dialog.component';

@Component({
  selector: 'app-webhook-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    DatePipe,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatIconModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatDialogModule,
    MatTooltipModule,
  ],
  providers: [WebhookStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
    }

    .webhook-detail {
      max-width: 900px;
      margin: 0 auto;
      padding: 24px;
    }

    .webhook-detail__header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 24px;
    }

    .webhook-detail__header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 500;
      flex: 1;
    }

    .webhook-detail__actions {
      display: flex;
      gap: 8px;
    }

    .webhook-detail__loading {
      display: flex;
      justify-content: center;
      padding: 64px;
    }

    .info-card {
      margin-bottom: 24px;
    }

    .info-card mat-card-title {
      font-size: 16px;
      font-weight: 500;
    }

    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }

    .info-item {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .info-item--full {
      grid-column: 1 / -1;
    }

    .info-label {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-secondary, #64748b);
    }

    .info-value {
      font-size: 14px;
      color: var(--text-primary, #1e293b);
    }

    .info-value--mono {
      font-family: 'SF Mono', 'Fira Code', monospace;
      font-size: 13px;
    }

    .status-badge {
      display: inline-block;
      font-size: 12px;
      padding: 2px 10px;
      border-radius: 12px;
      font-weight: 500;
    }

    .status-badge--active {
      background-color: #dcfce7;
      color: #166534;
    }

    .status-badge--disabled {
      background-color: #fecaca;
      color: #991b1b;
    }

    .status-badge--paused {
      background-color: #e2e8f0;
      color: #475569;
    }

    .event-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .event-chip {
      display: inline-block;
      font-size: 12px;
      padding: 2px 8px;
      border-radius: 4px;
      background-color: #eff6ff;
      color: #1e40af;
      font-weight: 500;
    }

    .disabled-banner {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      background-color: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 8px;
      margin-bottom: 24px;
    }

    .disabled-banner mat-icon {
      color: #dc2626;
      flex-shrink: 0;
    }

    .disabled-banner__content {
      flex: 1;
    }

    .disabled-banner__content p {
      margin: 0;
      font-size: 14px;
      color: #991b1b;
    }

    .disabled-banner__content p:first-child {
      font-weight: 600;
    }

    .disabled-banner__content p:last-child {
      font-size: 13px;
      margin-top: 4px;
    }

    .delivery-section {
      margin-top: 24px;
    }

    .delivery-section h2 {
      font-size: 18px;
      font-weight: 500;
      margin: 0 0 16px 0;
    }

    .delivery-table {
      width: 100%;
      border-collapse: collapse;
    }

    .delivery-table th {
      text-align: left;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-secondary, #64748b);
      padding: 8px 12px;
      border-bottom: 2px solid var(--border-color, #e2e8f0);
    }

    .delivery-table td {
      font-size: 13px;
      padding: 10px 12px;
      border-bottom: 1px solid var(--border-color, #e2e8f0);
      color: var(--text-primary, #1e293b);
    }

    .delivery-row {
      cursor: pointer;
      transition: background-color 0.1s;
    }

    .delivery-row:hover {
      background-color: #f8fafc;
    }

    .delivery-badge {
      display: inline-block;
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 10px;
      font-weight: 600;
    }

    .delivery-badge--success {
      background-color: #dcfce7;
      color: #166534;
    }

    .delivery-badge--failed {
      background-color: #fecaca;
      color: #991b1b;
    }

    .delivery-badge--retrying {
      background-color: #fed7aa;
      color: #9a3412;
    }

    .delivery-expanded {
      background-color: #f8fafc;
    }

    .delivery-expanded td {
      padding: 16px 12px;
    }

    .delivery-detail {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .delivery-detail__section {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .delivery-detail__label {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      color: var(--text-secondary, #64748b);
    }

    .delivery-detail__value {
      font-family: 'SF Mono', 'Fira Code', monospace;
      font-size: 12px;
      background-color: #1e293b;
      color: #e2e8f0;
      padding: 12px;
      border-radius: 6px;
      white-space: pre-wrap;
      word-break: break-all;
      max-height: 200px;
      overflow-y: auto;
    }

    .delivery-empty {
      text-align: center;
      padding: 48px 24px;
      color: var(--text-secondary, #64748b);
      font-size: 14px;
    }
  `,
  template: `
    <div class="webhook-detail">
      @if (store.loading() && !store.selectedSubscription()) {
        <div class="webhook-detail__loading">
          <mat-spinner diameter="48"></mat-spinner>
        </div>
      }
      @if (store.selectedSubscription(); as sub) {
        <div class="webhook-detail__header">
          <a mat-icon-button routerLink="/settings/webhooks" aria-label="Back to list">
            <mat-icon>arrow_back</mat-icon>
          </a>
          <h1>{{ sub.name }}</h1>
          <div class="webhook-detail__actions">
            <button mat-stroked-button (click)="onTest()">
              <mat-icon>science</mat-icon>
              Test
            </button>
            <button mat-stroked-button (click)="onRegenerateSecret()">
              <mat-icon>key</mat-icon>
              Regenerate Secret
            </button>
            <button mat-stroked-button (click)="onToggle()">
              <mat-icon>{{ sub.isActive ? 'pause' : 'play_arrow' }}</mat-icon>
              {{ sub.isActive ? 'Pause' : 'Enable' }}
            </button>
            <a mat-stroked-button [routerLink]="['/settings/webhooks', sub.id, 'edit']">
              <mat-icon>edit</mat-icon>
              Edit
            </a>
          </div>
        </div>

        <!-- Auto-disabled banner -->
        @if (sub.isDisabled) {
          <div class="disabled-banner">
            <mat-icon>error</mat-icon>
            <div class="disabled-banner__content">
              <p>This webhook has been automatically disabled</p>
              @if (sub.disabledReason) {
                <p>{{ sub.disabledReason }}</p>
              }
              @if (sub.disabledAt) {
                <p>Disabled at: {{ sub.disabledAt | date:'medium' }}</p>
              }
            </div>
            <button mat-flat-button color="primary" (click)="onToggle()">
              Re-enable
            </button>
          </div>
        }

        <!-- Info Card -->
        <mat-card class="info-card">
          <mat-card-header>
            <mat-card-title>Subscription Details</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="info-grid">
              <div class="info-item">
                <span class="info-label">Status</span>
                <span>
                  <span class="status-badge"
                        [class.status-badge--active]="sub.isActive && !sub.isDisabled"
                        [class.status-badge--disabled]="sub.isDisabled"
                        [class.status-badge--paused]="!sub.isActive && !sub.isDisabled">
                    {{ getStatusLabel(sub) }}
                  </span>
                </span>
              </div>

              <div class="info-item">
                <span class="info-label">Secret</span>
                <span class="info-value info-value--mono">{{ sub.secretMask }}</span>
              </div>

              <div class="info-item info-item--full">
                <span class="info-label">URL</span>
                <span class="info-value info-value--mono">{{ sub.url }}</span>
              </div>

              <div class="info-item info-item--full">
                <span class="info-label">Event Subscriptions</span>
                <div class="event-chips">
                  @for (event of sub.eventSubscriptions; track event) {
                    <span class="event-chip">{{ formatEvent(event) }}</span>
                  }
                </div>
              </div>

              <div class="info-item">
                <span class="info-label">Include Custom Fields</span>
                <span class="info-value">{{ sub.includeCustomFields ? 'Yes' : 'No' }}</span>
              </div>

              <div class="info-item">
                <span class="info-label">Created</span>
                <span class="info-value">{{ sub.createdAt | date:'medium' }}</span>
              </div>

              <div class="info-item">
                <span class="info-label">Last Delivery</span>
                @if (sub.lastDeliveryAt) {
                  <span class="info-value">{{ sub.lastDeliveryAt | date:'medium' }}</span>
                } @else {
                  <span class="info-value">Never</span>
                }
              </div>

              <div class="info-item">
                <span class="info-label">Consecutive Failures</span>
                <span class="info-value" [style.color]="sub.consecutiveFailureCount > 0 ? '#dc2626' : ''">
                  {{ sub.consecutiveFailureCount }}
                </span>
              </div>
            </div>
          </mat-card-content>
        </mat-card>

        <!-- Delivery Logs Section -->
        <div class="delivery-section">
          <h2>Delivery Logs</h2>

          @if (store.deliveryLogs(); as logs) {
            @if (logs.items.length === 0) {
              <div class="delivery-empty">
                No delivery logs found for this subscription.
              </div>
            } @else {
              <table class="delivery-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Event</th>
                    <th>Status</th>
                    <th>HTTP Code</th>
                    <th>Duration</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  @for (log of logs.items; track log.id) {
                    <tr class="delivery-row" (click)="toggleExpanded(log.id)">
                      <td>{{ log.createdAt | date:'short' }}</td>
                      <td>{{ formatEvent(log.eventType) }}</td>
                      <td>
                        <span class="delivery-badge"
                              [class.delivery-badge--success]="log.success"
                              [class.delivery-badge--failed]="!log.success && log.attemptNumber >= 7"
                              [class.delivery-badge--retrying]="!log.success && log.attemptNumber < 7">
                          {{ log.success ? 'Success' : (log.attemptNumber < 7 ? 'Retrying' : 'Failed') }}
                        </span>
                      </td>
                      <td>{{ log.httpStatusCode ?? '-' }}</td>
                      <td>{{ log.durationMs }}ms</td>
                      <td>
                        @if (!log.success) {
                          <button mat-icon-button
                                  matTooltip="Retry delivery"
                                  (click)="onRetry(log, $event)">
                            <mat-icon>replay</mat-icon>
                          </button>
                        }
                      </td>
                    </tr>
                    @if (isExpanded(log.id)) {
                      <tr class="delivery-expanded">
                        <td colspan="6">
                          <div class="delivery-detail">
                            <div class="delivery-detail__section">
                              <span class="delivery-detail__label">Request Payload</span>
                              <pre class="delivery-detail__value">{{ formatJson(log.requestPayload) }}</pre>
                            </div>
                            @if (log.responseBody) {
                              <div class="delivery-detail__section">
                                <span class="delivery-detail__label">Response Body</span>
                                <pre class="delivery-detail__value">{{ truncate(log.responseBody, 1024) }}</pre>
                              </div>
                            }
                            @if (log.errorMessage) {
                              <div class="delivery-detail__section">
                                <span class="delivery-detail__label">Error Message</span>
                                <pre class="delivery-detail__value">{{ log.errorMessage }}</pre>
                              </div>
                            }
                            <div class="delivery-detail__section">
                              <span class="delivery-detail__label">Attempt Number</span>
                              <span class="info-value">{{ log.attemptNumber }}</span>
                            </div>
                          </div>
                        </td>
                      </tr>
                    }
                  }
                </tbody>
              </table>

              <mat-paginator
                [length]="logs.totalCount"
                [pageSize]="logsPageSize"
                [pageIndex]="logsPage() - 1"
                [pageSizeOptions]="[10, 25, 50]"
                (page)="onPageChange($event)">
              </mat-paginator>
            }
          } @else {
            <div style="display: flex; justify-content: center; padding: 24px">
              <mat-spinner diameter="32"></mat-spinner>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class WebhookDetailComponent implements OnInit {
  readonly id = input.required<string>();
  readonly store = inject(WebhookStore);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  readonly logsPage = signal(1);
  readonly logsPageSize = 25;
  private readonly expandedRows = signal<Set<string>>(new Set());

  ngOnInit(): void {
    const subId = this.id();
    this.store.loadSubscription(subId);
    this.store.loadDeliveryLogs(1, this.logsPageSize, subId);
  }

  getStatusLabel(sub: { isActive: boolean; isDisabled: boolean }): string {
    if (sub.isDisabled) return 'Disabled';
    if (!sub.isActive) return 'Paused';
    return 'Active';
  }

  formatEvent(event: string): string {
    // "Contact.Created" -> "Contact Created"
    return event.replace('.', ' ');
  }

  formatJson(payload: string): string {
    try {
      return JSON.stringify(JSON.parse(payload), null, 2);
    } catch {
      return payload;
    }
  }

  truncate(text: string, maxLen: number): string {
    if (text.length <= maxLen) return text;
    return text.substring(0, maxLen) + '...';
  }

  isExpanded(logId: string): boolean {
    return this.expandedRows().has(logId);
  }

  toggleExpanded(logId: string): void {
    this.expandedRows.update((set) => {
      const newSet = new Set(set);
      if (newSet.has(logId)) {
        newSet.delete(logId);
      } else {
        newSet.add(logId);
      }
      return newSet;
    });
  }

  onPageChange(event: PageEvent): void {
    this.logsPage.set(event.pageIndex + 1);
    this.store.loadDeliveryLogs(
      event.pageIndex + 1,
      event.pageSize,
      this.id(),
    );
  }

  onTest(): void {
    this.dialog.open(WebhookTestDialogComponent, {
      width: '600px',
      data: { subscriptionId: this.id() },
    });
  }

  onRegenerateSecret(): void {
    const confirmRef = this.dialog.open(ConfirmDeleteDialogComponent, {
      width: '400px',
      data: {
        name: 'the current secret',
        type: 'action',
      },
    });

    confirmRef.afterClosed().subscribe((confirmed: boolean) => {
      if (!confirmed) return;

      this.store.regenerateSecret(this.id(), (secret) => {
        this.dialog.open(WebhookSecretDialogComponent, {
          width: '500px',
          disableClose: true,
          data: { secret },
        });
        this.snackBar.open('Secret regenerated.', 'Close', {
          duration: 3000,
        });
      });
    });
  }

  onToggle(): void {
    this.store.toggleSubscription(this.id(), (updated) => {
      const label = updated.isActive ? 'enabled' : 'paused';
      this.snackBar.open(`Webhook ${label}.`, 'Close', { duration: 3000 });
    });
  }

  onRetry(log: WebhookDeliveryLog, event: Event): void {
    event.stopPropagation();
    this.store.retryDelivery(log.id, () => {
      this.snackBar.open('Delivery retry enqueued.', 'Close', {
        duration: 3000,
      });
    });
  }
}

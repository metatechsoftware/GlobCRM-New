import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { WebhookStore } from './webhook.store';
import {
  WebhookDeliveryLog,
  WebhookSubscription,
} from './webhook.models';
import { WebhookService } from './webhook.service';

@Component({
  selector: 'app-webhook-delivery-log',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    DatePipe,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSnackBarModule,
    MatTooltipModule,
  ],
  providers: [WebhookStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
    }

    .delivery-log {
      max-width: 1100px;
      margin: 0 auto;
      padding: 24px;
    }

    .delivery-log__header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }

    .delivery-log__header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 500;
      flex: 1;
    }

    .delivery-log__subtitle {
      color: var(--text-secondary, #64748b);
      font-size: 14px;
      margin: 0 0 24px 0;
      padding-left: 48px;
    }

    .delivery-log__filters {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 16px;
    }

    .delivery-log__loading {
      display: flex;
      justify-content: center;
      padding: 64px;
    }

    .delivery-log__empty {
      text-align: center;
      padding: 64px 24px;
      color: var(--text-secondary, #64748b);
    }

    .delivery-log__empty mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      margin-bottom: 16px;
      opacity: 0.5;
    }

    .delivery-log__empty h3 {
      margin: 0 0 8px 0;
      font-weight: 500;
      color: var(--text-primary, #1e293b);
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

    .subscription-link {
      color: var(--primary, #4f46e5);
      text-decoration: none;
      cursor: pointer;
    }

    .subscription-link:hover {
      text-decoration: underline;
    }
  `,
  template: `
    <div class="delivery-log">
      <div class="delivery-log__header">
        <a mat-icon-button routerLink="/settings/webhooks" aria-label="Back to webhooks">
          <mat-icon>arrow_back</mat-icon>
        </a>
        <h1>Delivery Logs</h1>
      </div>
      <p class="delivery-log__subtitle">Monitor webhook delivery attempts across all subscriptions</p>

      <!-- Subscription filter -->
      <div class="delivery-log__filters">
        <mat-form-field appearance="outline" style="width: 300px">
          <mat-label>Filter by subscription</mat-label>
          <mat-select [value]="selectedSubscriptionId()" (selectionChange)="onFilterChange($event.value)">
            <mat-option value="">All subscriptions</mat-option>
            @for (sub of subscriptions(); track sub.id) {
              <mat-option [value]="sub.id">{{ sub.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      </div>

      @if (store.loading() && !store.deliveryLogs()) {
        <div class="delivery-log__loading">
          <mat-spinner diameter="48"></mat-spinner>
        </div>
      }
      @if (store.deliveryLogs(); as logs) {
        @if (logs.items.length === 0) {
          <div class="delivery-log__empty">
            <mat-icon>inbox</mat-icon>
            <h3>No delivery logs</h3>
            <p>Delivery logs will appear here once webhooks start firing.</p>
          </div>
        } @else {
          <table class="delivery-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Subscription</th>
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
                  <td>
                    <a class="subscription-link"
                       [routerLink]="['/settings/webhooks', log.subscriptionId]"
                       (click)="$event.stopPropagation()">
                      {{ log.subscriptionName }}
                    </a>
                  </td>
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
                    <td colspan="7">
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
                          <span style="font-size: 14px; color: var(--text-primary, #1e293b)">{{ log.attemptNumber }}</span>
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
            [pageSize]="pageSize"
            [pageIndex]="page() - 1"
            [pageSizeOptions]="[10, 25, 50, 100]"
            (page)="onPageChange($event)">
          </mat-paginator>
        }
      }
    </div>
  `,
})
export class WebhookDeliveryLogComponent implements OnInit {
  readonly store = inject(WebhookStore);
  private readonly webhookService = inject(WebhookService);
  private readonly snackBar = inject(MatSnackBar);

  readonly page = signal(1);
  readonly pageSize = 25;
  readonly selectedSubscriptionId = signal('');
  readonly subscriptions = signal<WebhookSubscription[]>([]);
  private readonly expandedRows = signal<Set<string>>(new Set());

  ngOnInit(): void {
    this.store.loadDeliveryLogs(1, this.pageSize);

    // Load subscription list for the filter dropdown
    this.webhookService.getSubscriptions().subscribe({
      next: (subs) => this.subscriptions.set(subs),
      error: () => {},
    });
  }

  formatEvent(event: string): string {
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

  onFilterChange(subscriptionId: string): void {
    this.selectedSubscriptionId.set(subscriptionId);
    this.page.set(1);
    if (subscriptionId) {
      this.store.loadDeliveryLogs(1, this.pageSize, subscriptionId);
    } else {
      this.store.loadDeliveryLogs(1, this.pageSize);
    }
  }

  onPageChange(event: PageEvent): void {
    this.page.set(event.pageIndex + 1);
    const subId = this.selectedSubscriptionId() || undefined;
    this.store.loadDeliveryLogs(event.pageIndex + 1, event.pageSize, subId);
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

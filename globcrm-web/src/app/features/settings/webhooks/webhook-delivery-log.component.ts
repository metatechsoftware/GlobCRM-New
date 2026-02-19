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
    /* ── Keyframes ─────────────────────────────────── */
    @keyframes fadeSlideUp {
      from { opacity: 0; transform: translateY(16px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    @keyframes glowPulse {
      0%, 100% { box-shadow: 0 4px 16px rgba(59,130,246,0.25), 0 0 0 4px rgba(59,130,246,0.08); }
      50%      { box-shadow: 0 4px 20px rgba(59,130,246,0.35), 0 0 0 6px rgba(59,130,246,0.12); }
    }

    /* ── Host ──────────────────────────────────────── */
    :host {
      display: block;
    }

    /* ── Page Container ────────────────────────────── */
    .dl-page {
      max-width: 1100px;
      margin: 0 auto;
      padding: var(--space-6);
    }

    /* ── Header ────────────────────────────────────── */
    .dl-header {
      margin-bottom: var(--space-8);
      opacity: 0;
      animation: fadeSlideUp 0.4s var(--ease-out) forwards;
    }

    .dl-header__breadcrumb {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      font-size: var(--text-sm);
      font-weight: var(--font-medium);
      color: var(--color-text-muted);
      text-decoration: none;
      margin-bottom: var(--space-4);
      transition: color var(--duration-fast) var(--ease-default);
    }

    .dl-header__breadcrumb mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    .dl-header__breadcrumb:hover {
      color: var(--color-info);
    }

    .dl-header__top {
      display: flex;
      align-items: center;
      gap: var(--space-5);
    }

    .dl-header__icon-wrap {
      width: 52px;
      height: 52px;
      border-radius: var(--radius-lg);
      background: linear-gradient(135deg, var(--color-info) 0%, var(--color-info-text) 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      animation: glowPulse 4s ease-in-out infinite;
    }

    .dl-header__icon-wrap mat-icon {
      font-size: 26px;
      width: 26px;
      height: 26px;
      color: #fff;
    }

    .dl-header__text {
      flex: 1;
      min-width: 0;
    }

    .dl-header__title {
      font-size: var(--text-2xl);
      font-weight: var(--font-bold);
      letter-spacing: -0.5px;
      margin: 0;
      color: var(--color-text);
      line-height: var(--leading-tight);
    }

    .dl-header__subtitle {
      font-size: var(--text-base);
      color: var(--color-text-secondary);
      margin: var(--space-1) 0 0;
      line-height: var(--leading-normal);
    }

    /* ── Section Card ──────────────────────────────── */
    .dl-section {
      background: var(--color-surface);
      border: 1.5px solid var(--color-border);
      border-radius: 14px;
      padding: var(--space-6);
      box-shadow: var(--shadow-sm);
      opacity: 0;
      animation: fadeSlideUp 0.4s var(--ease-out) 0.1s forwards;
    }

    /* ── Filters ───────────────────────────────────── */
    .dl-filters {
      display: flex;
      align-items: center;
      gap: var(--space-4);
      padding-bottom: var(--space-5);
      margin-bottom: var(--space-5);
      border-bottom: 1px solid var(--color-border-subtle);
    }

    .dl-filters__icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
      color: var(--color-info);
      flex-shrink: 0;
    }

    .dl-filters__label {
      font-size: var(--text-sm);
      font-weight: var(--font-semibold);
      color: var(--color-text-secondary);
      flex-shrink: 0;
    }

    /* ── Loading ───────────────────────────────────── */
    .dl-loading {
      display: flex;
      justify-content: center;
      padding: var(--space-16);
      opacity: 0;
      animation: fadeSlideUp 0.35s var(--ease-out) forwards;
    }

    /* ── Empty State ───────────────────────────────── */
    .dl-empty {
      text-align: center;
      padding: var(--space-16) var(--space-6);
      opacity: 0;
      animation: fadeSlideUp 0.35s var(--ease-out) 0.15s forwards;
    }

    .dl-empty__icon-wrap {
      width: 80px;
      height: 80px;
      border-radius: var(--radius-full);
      background: var(--color-bg-secondary);
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto var(--space-5);
    }

    .dl-empty__icon-wrap mat-icon {
      font-size: 36px;
      width: 36px;
      height: 36px;
      color: var(--color-text-muted);
      opacity: 0.6;
    }

    .dl-empty__title {
      font-size: var(--text-md);
      font-weight: var(--font-semibold);
      color: var(--color-text);
      margin: 0 0 var(--space-2) 0;
    }

    .dl-empty__text {
      font-size: var(--text-base);
      color: var(--color-text-secondary);
      margin: 0;
      line-height: var(--leading-relaxed);
    }

    /* ── Delivery Table ────────────────────────────── */
    .dl-table {
      width: 100%;
      border-collapse: collapse;
    }

    .dl-table th {
      text-align: left;
      font-size: var(--text-xs);
      font-weight: var(--font-semibold);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--color-text-muted);
      padding: var(--space-2) var(--space-3);
      border-bottom: 2px solid var(--color-border);
    }

    .dl-table td {
      font-size: var(--text-sm);
      padding: var(--space-3) var(--space-3);
      border-bottom: 1px solid var(--color-border-subtle);
      color: var(--color-text);
    }

    .dl-row {
      cursor: pointer;
      transition: background-color var(--duration-fast) var(--ease-default);
      border-left: 3px solid transparent;
    }

    .dl-row:hover {
      background: var(--color-surface-hover);
    }

    .dl-row--success {
      border-left-color: var(--color-success);
    }

    .dl-row--failed {
      border-left-color: var(--color-danger);
    }

    .dl-row--retrying {
      border-left-color: var(--color-warning);
    }

    /* ── Delivery Badge ────────────────────────────── */
    .dl-badge {
      display: inline-block;
      font-size: 11px;
      padding: var(--space-0-5) var(--space-2);
      border-radius: var(--radius-full);
      font-weight: var(--font-semibold);
    }

    .dl-badge--success {
      background: var(--color-success-soft);
      color: var(--color-success-text);
    }

    .dl-badge--failed {
      background: var(--color-danger-soft);
      color: var(--color-danger-text);
    }

    .dl-badge--retrying {
      background: var(--color-warning-soft);
      color: var(--color-warning-text);
    }

    /* ── Expanded Row ──────────────────────────────── */
    .dl-expanded {
      background: var(--color-surface-hover);
    }

    .dl-expanded td {
      padding: var(--space-4) var(--space-3);
    }

    .dl-detail {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }

    .dl-detail__section {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
    }

    .dl-detail__label {
      font-size: 11px;
      font-weight: var(--font-semibold);
      text-transform: uppercase;
      color: var(--color-text-muted);
    }

    .dl-detail__value {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      background: var(--color-bg);
      color: var(--color-text);
      border: 1px solid var(--color-border);
      padding: var(--space-3);
      border-radius: var(--radius-md);
      white-space: pre-wrap;
      word-break: break-all;
      max-height: 200px;
      overflow-y: auto;
    }

    .dl-detail__attempt {
      font-size: var(--text-base);
      color: var(--color-text);
    }

    /* ── Subscription Link ─────────────────────────── */
    .dl-sub-link {
      color: var(--color-info);
      text-decoration: none;
      font-weight: var(--font-medium);
      cursor: pointer;
      transition: color var(--duration-fast) var(--ease-default);
    }

    .dl-sub-link:hover {
      color: var(--color-info-text);
      text-decoration: underline;
    }

    /* ── Responsive ────────────────────────────────── */
    @media (max-width: 768px) {
      .dl-page {
        padding: var(--space-4);
      }

      .dl-header__top {
        flex-wrap: wrap;
      }

      .dl-header__icon-wrap {
        width: 44px;
        height: 44px;
        border-radius: var(--radius-md);
      }

      .dl-header__icon-wrap mat-icon {
        font-size: 22px;
        width: 22px;
        height: 22px;
      }

      .dl-header__title {
        font-size: var(--text-xl);
      }

      .dl-section {
        padding: var(--space-4);
      }

      .dl-filters {
        flex-wrap: wrap;
      }

      .dl-table th:nth-child(6),
      .dl-table td:nth-child(6) {
        display: none;
      }
    }

    /* ── Reduced Motion ────────────────────────────── */
    @media (prefers-reduced-motion: reduce) {
      .dl-header,
      .dl-section,
      .dl-loading,
      .dl-empty {
        animation: none;
        opacity: 1;
      }
      .dl-header__icon-wrap {
        animation: none;
      }
    }
  `,
  template: `
    <div class="dl-page">
      <!-- Header -->
      <div class="dl-header">
        <a class="dl-header__breadcrumb" routerLink="/settings/webhooks">
          <mat-icon>arrow_back</mat-icon>
          Webhooks
        </a>

        <div class="dl-header__top">
          <div class="dl-header__icon-wrap">
            <mat-icon>history</mat-icon>
          </div>
          <div class="dl-header__text">
            <h1 class="dl-header__title">Delivery Logs</h1>
            <p class="dl-header__subtitle">View all webhook delivery attempts</p>
          </div>
        </div>
      </div>

      <!-- Main Section Card -->
      <div class="dl-section">
        <!-- Filters -->
        <div class="dl-filters">
          <mat-icon class="dl-filters__icon">filter_list</mat-icon>
          <span class="dl-filters__label">Filter</span>
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
          <div class="dl-loading">
            <mat-spinner diameter="48"></mat-spinner>
          </div>
        }
        @if (store.deliveryLogs(); as logs) {
          @if (logs.items.length === 0) {
            <div class="dl-empty">
              <div class="dl-empty__icon-wrap">
                <mat-icon>send</mat-icon>
              </div>
              <h3 class="dl-empty__title">No delivery logs</h3>
              <p class="dl-empty__text">Delivery logs will appear here once webhooks start firing.</p>
            </div>
          } @else {
            <table class="dl-table">
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
                  <tr class="dl-row"
                      [class.dl-row--success]="log.success"
                      [class.dl-row--failed]="!log.success && log.attemptNumber >= 7"
                      [class.dl-row--retrying]="!log.success && log.attemptNumber < 7"
                      (click)="toggleExpanded(log.id)">
                    <td>{{ log.createdAt | date:'short' }}</td>
                    <td>
                      <a class="dl-sub-link"
                         [routerLink]="['/settings/webhooks', log.subscriptionId]"
                         (click)="$event.stopPropagation()">
                        {{ log.subscriptionName }}
                      </a>
                    </td>
                    <td>{{ formatEvent(log.eventType) }}</td>
                    <td>
                      <span class="dl-badge"
                            [class.dl-badge--success]="log.success"
                            [class.dl-badge--failed]="!log.success && log.attemptNumber >= 7"
                            [class.dl-badge--retrying]="!log.success && log.attemptNumber < 7">
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
                    <tr class="dl-expanded">
                      <td colspan="7">
                        <div class="dl-detail">
                          <div class="dl-detail__section">
                            <span class="dl-detail__label">Request Payload</span>
                            <pre class="dl-detail__value">{{ formatJson(log.requestPayload) }}</pre>
                          </div>
                          @if (log.responseBody) {
                            <div class="dl-detail__section">
                              <span class="dl-detail__label">Response Body</span>
                              <pre class="dl-detail__value">{{ truncate(log.responseBody, 1024) }}</pre>
                            </div>
                          }
                          @if (log.errorMessage) {
                            <div class="dl-detail__section">
                              <span class="dl-detail__label">Error Message</span>
                              <pre class="dl-detail__value">{{ log.errorMessage }}</pre>
                            </div>
                          }
                          <div class="dl-detail__section">
                            <span class="dl-detail__label">Attempt Number</span>
                            <span class="dl-detail__attempt">{{ log.attemptNumber }}</span>
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

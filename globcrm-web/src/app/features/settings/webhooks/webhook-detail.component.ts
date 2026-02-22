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
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';

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
    TranslocoPipe,
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
      0%, 100% { box-shadow: 0 4px 16px rgba(96,165,250,0.25), 0 0 0 4px rgba(96,165,250,0.08); }
      50%      { box-shadow: 0 4px 20px rgba(96,165,250,0.35), 0 0 0 6px rgba(96,165,250,0.12); }
    }

    /* ── Host ──────────────────────────────────────── */
    :host {
      display: block;
    }

    /* ── Page Container ────────────────────────────── */
    .wd-page {
      max-width: 940px;
      margin: 0 auto;
      padding: var(--space-6);
    }

    /* ── Loading ───────────────────────────────────── */
    .wd-loading {
      display: flex;
      justify-content: center;
      padding: var(--space-16);
      opacity: 0;
      animation: fadeSlideUp 0.35s var(--ease-out) forwards;
    }

    /* ── Header ────────────────────────────────────── */
    .wd-header {
      margin-bottom: var(--space-8);
      opacity: 0;
      animation: fadeSlideUp 0.4s var(--ease-out) forwards;
    }

    .wd-header__breadcrumb {
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

    .wd-header__breadcrumb mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    .wd-header__breadcrumb:hover {
      color: var(--color-info);
    }

    .wd-header__top {
      display: flex;
      align-items: center;
      gap: var(--space-5);
    }

    .wd-header__icon-wrap {
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

    .wd-header__icon-wrap mat-icon {
      font-size: 26px;
      width: 26px;
      height: 26px;
      color: #fff;
    }

    .wd-header__text {
      flex: 1;
      min-width: 0;
    }

    .wd-header__title {
      font-size: var(--text-2xl);
      font-weight: var(--font-bold);
      letter-spacing: -0.5px;
      margin: 0;
      color: var(--color-text);
      line-height: var(--leading-tight);
    }

    .wd-header__subtitle {
      font-size: var(--text-base);
      color: var(--color-text-secondary);
      margin: var(--space-1) 0 0;
      line-height: var(--leading-normal);
    }

    .wd-header__actions {
      display: flex;
      gap: var(--space-2);
      flex-shrink: 0;
      flex-wrap: wrap;
    }

    /* ── Disabled Banner ───────────────────────────── */
    .wd-banner {
      display: flex;
      align-items: center;
      gap: var(--space-4);
      padding: var(--space-4) var(--space-5);
      background: var(--color-danger-soft);
      border: 1.5px solid var(--color-danger);
      border-radius: 14px;
      margin-bottom: var(--space-6);
      opacity: 0;
      animation: fadeSlideUp 0.4s var(--ease-out) 0.1s forwards;
    }

    .wd-banner__icon {
      color: var(--color-danger);
      flex-shrink: 0;
      font-size: 24px;
      width: 24px;
      height: 24px;
    }

    .wd-banner__content {
      flex: 1;
    }

    .wd-banner__content p {
      margin: 0;
      font-size: var(--text-base);
      color: var(--color-danger-text);
    }

    .wd-banner__content p:first-child {
      font-weight: var(--font-semibold);
    }

    .wd-banner__content p + p {
      font-size: var(--text-sm);
      margin-top: var(--space-1);
    }

    /* ── Section Card ──────────────────────────────── */
    .wd-section {
      background: var(--color-surface);
      border: 1.5px solid var(--color-border);
      border-radius: 14px;
      padding: var(--space-6);
      margin-bottom: var(--space-6);
      box-shadow: var(--shadow-sm);
      opacity: 0;
      animation: fadeSlideUp 0.4s var(--ease-out) forwards;
    }

    .wd-section--info {
      animation-delay: 0.1s;
    }

    .wd-section--delivery {
      animation-delay: 0.2s;
    }

    .wd-section__header {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      margin-bottom: var(--space-5);
      padding-bottom: var(--space-4);
      border-bottom: 1px solid var(--color-border-subtle);
    }

    .wd-section__header-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
      color: var(--color-info);
    }

    .wd-section__header-title {
      font-size: var(--text-md);
      font-weight: var(--font-semibold);
      margin: 0;
      color: var(--color-text);
    }

    /* ── Info Grid ─────────────────────────────────── */
    .wd-info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--space-5);
    }

    .wd-info-item {
      display: flex;
      flex-direction: column;
      gap: var(--space-1-5);
    }

    .wd-info-item--full {
      grid-column: 1 / -1;
    }

    .wd-info-label {
      display: flex;
      align-items: center;
      gap: var(--space-1-5);
      font-size: var(--text-xs);
      font-weight: var(--font-semibold);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--color-text-muted);
    }

    .wd-info-label mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
      color: var(--color-text-muted);
    }

    .wd-info-value {
      font-size: var(--text-base);
      color: var(--color-text);
    }

    .wd-info-value--mono {
      font-family: var(--font-mono);
      font-size: var(--text-sm);
      background: var(--color-bg-secondary);
      padding: var(--space-1-5) var(--space-3);
      border-radius: var(--radius-md);
      word-break: break-all;
    }

    .wd-info-value--failure {
      color: var(--color-danger-text);
      font-weight: var(--font-semibold);
    }

    /* ── Status Badge ──────────────────────────────── */
    .wd-status-badge {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1-5);
      font-size: var(--text-xs);
      padding: var(--space-1) var(--space-3);
      border-radius: var(--radius-full);
      font-weight: var(--font-semibold);
    }

    .wd-status-badge__dot {
      width: 7px;
      height: 7px;
      border-radius: var(--radius-full);
    }

    .wd-status-badge--active {
      background: var(--color-success-soft);
      color: var(--color-success-text);
    }

    .wd-status-badge--active .wd-status-badge__dot {
      background: var(--color-success);
    }

    .wd-status-badge--paused {
      background: var(--color-warning-soft);
      color: var(--color-warning-text);
    }

    .wd-status-badge--paused .wd-status-badge__dot {
      background: var(--color-warning);
    }

    .wd-status-badge--disabled {
      background: var(--color-danger-soft);
      color: var(--color-danger-text);
    }

    .wd-status-badge--disabled .wd-status-badge__dot {
      background: var(--color-danger);
    }

    /* ── Event Chips ───────────────────────────────── */
    .wd-event-chips {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-1-5);
    }

    .wd-event-chip {
      display: inline-block;
      font-size: var(--text-xs);
      padding: var(--space-1) var(--space-2);
      border-radius: var(--radius-md);
      background: var(--color-primary-soft);
      color: var(--color-primary-text);
      font-weight: var(--font-medium);
    }

    /* ── Delivery Table ────────────────────────────── */
    .wd-delivery-table {
      width: 100%;
      border-collapse: collapse;
    }

    .wd-delivery-table th {
      text-align: left;
      font-size: var(--text-xs);
      font-weight: var(--font-semibold);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--color-text-muted);
      padding: var(--space-2) var(--space-3);
      border-bottom: 2px solid var(--color-border);
    }

    .wd-delivery-table td {
      font-size: var(--text-sm);
      padding: var(--space-3) var(--space-3);
      border-bottom: 1px solid var(--color-border-subtle);
      color: var(--color-text);
    }

    .wd-delivery-row {
      cursor: pointer;
      transition: background-color var(--duration-fast) var(--ease-default);
      border-left: 3px solid transparent;
    }

    .wd-delivery-row:hover {
      background: var(--color-surface-hover);
    }

    .wd-delivery-row--success {
      border-left-color: var(--color-success);
    }

    .wd-delivery-row--failed {
      border-left-color: var(--color-danger);
    }

    .wd-delivery-row--retrying {
      border-left-color: var(--color-warning);
    }

    /* ── Delivery Badge ────────────────────────────── */
    .wd-delivery-badge {
      display: inline-block;
      font-size: 11px;
      padding: var(--space-0-5) var(--space-2);
      border-radius: var(--radius-full);
      font-weight: var(--font-semibold);
    }

    .wd-delivery-badge--success {
      background: var(--color-success-soft);
      color: var(--color-success-text);
    }

    .wd-delivery-badge--failed {
      background: var(--color-danger-soft);
      color: var(--color-danger-text);
    }

    .wd-delivery-badge--retrying {
      background: var(--color-warning-soft);
      color: var(--color-warning-text);
    }

    /* ── Delivery Expanded Row ─────────────────────── */
    .wd-delivery-expanded {
      background: var(--color-surface-hover);
    }

    .wd-delivery-expanded td {
      padding: var(--space-4) var(--space-3);
    }

    .wd-delivery-detail {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }

    .wd-delivery-detail__section {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
    }

    .wd-delivery-detail__label {
      font-size: 11px;
      font-weight: var(--font-semibold);
      text-transform: uppercase;
      color: var(--color-text-muted);
    }

    .wd-delivery-detail__value {
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

    /* ── Delivery Empty ────────────────────────────── */
    .wd-delivery-empty {
      text-align: center;
      padding: var(--space-12) var(--space-6);
    }

    .wd-delivery-empty__icon-wrap {
      width: 64px;
      height: 64px;
      border-radius: var(--radius-full);
      background: var(--color-bg-secondary);
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto var(--space-4);
    }

    .wd-delivery-empty__icon-wrap mat-icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
      color: var(--color-text-muted);
    }

    .wd-delivery-empty__text {
      font-size: var(--text-base);
      color: var(--color-text-secondary);
      margin: 0;
    }

    /* ── Delivery Spinner ──────────────────────────── */
    .wd-delivery-spinner {
      display: flex;
      justify-content: center;
      padding: var(--space-6);
    }

    /* ── Responsive ────────────────────────────────── */
    @media (max-width: 768px) {
      .wd-page {
        padding: var(--space-4);
      }

      .wd-header__top {
        flex-wrap: wrap;
      }

      .wd-header__icon-wrap {
        width: 44px;
        height: 44px;
        border-radius: var(--radius-md);
      }

      .wd-header__icon-wrap mat-icon {
        font-size: 22px;
        width: 22px;
        height: 22px;
      }

      .wd-header__title {
        font-size: var(--text-xl);
      }

      .wd-header__actions {
        width: 100%;
        justify-content: flex-end;
      }

      .wd-info-grid {
        grid-template-columns: 1fr;
      }

      .wd-section {
        padding: var(--space-4);
      }

      .wd-delivery-table th:nth-child(5),
      .wd-delivery-table td:nth-child(5) {
        display: none;
      }
    }

    /* ── Reduced Motion ────────────────────────────── */
    @media (prefers-reduced-motion: reduce) {
      .wd-header,
      .wd-section,
      .wd-banner,
      .wd-loading {
        animation: none;
        opacity: 1;
      }
      .wd-header__icon-wrap {
        animation: none;
      }
    }
  `,
  template: `
    <div class="wd-page">
      @if (store.loading() && !store.selectedSubscription()) {
        <div class="wd-loading">
          <mat-spinner diameter="48"></mat-spinner>
        </div>
      }
      @if (store.selectedSubscription(); as sub) {
        <!-- Header -->
        <div class="wd-header">
          <a class="wd-header__breadcrumb" routerLink="/settings/webhooks">
            <mat-icon>arrow_back</mat-icon>
            {{ 'settings.webhooks.detail.breadcrumb' | transloco }}
          </a>

          <div class="wd-header__top">
            <div class="wd-header__icon-wrap">
              <mat-icon>webhook</mat-icon>
            </div>
            <div class="wd-header__text">
              <h1 class="wd-header__title">{{ sub.name }}</h1>
              <p class="wd-header__subtitle">{{ 'settings.webhooks.detail.subtitle' | transloco }}</p>
            </div>
            <div class="wd-header__actions">
              <button mat-stroked-button (click)="onTest()">
                <mat-icon>science</mat-icon>
                {{ 'settings.webhooks.detail.test' | transloco }}
              </button>
              <button mat-stroked-button (click)="onRegenerateSecret()">
                <mat-icon>key</mat-icon>
                {{ 'settings.webhooks.detail.regenerateSecret' | transloco }}
              </button>
              <button mat-stroked-button (click)="onToggle()">
                <mat-icon>{{ sub.isActive ? 'pause' : 'play_arrow' }}</mat-icon>
                {{ sub.isActive ? ('settings.webhooks.detail.pause' | transloco) : ('settings.webhooks.detail.enable' | transloco) }}
              </button>
              <a mat-stroked-button [routerLink]="['/settings/webhooks', sub.id, 'edit']">
                <mat-icon>edit</mat-icon>
                {{ 'settings.webhooks.detail.edit' | transloco }}
              </a>
            </div>
          </div>
        </div>

        <!-- Auto-disabled banner -->
        @if (sub.isDisabled) {
          <div class="wd-banner">
            <mat-icon class="wd-banner__icon">error</mat-icon>
            <div class="wd-banner__content">
              <p>{{ 'settings.webhooks.detail.disabledBanner' | transloco }}</p>
              @if (sub.disabledReason) {
                <p>{{ sub.disabledReason }}</p>
              }
              @if (sub.disabledAt) {
                <p>{{ 'settings.webhooks.detail.disabledAt' | transloco }} {{ sub.disabledAt | date:'medium' }}</p>
              }
            </div>
            <button mat-flat-button color="primary" (click)="onToggle()">
              {{ 'settings.webhooks.detail.reEnable' | transloco }}
            </button>
          </div>
        }

        <!-- Info Section Card -->
        <div class="wd-section wd-section--info">
          <div class="wd-section__header">
            <mat-icon class="wd-section__header-icon">info</mat-icon>
            <h2 class="wd-section__header-title">{{ 'settings.webhooks.detail.subscriptionDetails' | transloco }}</h2>
          </div>

          <div class="wd-info-grid">
            <div class="wd-info-item">
              <span class="wd-info-label">
                <mat-icon>toggle_on</mat-icon>
                {{ 'settings.webhooks.detail.status' | transloco }}
              </span>
              <span>
                <span class="wd-status-badge"
                      [class.wd-status-badge--active]="sub.isActive && !sub.isDisabled"
                      [class.wd-status-badge--disabled]="sub.isDisabled"
                      [class.wd-status-badge--paused]="!sub.isActive && !sub.isDisabled">
                  <span class="wd-status-badge__dot"></span>
                  {{ getStatusLabel(sub) }}
                </span>
              </span>
            </div>

            <div class="wd-info-item">
              <span class="wd-info-label">
                <mat-icon>vpn_key</mat-icon>
                {{ 'settings.webhooks.detail.secret' | transloco }}
              </span>
              <span class="wd-info-value wd-info-value--mono">{{ sub.secretMask }}</span>
            </div>

            <div class="wd-info-item wd-info-item--full">
              <span class="wd-info-label">
                <mat-icon>link</mat-icon>
                {{ 'settings.webhooks.detail.url' | transloco }}
              </span>
              <span class="wd-info-value wd-info-value--mono">{{ sub.url }}</span>
            </div>

            <div class="wd-info-item wd-info-item--full">
              <span class="wd-info-label">
                <mat-icon>notification_add</mat-icon>
                {{ 'settings.webhooks.detail.eventSubscriptions' | transloco }}
              </span>
              <div class="wd-event-chips">
                @for (event of sub.eventSubscriptions; track event) {
                  <span class="wd-event-chip">{{ formatEvent(event) }}</span>
                }
              </div>
            </div>

            <div class="wd-info-item">
              <span class="wd-info-label">
                <mat-icon>tune</mat-icon>
                {{ 'settings.webhooks.detail.includeCustomFields' | transloco }}
              </span>
              <span class="wd-info-value">{{ sub.includeCustomFields ? ('settings.webhooks.detail.yes' | transloco) : ('settings.webhooks.detail.no' | transloco) }}</span>
            </div>

            <div class="wd-info-item">
              <span class="wd-info-label">
                <mat-icon>calendar_today</mat-icon>
                {{ 'settings.webhooks.detail.created' | transloco }}
              </span>
              <span class="wd-info-value">{{ sub.createdAt | date:'medium' }}</span>
            </div>

            <div class="wd-info-item">
              <span class="wd-info-label">
                <mat-icon>schedule</mat-icon>
                {{ 'settings.webhooks.detail.lastDelivery' | transloco }}
              </span>
              @if (sub.lastDeliveryAt) {
                <span class="wd-info-value">{{ sub.lastDeliveryAt | date:'medium' }}</span>
              } @else {
                <span class="wd-info-value">{{ 'settings.webhooks.detail.never' | transloco }}</span>
              }
            </div>

            <div class="wd-info-item">
              <span class="wd-info-label">
                <mat-icon>warning</mat-icon>
                {{ 'settings.webhooks.detail.consecutiveFailures' | transloco }}
              </span>
              <span class="wd-info-value"
                    [class.wd-info-value--failure]="sub.consecutiveFailureCount > 0">
                {{ sub.consecutiveFailureCount }}
              </span>
            </div>
          </div>
        </div>

        <!-- Delivery Logs Section Card -->
        <div class="wd-section wd-section--delivery">
          <div class="wd-section__header">
            <mat-icon class="wd-section__header-icon">history</mat-icon>
            <h2 class="wd-section__header-title">{{ 'settings.webhooks.detail.deliveryLogs' | transloco }}</h2>
          </div>

          @if (store.deliveryLogs(); as logs) {
            @if (logs.items.length === 0) {
              <div class="wd-delivery-empty">
                <div class="wd-delivery-empty__icon-wrap">
                  <mat-icon>inbox</mat-icon>
                </div>
                <p class="wd-delivery-empty__text">{{ 'settings.webhooks.detail.noDeliveryLogs' | transloco }}</p>
              </div>
            } @else {
              <table class="wd-delivery-table">
                <thead>
                  <tr>
                    <th>{{ 'settings.webhooks.detail.timestamp' | transloco }}</th>
                    <th>{{ 'settings.webhooks.detail.event' | transloco }}</th>
                    <th>{{ 'settings.webhooks.detail.statusHeader' | transloco }}</th>
                    <th>{{ 'settings.webhooks.detail.httpCode' | transloco }}</th>
                    <th>{{ 'settings.webhooks.detail.duration' | transloco }}</th>
                    <th>{{ 'settings.webhooks.detail.actions' | transloco }}</th>
                  </tr>
                </thead>
                <tbody>
                  @for (log of logs.items; track log.id) {
                    <tr class="wd-delivery-row"
                        [class.wd-delivery-row--success]="log.success"
                        [class.wd-delivery-row--failed]="!log.success && log.attemptNumber >= 7"
                        [class.wd-delivery-row--retrying]="!log.success && log.attemptNumber < 7"
                        (click)="toggleExpanded(log.id)">
                      <td>{{ log.createdAt | date:'short' }}</td>
                      <td>{{ formatEvent(log.eventType) }}</td>
                      <td>
                        <span class="wd-delivery-badge"
                              [class.wd-delivery-badge--success]="log.success"
                              [class.wd-delivery-badge--failed]="!log.success && log.attemptNumber >= 7"
                              [class.wd-delivery-badge--retrying]="!log.success && log.attemptNumber < 7">
                          {{ log.success ? ('settings.webhooks.detail.success' | transloco) : (log.attemptNumber < 7 ? ('settings.webhooks.detail.retrying' | transloco) : ('settings.webhooks.detail.failed' | transloco)) }}
                        </span>
                      </td>
                      <td>{{ log.httpStatusCode ?? '-' }}</td>
                      <td>{{ log.durationMs }}ms</td>
                      <td>
                        @if (!log.success) {
                          <button mat-icon-button
                                  [matTooltip]="'settings.webhooks.detail.retryDelivery' | transloco"
                                  (click)="onRetry(log, $event)">
                            <mat-icon>replay</mat-icon>
                          </button>
                        }
                      </td>
                    </tr>
                    @if (isExpanded(log.id)) {
                      <tr class="wd-delivery-expanded">
                        <td colspan="6">
                          <div class="wd-delivery-detail">
                            <div class="wd-delivery-detail__section">
                              <span class="wd-delivery-detail__label">{{ 'settings.webhooks.detail.requestPayload' | transloco }}</span>
                              <pre class="wd-delivery-detail__value">{{ formatJson(log.requestPayload) }}</pre>
                            </div>
                            @if (log.responseBody) {
                              <div class="wd-delivery-detail__section">
                                <span class="wd-delivery-detail__label">{{ 'settings.webhooks.detail.responseBody' | transloco }}</span>
                                <pre class="wd-delivery-detail__value">{{ truncate(log.responseBody, 1024) }}</pre>
                              </div>
                            }
                            @if (log.errorMessage) {
                              <div class="wd-delivery-detail__section">
                                <span class="wd-delivery-detail__label">{{ 'settings.webhooks.detail.errorMessage' | transloco }}</span>
                                <pre class="wd-delivery-detail__value">{{ log.errorMessage }}</pre>
                              </div>
                            }
                            <div class="wd-delivery-detail__section">
                              <span class="wd-delivery-detail__label">{{ 'settings.webhooks.detail.attemptNumber' | transloco }}</span>
                              <span class="wd-info-value">{{ log.attemptNumber }}</span>
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
            <div class="wd-delivery-spinner">
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
  private readonly transloco = inject(TranslocoService);

  readonly logsPage = signal(1);
  readonly logsPageSize = 25;
  private readonly expandedRows = signal<Set<string>>(new Set());

  ngOnInit(): void {
    const subId = this.id();
    this.store.loadSubscription(subId);
    this.store.loadDeliveryLogs(1, this.logsPageSize, subId);
  }

  getStatusLabel(sub: { isActive: boolean; isDisabled: boolean }): string {
    if (sub.isDisabled) return this.transloco.translate('settings.webhooks.list.disabled');
    if (!sub.isActive) return this.transloco.translate('settings.webhooks.list.paused');
    return this.transloco.translate('settings.webhooks.list.active');
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
        this.snackBar.open(this.transloco.translate('settings.webhooks.detail.secretRegenerated'), this.transloco.translate('settings.common.cancel'), {
          duration: 3000,
        });
      });
    });
  }

  onToggle(): void {
    this.store.toggleSubscription(this.id(), (updated) => {
      const msg = updated.isActive
        ? this.transloco.translate('settings.webhooks.detail.webhookEnabled')
        : this.transloco.translate('settings.webhooks.detail.webhookPaused');
      this.snackBar.open(msg, this.transloco.translate('settings.common.cancel'), { duration: 3000 });
    });
  }

  onRetry(log: WebhookDeliveryLog, event: Event): void {
    event.stopPropagation();
    this.store.retryDelivery(log.id, () => {
      this.snackBar.open(this.transloco.translate('settings.webhooks.detail.retryEnqueued'), this.transloco.translate('settings.common.cancel'), {
        duration: 3000,
      });
    });
  }
}

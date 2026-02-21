import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  inject,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { WebhookStore } from './webhook.store';
import { WebhookSubscription } from './webhook.models';
import { ConfirmDeleteDialogComponent } from '../../../shared/components/confirm-delete-dialog/confirm-delete-dialog.component';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';

@Component({
  selector: 'app-webhook-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    DatePipe,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatDialogModule,
    MatTooltipModule,
    TranslocoPipe,
  ],
  providers: [WebhookStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    /* ---- Keyframes ---------------------------------------- */
    @keyframes wlFadeSlideUp {
      from { opacity: 0; transform: translateY(16px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    @keyframes wlCardEntrance {
      from { opacity: 0; transform: translateY(12px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    @keyframes wlCircleFloat {
      0%, 100% { opacity: 0.4; transform: translateY(0); }
      50%      { opacity: 0.8; transform: translateY(-8px); }
    }

    @keyframes wlStatusPulse {
      0%, 100% { opacity: 1; }
      50%      { opacity: 0.5; }
    }

    /* ---- Host --------------------------------------------- */
    :host {
      display: block;
    }

    /* ---- Page Container ----------------------------------- */
    .wl-page {
      padding: var(--space-6) var(--space-8);
      max-width: 960px;
      margin: 0 auto;
    }

    /* ---- Header ------------------------------------------- */
    .wl-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: var(--space-8);
      gap: var(--space-4);
      opacity: 0;
      animation: wlFadeSlideUp var(--duration-slower) var(--ease-out) forwards;
    }

    .wl-header__left {
      display: flex;
      flex-direction: column;
    }

    .wl-back {
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

    .wl-back mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .wl-back:hover {
      color: var(--color-primary);
    }

    .wl-title-row {
      display: flex;
      align-items: center;
      gap: var(--space-4);
    }

    .wl-icon-wrap {
      width: 48px;
      height: 48px;
      border-radius: var(--radius-lg);
      background: linear-gradient(135deg, var(--color-secondary), var(--color-secondary-hover));
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
      flex-shrink: 0;
    }

    .wl-icon-wrap mat-icon {
      color: var(--color-secondary-fg);
      font-size: 24px;
      width: 24px;
      height: 24px;
    }

    .wl-title {
      margin: 0;
      font-size: var(--text-3xl);
      font-weight: var(--font-bold);
      letter-spacing: -0.5px;
      color: var(--color-text);
    }

    .wl-subtitle {
      margin: var(--space-1) 0 0;
      font-size: var(--text-base);
      color: var(--color-text-secondary);
    }

    .wl-header__actions {
      display: flex;
      gap: var(--space-2);
      flex-shrink: 0;
      margin-top: var(--space-6);
    }

    .wl-header__actions mat-icon {
      margin-right: var(--space-1);
    }

    /* ---- Loading State ------------------------------------ */
    .wl-loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: var(--space-20) 0;
      gap: var(--space-4);
    }

    .wl-loading p {
      margin: 0;
      color: var(--color-text-secondary);
      font-size: var(--text-sm);
    }

    /* ---- Empty State -------------------------------------- */
    .wl-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: var(--space-16) 0;
      text-align: center;
      opacity: 0;
      animation: wlFadeSlideUp var(--duration-slower) var(--ease-out) 0.1s forwards;
    }

    .wl-empty__visual {
      position: relative;
      width: 120px;
      height: 120px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .wl-empty__circles {
      position: absolute;
      inset: 0;
    }

    .wl-circle {
      position: absolute;
      border-radius: var(--radius-full);
      opacity: 0;
      animation: wlCircleFloat 3s var(--ease-default) infinite;
    }

    .wl-circle--1 {
      width: 40px;
      height: 40px;
      background: var(--color-secondary-soft);
      border: 2px solid var(--color-secondary);
      top: 0;
      left: 10px;
      animation-delay: 0s;
    }

    .wl-circle--2 {
      width: 32px;
      height: 32px;
      background: var(--color-primary-soft);
      border: 2px solid var(--color-primary);
      top: 8px;
      right: 5px;
      animation-delay: 0.5s;
    }

    .wl-circle--3 {
      width: 28px;
      height: 28px;
      background: var(--color-accent-soft);
      border: 2px solid var(--color-accent);
      bottom: 10px;
      left: 22px;
      animation-delay: 1s;
    }

    .wl-empty__icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      color: var(--color-text-muted);
      z-index: 1;
    }

    .wl-empty h3 {
      margin: var(--space-5) 0 var(--space-2);
      font-size: var(--text-xl);
      font-weight: var(--font-semibold);
      color: var(--color-text);
    }

    .wl-empty p {
      margin: 0 0 var(--space-6);
      color: var(--color-text-secondary);
      max-width: 400px;
      line-height: var(--leading-relaxed);
    }

    .wl-empty__btn mat-icon {
      margin-right: var(--space-1);
    }

    /* ---- Card List ---------------------------------------- */
    .wl-cards {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }

    /* ---- Card --------------------------------------------- */
    .wl-card {
      position: relative;
      background: var(--color-surface);
      border: 1.5px solid var(--color-border);
      border-radius: 14px;
      cursor: pointer;
      outline: none;
      overflow: hidden;
      opacity: 0;
      animation: wlCardEntrance var(--duration-slower) var(--ease-out) both;
      transition:
        border-color var(--duration-normal) var(--ease-default),
        box-shadow var(--duration-normal) var(--ease-default),
        transform var(--duration-normal) var(--ease-default);
    }

    .wl-card:hover,
    .wl-card:focus-visible {
      transform: translateY(-2px);
      border-color: var(--color-secondary);
      box-shadow: var(--shadow-lg);
    }

    .wl-card:focus-visible {
      box-shadow: var(--shadow-focus);
    }

    .wl-card:active {
      transform: translateY(0);
      box-shadow: var(--shadow-md);
    }

    .wl-card:hover .wl-card__actions,
    .wl-card:focus-visible .wl-card__actions {
      opacity: 1;
      transform: translateX(0);
    }

    .wl-card__inner {
      display: flex;
      align-items: center;
      gap: var(--space-4);
      padding: var(--space-5);
    }

    /* ---- Status Indicator --------------------------------- */
    .wl-card__status {
      width: 44px;
      height: 44px;
      border-radius: var(--radius-md);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      position: relative;
    }

    .wl-card__status--active {
      background: var(--color-success-soft);
    }

    .wl-card__status--paused {
      background: var(--color-warning-soft);
    }

    .wl-card__status--disabled {
      background: var(--color-danger-soft);
    }

    .wl-card__status mat-icon {
      font-size: 22px;
      width: 22px;
      height: 22px;
    }

    .wl-card__status--active mat-icon {
      color: var(--color-success);
    }

    .wl-card__status--paused mat-icon {
      color: var(--color-warning);
    }

    .wl-card__status--disabled mat-icon {
      color: var(--color-danger);
    }

    .wl-status-dot {
      position: absolute;
      top: var(--space-1);
      right: var(--space-1);
      width: 10px;
      height: 10px;
      border-radius: var(--radius-full);
      border: 2px solid var(--color-surface);
    }

    .wl-status-dot--active {
      background: var(--color-success);
      animation: wlStatusPulse 2s var(--ease-default) infinite;
    }

    .wl-status-dot--paused {
      background: var(--color-warning);
    }

    .wl-status-dot--disabled {
      background: var(--color-danger);
    }

    /* ---- Card Info ---------------------------------------- */
    .wl-card__info {
      flex: 1;
      min-width: 0;
    }

    .wl-card__name {
      font-size: var(--text-md);
      font-weight: var(--font-semibold);
      margin: 0 0 var(--space-1) 0;
      color: var(--color-text);
      letter-spacing: -0.2px;
    }

    .wl-card__url {
      font-size: var(--text-sm);
      color: var(--color-text-secondary);
      margin: 0 0 var(--space-2) 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 480px;
      font-family: var(--font-mono);
      font-size: var(--text-xs);
    }

    /* ---- Card Meta Row ------------------------------------ */
    .wl-card__meta {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      flex-wrap: wrap;
    }

    .wl-badge {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      font-size: var(--text-xs);
      padding: var(--space-0-5) var(--space-2);
      border-radius: var(--radius-full);
      font-weight: var(--font-semibold);
    }

    .wl-badge__dot {
      width: 6px;
      height: 6px;
      border-radius: var(--radius-full);
      flex-shrink: 0;
    }

    .wl-badge--active {
      background: var(--color-success-soft);
      color: var(--color-success-text);
    }

    .wl-badge--active .wl-badge__dot {
      background: var(--color-success);
    }

    .wl-badge--paused {
      background: var(--color-warning-soft);
      color: var(--color-warning-text);
    }

    .wl-badge--paused .wl-badge__dot {
      background: var(--color-warning);
    }

    .wl-badge--disabled {
      background: var(--color-danger-soft);
      color: var(--color-danger-text);
    }

    .wl-badge--disabled .wl-badge__dot {
      background: var(--color-danger);
    }

    .wl-card__events {
      font-size: var(--text-xs);
      color: var(--color-text-secondary);
      display: flex;
      align-items: center;
      gap: var(--space-1);
    }

    .wl-card__events mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
      color: var(--color-text-muted);
    }

    .wl-card__failures {
      font-size: var(--text-xs);
      color: var(--color-danger-text);
      font-weight: var(--font-semibold);
      display: flex;
      align-items: center;
      gap: var(--space-1);
    }

    .wl-card__failures mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }

    .wl-card__last-delivery {
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      display: flex;
      align-items: center;
      gap: var(--space-1);
    }

    .wl-card__last-delivery mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }

    /* ---- Card Actions ------------------------------------- */
    .wl-card__actions {
      display: flex;
      gap: var(--space-0-5);
      flex-shrink: 0;
      opacity: 0;
      transform: translateX(8px);
      transition:
        opacity var(--duration-normal) var(--ease-default),
        transform var(--duration-normal) var(--ease-default);
    }

    .wl-action-btn {
      width: 36px !important;
      height: 36px !important;
      line-height: 36px !important;
    }

    .wl-action-btn mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .wl-action-btn--danger:hover {
      color: var(--color-danger) !important;
    }

    /* ---- Reduced Motion ----------------------------------- */
    @media (prefers-reduced-motion: reduce) {
      .wl-header,
      .wl-card,
      .wl-empty,
      .wl-circle {
        animation: none !important;
        opacity: 1;
      }

      .wl-status-dot--active {
        animation: none;
      }

      .wl-card:hover,
      .wl-card:focus-visible {
        transform: none;
      }
    }

    /* ---- Responsive --------------------------------------- */
    @media (max-width: 768px) {
      .wl-page {
        padding: var(--space-4);
      }

      .wl-header {
        flex-direction: column;
        gap: var(--space-3);
        margin-bottom: var(--space-6);
      }

      .wl-header__actions {
        margin-top: 0;
        flex-direction: column;
        width: 100%;
      }

      .wl-title {
        font-size: var(--text-2xl);
      }

      .wl-card__inner {
        padding: var(--space-4);
        gap: var(--space-3);
      }

      .wl-card__url {
        max-width: 200px;
      }

      .wl-card__actions {
        opacity: 1;
        transform: translateX(0);
      }

      .wl-card__meta {
        gap: var(--space-2);
      }
    }
  `,
  template: `
    <div class="wl-page">
      <!-- Header -->
      <div class="wl-header">
        <div class="wl-header__left">
          <a routerLink="/settings" class="wl-back">
            <mat-icon>arrow_back</mat-icon>
            <span>{{ 'webhooks.list.breadcrumb' | transloco }}</span>
          </a>
          <div class="wl-title-row">
            <div class="wl-icon-wrap">
              <mat-icon>webhook</mat-icon>
            </div>
            <div>
              <h1 class="wl-title">{{ 'webhooks.list.title' | transloco }}</h1>
              <p class="wl-subtitle">{{ 'webhooks.list.subtitle' | transloco }}</p>
            </div>
          </div>
        </div>
        <div class="wl-header__actions">
          <a mat-stroked-button routerLink="/settings/webhooks/delivery-logs">
            <mat-icon>list_alt</mat-icon>
            {{ 'webhooks.list.viewAllDeliveryLogs' | transloco }}
          </a>
          <a mat-flat-button color="primary" routerLink="/settings/webhooks/new">
            <mat-icon>add</mat-icon>
            {{ 'webhooks.list.addWebhook' | transloco }}
          </a>
        </div>
      </div>

      <!-- Loading -->
      @if (store.loading()) {
        <div class="wl-loading">
          <mat-spinner diameter="40"></mat-spinner>
          <p>{{ 'webhooks.list.loading' | transloco }}</p>
        </div>
      } @else if (store.subscriptions().length === 0) {
        <!-- Empty State -->
        <div class="wl-empty">
          <div class="wl-empty__visual">
            <div class="wl-empty__circles">
              <div class="wl-circle wl-circle--1"></div>
              <div class="wl-circle wl-circle--2"></div>
              <div class="wl-circle wl-circle--3"></div>
            </div>
            <mat-icon class="wl-empty__icon">webhook</mat-icon>
          </div>
          <h3>{{ 'webhooks.list.noWebhooksTitle' | transloco }}</h3>
          <p>{{ 'webhooks.list.noWebhooksDesc' | transloco }}</p>
          <a mat-flat-button color="primary" routerLink="/settings/webhooks/new" class="wl-empty__btn">
            <mat-icon>add</mat-icon>
            {{ 'webhooks.list.addWebhook' | transloco }}
          </a>
        </div>
      } @else {
        <!-- Card List -->
        <div class="wl-cards">
          @for (sub of store.subscriptions(); track sub.id; let i = $index) {
            <div
              class="wl-card"
              [style.animation-delay]="(i * 60) + 'ms'"
              tabindex="0"
              (click)="onView(sub)"
              (keydown.enter)="onView(sub)"
            >
              <div class="wl-card__inner">
                <!-- Status Icon -->
                <div class="wl-card__status"
                     [class.wl-card__status--active]="sub.isActive && !sub.isDisabled"
                     [class.wl-card__status--paused]="!sub.isActive && !sub.isDisabled"
                     [class.wl-card__status--disabled]="sub.isDisabled">
                  <mat-icon>webhook</mat-icon>
                  <span class="wl-status-dot"
                        [class.wl-status-dot--active]="sub.isActive && !sub.isDisabled"
                        [class.wl-status-dot--paused]="!sub.isActive && !sub.isDisabled"
                        [class.wl-status-dot--disabled]="sub.isDisabled">
                  </span>
                </div>

                <!-- Info -->
                <div class="wl-card__info">
                  <p class="wl-card__name">{{ sub.name }}</p>
                  <p class="wl-card__url">{{ sub.url }}</p>
                  <div class="wl-card__meta">
                    <span class="wl-badge"
                          [class.wl-badge--active]="sub.isActive && !sub.isDisabled"
                          [class.wl-badge--disabled]="sub.isDisabled"
                          [class.wl-badge--paused]="!sub.isActive && !sub.isDisabled">
                      <span class="wl-badge__dot"></span>
                      {{ getStatusLabel(sub) }}
                    </span>
                    <span class="wl-card__events">
                      <mat-icon>notifications</mat-icon>
                      {{ sub.eventSubscriptions.length }} {{ sub.eventSubscriptions.length !== 1 ? ('webhooks.events' | transloco) : ('webhooks.event' | transloco) }}
                    </span>
                    @if (sub.consecutiveFailureCount > 0) {
                      <span class="wl-card__failures">
                        <mat-icon>warning</mat-icon>
                        {{ sub.consecutiveFailureCount }} {{ sub.consecutiveFailureCount !== 1 ? ('webhooks.list.consecutiveFailures' | transloco) : ('webhooks.list.consecutiveFailure' | transloco) }}
                      </span>
                    }
                    @if (sub.lastDeliveryAt) {
                      <span class="wl-card__last-delivery">
                        <mat-icon>schedule</mat-icon>
                        {{ 'webhooks.list.lastDelivery' | transloco }} {{ sub.lastDeliveryAt | date:'short' }}
                      </span>
                    }
                  </div>
                </div>

                <!-- Actions -->
                <div class="wl-card__actions" (click)="$event.stopPropagation()">
                  <button mat-icon-button
                          [matTooltip]="'webhooks.list.editTooltip' | transloco"
                          class="wl-action-btn"
                          (click)="onEdit(sub)">
                    <mat-icon>edit</mat-icon>
                  </button>
                  <button mat-icon-button
                          [matTooltip]="'webhooks.list.deleteTooltip' | transloco"
                          color="warn"
                          class="wl-action-btn wl-action-btn--danger"
                          (click)="onDelete(sub)">
                    <mat-icon>delete</mat-icon>
                  </button>
                </div>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class WebhookListComponent implements OnInit {
  readonly store = inject(WebhookStore);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly transloco = inject(TranslocoService);

  ngOnInit(): void {
    this.store.loadSubscriptions();
  }

  getStatusLabel(sub: WebhookSubscription): string {
    if (sub.isDisabled) return this.transloco.translate('settings.webhooks.list.disabled');
    if (!sub.isActive) return this.transloco.translate('settings.webhooks.list.paused');
    return this.transloco.translate('settings.webhooks.list.active');
  }

  onView(sub: WebhookSubscription): void {
    this.router.navigate(['/settings/webhooks', sub.id]);
  }

  onEdit(sub: WebhookSubscription): void {
    this.router.navigate(['/settings/webhooks', sub.id, 'edit']);
  }

  onDelete(sub: WebhookSubscription): void {
    const dialogRef = this.dialog.open(ConfirmDeleteDialogComponent, {
      width: '400px',
      data: { name: sub.name, type: 'webhook' },
    });

    dialogRef.afterClosed().subscribe((confirmed: boolean) => {
      if (!confirmed) return;

      this.store.deleteSubscription(sub.id, () => {
        this.snackBar.open(
          this.transloco.translate('settings.webhooks.deleteSuccess'),
          this.transloco.translate('settings.common.cancel'),
          { duration: 3000 },
        );
      });
    });
  }
}

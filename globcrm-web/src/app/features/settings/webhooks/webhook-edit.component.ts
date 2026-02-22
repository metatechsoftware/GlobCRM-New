import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  inject,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import {
  FormBuilder,
  FormGroup,
  FormControl,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  MatDialog,
  MatDialogModule,
  MatDialogRef,
  MAT_DIALOG_DATA,
} from '@angular/material/dialog';
import { Clipboard, ClipboardModule } from '@angular/cdk/clipboard';
import { WebhookStore } from './webhook.store';
import {
  CreateWebhookRequest,
  UpdateWebhookRequest,
  WEBHOOK_ENTITIES,
  WEBHOOK_EVENTS,
} from './webhook.models';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';

/** Entity icon + color mapping for the event matrix */
const ENTITY_META: Record<string, { icon: string; color: string; soft: string }> = {
  Contact:  { icon: 'person',         color: 'var(--color-info)',      soft: 'var(--color-info-soft)' },
  Company:  { icon: 'business',       color: 'var(--color-info)',      soft: 'var(--color-info-soft)' },
  Deal:     { icon: 'handshake',      color: 'var(--color-success)',   soft: 'var(--color-success-soft)' },
  Lead:     { icon: 'person_search',  color: 'var(--color-primary)',   soft: 'var(--color-primary-soft)' },
  Activity: { icon: 'event',          color: 'var(--color-primary)',   soft: 'var(--color-primary-soft)' },
  Quote:    { icon: 'request_quote',  color: 'var(--color-warning)',   soft: 'var(--color-warning-soft)' },
  Request:  { icon: 'support_agent',  color: 'var(--color-danger)',    soft: 'var(--color-danger-soft)' },
  Product:  { icon: 'inventory_2',    color: 'var(--color-primary)',   soft: 'var(--color-primary-soft)' },
};

@Component({
  selector: 'app-webhook-edit',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSlideToggleModule,
    MatSnackBarModule,
    MatDialogModule,
    ClipboardModule,
    TranslocoPipe,
  ],
  providers: [WebhookStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    /* ── Keyframes ──────────────────────────────────── */
    @keyframes fadeSlideUp {
      from { opacity: 0; transform: translateY(16px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    @keyframes iconGlow {
      0%, 100% { box-shadow: 0 4px 16px rgba(96,165,250,0.25), 0 0 0 4px rgba(96,165,250,0.08); }
      50%      { box-shadow: 0 6px 24px rgba(96,165,250,0.35), 0 0 0 6px rgba(96,165,250,0.12); }
    }

    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
      }
    }

    /* ── Host ───────────────────────────────────────── */
    :host {
      display: block;
    }

    /* ── Layout container ───────────────────────────── */
    .we-page {
      max-width: 740px;
      margin: 0 auto;
      padding: var(--space-6) var(--space-6) var(--space-12);
    }

    /* ── Breadcrumb ─────────────────────────────────── */
    .we-breadcrumb {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1-5);
      font-size: var(--text-sm);
      font-weight: var(--font-medium);
      color: var(--color-text-secondary);
      text-decoration: none;
      padding: var(--space-1-5) var(--space-3);
      border-radius: var(--radius-md);
      transition: color var(--duration-normal) var(--ease-default),
                  background var(--duration-normal) var(--ease-default);
      margin-bottom: var(--space-5);
      opacity: 0;
      animation: fadeSlideUp 0.4s var(--ease-out) forwards;
    }

    .we-breadcrumb:hover {
      color: var(--color-info);
      background: var(--color-info-soft);
    }

    .we-breadcrumb mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    /* ── Header ─────────────────────────────────────── */
    .we-header {
      display: flex;
      align-items: center;
      gap: var(--space-5);
      margin-bottom: var(--space-8);
      opacity: 0;
      animation: fadeSlideUp 0.4s var(--ease-out) 60ms forwards;
    }

    .we-header__icon-wrap {
      width: 56px;
      height: 56px;
      border-radius: var(--radius-xl);
      background: linear-gradient(135deg, var(--color-info) 0%, var(--color-info-text) 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      animation: iconGlow 4s ease-in-out infinite;
    }

    .we-header__icon-wrap mat-icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
      color: #fff;
    }

    .we-header__text {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
    }

    .we-header__title {
      font-size: var(--text-2xl);
      font-weight: var(--font-bold);
      letter-spacing: -0.5px;
      margin: 0;
      color: var(--color-text);
      line-height: var(--leading-tight);
    }

    .we-header__subtitle {
      font-size: var(--text-base);
      color: var(--color-text-secondary);
      margin: 0;
      line-height: var(--leading-normal);
    }

    /* ── Section card ───────────────────────────────── */
    .we-section {
      border: 1.5px solid var(--color-border);
      border-radius: 14px;
      background: var(--color-surface);
      padding: var(--space-6);
      margin-bottom: var(--space-6);
      opacity: 0;
      animation: fadeSlideUp 0.4s var(--ease-out) forwards;
      transition: border-color var(--duration-normal) var(--ease-default),
                  box-shadow var(--duration-normal) var(--ease-default);
    }

    .we-section:hover {
      border-color: var(--color-border-strong);
      box-shadow: var(--shadow-sm);
    }

    .we-section--details {
      animation-delay: 120ms;
    }

    .we-section--events {
      animation-delay: 200ms;
    }

    .we-section__header {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      margin-bottom: var(--space-5);
      padding-bottom: var(--space-4);
      border-bottom: 1px solid var(--color-border-subtle);
    }

    .we-section__icon {
      width: 36px;
      height: 36px;
      border-radius: var(--radius-md);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .we-section__icon--details {
      background: var(--color-info-soft);
      color: var(--color-info);
    }

    .we-section__icon--events {
      background: var(--color-primary-soft);
      color: var(--color-primary);
    }

    .we-section__icon mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .we-section__title-group {
      display: flex;
      flex-direction: column;
      gap: var(--space-0-5);
    }

    .we-section__title {
      font-size: var(--text-md);
      font-weight: var(--font-semibold);
      color: var(--color-text);
      margin: 0;
    }

    .we-section__desc {
      font-size: var(--text-sm);
      color: var(--color-text-secondary);
      margin: 0;
      line-height: var(--leading-normal);
    }

    /* ── Form fields ────────────────────────────────── */
    .we-field {
      width: 100%;
      margin-bottom: var(--space-4);
    }

    .we-toggle-row {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-3) var(--space-4);
      border-radius: var(--radius-md);
      background: var(--color-bg-secondary);
      border: 1px solid var(--color-border-subtle);
      transition: border-color var(--duration-normal) var(--ease-default);
    }

    .we-toggle-row:hover {
      border-color: var(--color-border);
    }

    .we-toggle-label {
      display: flex;
      flex-direction: column;
      gap: var(--space-0-5);
    }

    .we-toggle-label__text {
      font-size: var(--text-base);
      font-weight: var(--font-medium);
      color: var(--color-text);
    }

    .we-toggle-label__hint {
      font-size: var(--text-xs);
      color: var(--color-text-muted);
    }

    /* ── Event matrix ───────────────────────────────── */
    .we-matrix {
      margin-top: var(--space-2);
    }

    .we-matrix__header {
      display: grid;
      grid-template-columns: 1fr repeat(3, 80px);
      gap: var(--space-2);
      margin-bottom: var(--space-3);
      padding-bottom: var(--space-3);
      border-bottom: 1.5px solid var(--color-border);
    }

    .we-matrix__header-label {
      font-size: var(--text-xs);
      font-weight: var(--font-semibold);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--color-text-muted);
      text-align: center;
    }

    .we-matrix__header-label:first-child {
      text-align: left;
    }

    .we-matrix__row {
      display: grid;
      grid-template-columns: 1fr repeat(3, 80px);
      gap: var(--space-2);
      align-items: center;
      padding: var(--space-2) 0;
      border-radius: var(--radius-md);
      transition: background var(--duration-fast) var(--ease-default);
    }

    .we-matrix__row:hover {
      background: var(--color-highlight);
    }

    .we-matrix__row + .we-matrix__row {
      border-top: 1px solid var(--color-border-subtle);
    }

    .we-matrix__entity {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding-left: var(--space-2);
    }

    .we-matrix__entity-icon {
      width: 28px;
      height: 28px;
      border-radius: var(--radius-sm);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .we-matrix__entity-icon mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    .we-matrix__entity-name {
      font-size: var(--text-base);
      font-weight: var(--font-medium);
      color: var(--color-text);
    }

    .we-matrix__cell {
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .we-matrix__actions {
      display: flex;
      gap: var(--space-2);
      margin-top: var(--space-4);
      padding-top: var(--space-4);
      border-top: 1px solid var(--color-border-subtle);
    }

    .we-matrix__error {
      color: var(--color-danger-text);
      font-size: var(--text-sm);
      margin-top: var(--space-2);
      display: flex;
      align-items: center;
      gap: var(--space-1-5);
    }

    .we-matrix__error mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      color: var(--color-danger);
    }

    /* ── Form actions bar ───────────────────────────── */
    .we-actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--space-3);
      margin-top: var(--space-6);
      opacity: 0;
      animation: fadeSlideUp 0.4s var(--ease-out) 280ms forwards;
    }

    /* ── Loading state ──────────────────────────────── */
    .we-loading {
      display: flex;
      justify-content: center;
      padding: var(--space-16);
    }

    /* ── Responsive ─────────────────────────────────── */
    @media (max-width: 768px) {
      .we-page {
        padding: var(--space-4) var(--space-4) var(--space-8);
      }

      .we-header {
        gap: var(--space-3);
      }

      .we-header__icon-wrap {
        width: 44px;
        height: 44px;
        border-radius: var(--radius-lg);
      }

      .we-header__icon-wrap mat-icon {
        font-size: 22px;
        width: 22px;
        height: 22px;
      }

      .we-header__title {
        font-size: var(--text-xl);
      }

      .we-section {
        padding: var(--space-4);
      }

      .we-matrix__header {
        grid-template-columns: 1fr repeat(3, 60px);
      }

      .we-matrix__row {
        grid-template-columns: 1fr repeat(3, 60px);
      }

      .we-matrix__entity-name {
        font-size: var(--text-sm);
      }

      .we-actions {
        flex-direction: column-reverse;
      }

      .we-actions a,
      .we-actions button {
        width: 100%;
      }
    }
  `,
  template: `
    <div class="we-page">
      <!-- Breadcrumb -->
      <a class="we-breadcrumb"
         [routerLink]="isEditMode() ? ['/settings/webhooks', id()] : ['/settings/webhooks']">
        <mat-icon>arrow_back</mat-icon>
        <span>{{ 'settings.webhooks.edit.breadcrumb' | transloco }}</span>
      </a>

      <!-- Header -->
      <div class="we-header">
        <div class="we-header__icon-wrap">
          <mat-icon>webhook</mat-icon>
        </div>
        <div class="we-header__text">
          <h1 class="we-header__title">{{ isEditMode() ? ('settings.webhooks.edit.editTitle' | transloco) : ('settings.webhooks.edit.createTitle' | transloco) }}</h1>
          <p class="we-header__subtitle">
            {{ isEditMode()
              ? ('settings.webhooks.edit.editSubtitle' | transloco)
              : ('settings.webhooks.edit.createSubtitle' | transloco) }}
          </p>
        </div>
      </div>

      @if (store.loading() && isEditMode()) {
        <div class="we-loading">
          <mat-spinner diameter="48"></mat-spinner>
        </div>
      } @else {
        <form [formGroup]="form" (ngSubmit)="onSubmit()">
          <!-- Section: Webhook Details -->
          <div class="we-section we-section--details">
            <div class="we-section__header">
              <div class="we-section__icon we-section__icon--details">
                <mat-icon>tune</mat-icon>
              </div>
              <div class="we-section__title-group">
                <h2 class="we-section__title">{{ 'settings.webhooks.edit.webhookDetails' | transloco }}</h2>
                <p class="we-section__desc">{{ 'settings.webhooks.edit.webhookDetailsDesc' | transloco }}</p>
              </div>
            </div>

            <mat-form-field appearance="outline" class="we-field">
              <mat-label>{{ 'settings.webhooks.edit.name' | transloco }}</mat-label>
              <input matInput formControlName="name" [placeholder]="'settings.webhooks.edit.namePlaceholder' | transloco" maxlength="200" />
              @if (form.get('name')?.hasError('required') && form.get('name')?.touched) {
                <mat-error>{{ 'settings.webhooks.edit.nameRequired' | transloco }}</mat-error>
              }
            </mat-form-field>

            <mat-form-field appearance="outline" class="we-field">
              <mat-label>{{ 'settings.webhooks.edit.url' | transloco }}</mat-label>
              <input matInput formControlName="url" [placeholder]="'settings.webhooks.edit.urlPlaceholder' | transloco" maxlength="2048" />
              @if (form.get('url')?.hasError('required') && form.get('url')?.touched) {
                <mat-error>{{ 'settings.webhooks.edit.urlRequired' | transloco }}</mat-error>
              }
              @if (form.get('url')?.hasError('pattern') && form.get('url')?.touched) {
                <mat-error>{{ 'settings.webhooks.edit.urlPattern' | transloco }}</mat-error>
              }
            </mat-form-field>

            <div class="we-toggle-row">
              <mat-slide-toggle formControlName="includeCustomFields"></mat-slide-toggle>
              <div class="we-toggle-label">
                <span class="we-toggle-label__text">{{ 'settings.webhooks.edit.includeCustomFields' | transloco }}</span>
                <span class="we-toggle-label__hint">{{ 'settings.webhooks.edit.includeCustomFieldsHint' | transloco }}</span>
              </div>
            </div>
          </div>

          <!-- Section: Event Subscriptions -->
          <div class="we-section we-section--events">
            <div class="we-section__header">
              <div class="we-section__icon we-section__icon--events">
                <mat-icon>notifications_active</mat-icon>
              </div>
              <div class="we-section__title-group">
                <h2 class="we-section__title">{{ 'settings.webhooks.edit.eventSubscriptions' | transloco }}</h2>
                <p class="we-section__desc">{{ 'settings.webhooks.edit.eventSubscriptionsDesc' | transloco }}</p>
              </div>
            </div>

            <div class="we-matrix">
              <div class="we-matrix__header">
                <span class="we-matrix__header-label">{{ 'settings.webhooks.edit.entity' | transloco }}</span>
                @for (event of events; track event) {
                  <span class="we-matrix__header-label">{{ event }}</span>
                }
              </div>
              @for (entity of entities; track entity) {
                <div class="we-matrix__row">
                  <div class="we-matrix__entity">
                    <div class="we-matrix__entity-icon"
                         [style.background]="getEntityMeta(entity).soft"
                         [style.color]="getEntityMeta(entity).color">
                      <mat-icon>{{ getEntityMeta(entity).icon }}</mat-icon>
                    </div>
                    <span class="we-matrix__entity-name">{{ entity }}</span>
                  </div>
                  @for (event of events; track event) {
                    <div class="we-matrix__cell">
                      <mat-checkbox
                        [checked]="isEventSelected(entity, event)"
                        (change)="toggleEvent(entity, event, $event.checked)">
                      </mat-checkbox>
                    </div>
                  }
                </div>
              }
            </div>

            <div class="we-matrix__actions">
              <button mat-stroked-button type="button" (click)="selectAll()">
                {{ 'settings.webhooks.edit.selectAll' | transloco }}
              </button>
              <button mat-stroked-button type="button" (click)="deselectAll()">
                {{ 'settings.webhooks.edit.deselectAll' | transloco }}
              </button>
            </div>

            @if (selectedEvents().length === 0 && formSubmitted()) {
              <div class="we-matrix__error">
                <mat-icon>error_outline</mat-icon>
                <span>{{ 'settings.webhooks.edit.atLeastOneEvent' | transloco }}</span>
              </div>
            }
          </div>

          <!-- Form Actions -->
          <div class="we-actions">
            <a mat-stroked-button
               [routerLink]="isEditMode() ? ['/settings/webhooks', id()] : ['/settings/webhooks']">
              {{ 'settings.webhooks.edit.cancel' | transloco }}
            </a>
            <button mat-flat-button color="primary" type="submit"
                    [disabled]="store.loading()">
              @if (store.loading()) {
                <mat-spinner diameter="20"></mat-spinner>
              }
              {{ isEditMode() ? ('settings.webhooks.edit.updateWebhook' | transloco) : ('settings.webhooks.edit.createWebhook' | transloco) }}
            </button>
          </div>
        </form>
      }
    </div>
  `,
})
export class WebhookEditComponent implements OnInit {
  readonly id = input<string>();
  readonly store = inject(WebhookStore);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly transloco = inject(TranslocoService);

  readonly entities = WEBHOOK_ENTITIES;
  readonly events = WEBHOOK_EVENTS;

  readonly isEditMode = signal(false);
  readonly selectedEvents = signal<string[]>([]);
  readonly formSubmitted = signal(false);

  form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(200)]],
    url: [
      '',
      [
        Validators.required,
        Validators.maxLength(2048),
        Validators.pattern(/^https:\/\/.+/),
      ],
    ],
    includeCustomFields: [false],
  });

  ngOnInit(): void {
    const id = this.id();
    if (id) {
      this.isEditMode.set(true);
      this.store.loadSubscription(id);

      // Wait for subscription to load, then populate form
      const checkLoaded = setInterval(() => {
        const sub = this.store.selectedSubscription();
        if (sub) {
          clearInterval(checkLoaded);
          this.form.patchValue({
            name: sub.name,
            url: sub.url,
            includeCustomFields: sub.includeCustomFields,
          });
          this.selectedEvents.set([...sub.eventSubscriptions]);
        }
        if (!this.store.loading() && !sub) {
          clearInterval(checkLoaded);
        }
      }, 100);
    }
  }

  getEntityMeta(entity: string): { icon: string; color: string; soft: string } {
    return ENTITY_META[entity] ?? { icon: 'category', color: 'var(--color-text-secondary)', soft: 'var(--color-bg-secondary)' };
  }

  isEventSelected(entity: string, event: string): boolean {
    return this.selectedEvents().includes(`${entity}.${event}`);
  }

  toggleEvent(entity: string, event: string, checked: boolean): void {
    const key = `${entity}.${event}`;
    if (checked) {
      this.selectedEvents.update((events) => [...events, key]);
    } else {
      this.selectedEvents.update((events) =>
        events.filter((e) => e !== key),
      );
    }
  }

  selectAll(): void {
    const all: string[] = [];
    for (const entity of this.entities) {
      for (const event of this.events) {
        all.push(`${entity}.${event}`);
      }
    }
    this.selectedEvents.set(all);
  }

  deselectAll(): void {
    this.selectedEvents.set([]);
  }

  onSubmit(): void {
    this.formSubmitted.set(true);

    if (this.form.invalid || this.selectedEvents().length === 0) {
      this.form.markAllAsTouched();
      return;
    }

    const formValue = this.form.getRawValue();

    if (this.isEditMode()) {
      const request: UpdateWebhookRequest = {
        name: formValue.name!,
        url: formValue.url!,
        eventSubscriptions: this.selectedEvents(),
        includeCustomFields: formValue.includeCustomFields!,
      };

      this.store.updateSubscription(this.id()!, request, () => {
        this.snackBar.open(this.transloco.translate('settings.webhooks.detail.webhookUpdated'), this.transloco.translate('settings.common.cancel'), { duration: 3000 });
        this.router.navigate(['/settings/webhooks', this.id()]);
      });
    } else {
      const request: CreateWebhookRequest = {
        name: formValue.name!,
        url: formValue.url!,
        eventSubscriptions: this.selectedEvents(),
        includeCustomFields: formValue.includeCustomFields!,
      };

      this.store.createSubscription(request, (created) => {
        // Show secret dialog (one-time display)
        this.dialog.open(WebhookSecretDialogComponent, {
          width: '500px',
          disableClose: true,
          data: { secret: created.secret },
        });

        this.snackBar.open(this.transloco.translate('settings.webhooks.detail.webhookCreated'), this.transloco.translate('settings.common.cancel'), { duration: 3000 });
        this.router.navigate(['/settings/webhooks']);
      });
    }
  }
}

// ---- Secret Display Dialog ----

/**
 * Dialog to display the webhook secret after creation or regeneration.
 * The secret is shown once and cannot be retrieved again.
 */
@Component({
  selector: 'app-webhook-secret-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    ClipboardModule,
    TranslocoPipe,
    MatTooltipModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ 'settings.webhooks.secretDialog.title' | transloco }}</h2>
    <mat-dialog-content>
      <div class="secret-warning">
        <mat-icon>warning</mat-icon>
        <p>{{ 'settings.webhooks.secretDialog.warning' | transloco }}</p>
      </div>
      <div class="secret-box">
        <code class="secret-value">{{ data.secret }}</code>
        <button mat-icon-button
                [matTooltip]="'settings.webhooks.secretDialog.copyTooltip' | transloco"
                (click)="copySecret()">
          <mat-icon>{{ copied ? 'check' : 'content_copy' }}</mat-icon>
        </button>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-flat-button color="primary" mat-dialog-close>
        {{ 'settings.webhooks.secretDialog.confirm' | transloco }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .secret-warning {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px 16px;
      background-color: #fef3c7;
      border: 1px solid #f59e0b;
      border-radius: 8px;
      margin-bottom: 16px;
    }

    .secret-warning mat-icon {
      color: #d97706;
      flex-shrink: 0;
      margin-top: 2px;
    }

    .secret-warning p {
      margin: 0;
      font-size: 14px;
      color: #92400e;
      font-weight: 500;
    }

    .secret-box {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      background-color: var(--color-bg-secondary);
      border: 1px solid var(--color-border);
      border-radius: 8px;
    }

    .secret-value {
      flex: 1;
      font-family: 'SF Mono', 'Fira Code', monospace;
      font-size: 13px;
      word-break: break-all;
      color: var(--color-text);
    }
  `,
})
export class WebhookSecretDialogComponent {
  readonly data: { secret: string } = inject(MAT_DIALOG_DATA);
  private readonly clipboard = inject(Clipboard);
  copied = false;

  copySecret(): void {
    this.clipboard.copy(this.data.secret);
    this.copied = true;
    setTimeout(() => (this.copied = false), 2000);
  }
}

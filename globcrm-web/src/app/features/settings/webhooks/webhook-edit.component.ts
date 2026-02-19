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
  ],
  providers: [WebhookStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
    }

    .webhook-edit {
      max-width: 700px;
      margin: 0 auto;
      padding: 24px;
    }

    .webhook-edit__header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }

    .webhook-edit__header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 500;
    }

    .webhook-edit__subtitle {
      color: var(--color-text-secondary);
      font-size: 14px;
      margin: 0 0 24px 0;
      padding-left: 48px;
    }

    .form-card {
      margin-bottom: 24px;
    }

    .form-card mat-card-title {
      font-size: 16px;
      font-weight: 500;
    }

    .form-field {
      width: 100%;
      margin-bottom: 16px;
    }

    .toggle-row {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 24px;
    }

    .toggle-label {
      font-size: 14px;
      color: var(--color-text);
    }

    .event-matrix {
      margin-top: 8px;
    }

    .event-matrix__header {
      display: grid;
      grid-template-columns: 120px repeat(3, 1fr);
      gap: 8px;
      margin-bottom: 8px;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--color-border);
    }

    .event-matrix__header span {
      font-size: 13px;
      font-weight: 600;
      color: var(--color-text-secondary);
      text-align: center;
    }

    .event-matrix__header span:first-child {
      text-align: left;
    }

    .event-matrix__row {
      display: grid;
      grid-template-columns: 120px repeat(3, 1fr);
      gap: 8px;
      align-items: center;
      padding: 4px 0;
    }

    .event-matrix__entity {
      font-size: 14px;
      font-weight: 500;
      color: var(--color-text);
    }

    .event-matrix__cell {
      text-align: center;
    }

    .event-matrix__actions {
      display: flex;
      gap: 8px;
      margin-top: 12px;
    }

    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      margin-top: 24px;
    }
  `,
  template: `
    <div class="webhook-edit">
      <div class="webhook-edit__header">
        <a mat-icon-button
           [routerLink]="isEditMode() ? ['/settings/webhooks', id()] : ['/settings/webhooks']"
           aria-label="Back">
          <mat-icon>arrow_back</mat-icon>
        </a>
        <h1>{{ isEditMode() ? 'Edit Webhook' : 'Create Webhook' }}</h1>
      </div>
      <p class="webhook-edit__subtitle">
        {{ isEditMode() ? 'Update the webhook subscription configuration' : 'Configure a new webhook subscription to receive event notifications' }}
      </p>

      @if (store.loading() && isEditMode()) {
        <div style="display: flex; justify-content: center; padding: 64px">
          <mat-spinner diameter="48"></mat-spinner>
        </div>
      } @else {
        <form [formGroup]="form" (ngSubmit)="onSubmit()">
          <!-- Basic Info Card -->
          <mat-card class="form-card">
            <mat-card-header>
              <mat-card-title>Basic Information</mat-card-title>
            </mat-card-header>
            <mat-card-content>
              <mat-form-field appearance="outline" class="form-field">
                <mat-label>Name</mat-label>
                <input matInput formControlName="name" placeholder="My Webhook" maxlength="200" />
                @if (form.get('name')?.hasError('required') && form.get('name')?.touched) {
                  <mat-error>Name is required</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline" class="form-field">
                <mat-label>URL</mat-label>
                <input matInput formControlName="url" placeholder="https://your-endpoint.com/webhook" maxlength="2048" />
                @if (form.get('url')?.hasError('required') && form.get('url')?.touched) {
                  <mat-error>URL is required</mat-error>
                }
                @if (form.get('url')?.hasError('pattern') && form.get('url')?.touched) {
                  <mat-error>URL must start with https://</mat-error>
                }
              </mat-form-field>

              <div class="toggle-row">
                <mat-slide-toggle formControlName="includeCustomFields"></mat-slide-toggle>
                <span class="toggle-label">Include custom fields in payload</span>
              </div>
            </mat-card-content>
          </mat-card>

          <!-- Event Subscription Matrix Card -->
          <mat-card class="form-card">
            <mat-card-header>
              <mat-card-title>Event Subscriptions</mat-card-title>
            </mat-card-header>
            <mat-card-content>
              <p style="font-size: 13px; color: var(--color-text-secondary); margin: 0 0 16px 0">
                Select which entity events trigger this webhook
              </p>

              <div class="event-matrix">
                <div class="event-matrix__header">
                  <span>Entity</span>
                  @for (event of events; track event) {
                    <span>{{ event }}</span>
                  }
                </div>
                @for (entity of entities; track entity) {
                  <div class="event-matrix__row">
                    <span class="event-matrix__entity">{{ entity }}</span>
                    @for (event of events; track event) {
                      <div class="event-matrix__cell">
                        <mat-checkbox
                          [checked]="isEventSelected(entity, event)"
                          (change)="toggleEvent(entity, event, $event.checked)">
                        </mat-checkbox>
                      </div>
                    }
                  </div>
                }
              </div>

              <div class="event-matrix__actions">
                <button mat-stroked-button type="button" (click)="selectAll()">
                  Select All
                </button>
                <button mat-stroked-button type="button" (click)="deselectAll()">
                  Deselect All
                </button>
              </div>

              @if (selectedEvents().length === 0 && formSubmitted()) {
                <p style="color: #dc2626; font-size: 13px; margin-top: 8px">
                  At least one event subscription is required
                </p>
              }
            </mat-card-content>
          </mat-card>

          <!-- Form Actions -->
          <div class="form-actions">
            <a mat-stroked-button
               [routerLink]="isEditMode() ? ['/settings/webhooks', id()] : ['/settings/webhooks']">
              Cancel
            </a>
            <button mat-flat-button color="primary" type="submit"
                    [disabled]="store.loading()">
              @if (store.loading()) {
                <mat-spinner diameter="20"></mat-spinner>
              }
              {{ isEditMode() ? 'Update Webhook' : 'Create Webhook' }}
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
        this.snackBar.open('Webhook updated.', 'Close', { duration: 3000 });
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

        this.snackBar.open('Webhook created.', 'Close', { duration: 3000 });
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
  ],
  template: `
    <h2 mat-dialog-title>Webhook Secret</h2>
    <mat-dialog-content>
      <div class="secret-warning">
        <mat-icon>warning</mat-icon>
        <p>This is the only time this secret will be shown. Copy it now.</p>
      </div>
      <div class="secret-box">
        <code class="secret-value">{{ data.secret }}</code>
        <button mat-icon-button
                matTooltip="Copy to clipboard"
                (click)="copySecret()">
          <mat-icon>{{ copied ? 'check' : 'content_copy' }}</mat-icon>
        </button>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-flat-button color="primary" mat-dialog-close>
        I've copied the secret
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

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
  ],
  providers: [WebhookStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
    }

    .webhook-list {
      max-width: 900px;
      margin: 0 auto;
      padding: 24px;
    }

    .webhook-list__header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }

    .webhook-list__header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 500;
      flex: 1;
    }

    .webhook-list__subtitle {
      color: var(--text-secondary, #64748b);
      font-size: 14px;
      margin: 0 0 24px 0;
      padding-left: 48px;
    }

    .webhook-list__actions {
      display: flex;
      gap: 8px;
    }

    .webhook-list__loading {
      display: flex;
      justify-content: center;
      padding: 64px;
    }

    .webhook-list__empty {
      text-align: center;
      padding: 64px 24px;
      color: var(--text-secondary, #64748b);
    }

    .webhook-list__empty mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      margin-bottom: 16px;
      opacity: 0.5;
    }

    .webhook-list__empty h3 {
      margin: 0 0 8px 0;
      font-weight: 500;
      color: var(--text-primary, #1e293b);
    }

    .webhook-card {
      margin-bottom: 12px;
      cursor: pointer;
      transition: border-color 0.15s, box-shadow 0.15s;
    }

    .webhook-card:hover {
      border-color: var(--primary, #4f46e5);
      box-shadow: 0 1px 3px rgba(79, 70, 229, 0.1);
    }

    .webhook-card__content {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px 20px;
    }

    .webhook-card__info {
      flex: 1;
      min-width: 0;
    }

    .webhook-card__name {
      font-size: 15px;
      font-weight: 600;
      margin: 0 0 4px 0;
      color: var(--text-primary, #1e293b);
    }

    .webhook-card__url {
      font-size: 13px;
      color: var(--text-secondary, #64748b);
      margin: 0 0 8px 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 400px;
      font-family: monospace;
    }

    .webhook-card__meta {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }

    .webhook-card__badge {
      font-size: 12px;
      padding: 2px 8px;
      border-radius: 12px;
      font-weight: 500;
    }

    .badge--active {
      background-color: #dcfce7;
      color: #166534;
    }

    .badge--disabled {
      background-color: #fecaca;
      color: #991b1b;
    }

    .badge--paused {
      background-color: #e2e8f0;
      color: #475569;
    }

    .webhook-card__events {
      font-size: 12px;
      color: var(--text-secondary, #64748b);
    }

    .webhook-card__failures {
      font-size: 12px;
      color: #dc2626;
      font-weight: 500;
    }

    .webhook-card__last-delivery {
      font-size: 12px;
      color: var(--text-secondary, #64748b);
    }

    .webhook-card__actions {
      display: flex;
      gap: 4px;
      flex-shrink: 0;
    }
  `,
  template: `
    <div class="webhook-list">
      <div class="webhook-list__header">
        <a mat-icon-button routerLink="/settings" aria-label="Back to settings">
          <mat-icon>arrow_back</mat-icon>
        </a>
        <h1>Webhooks</h1>
        <div class="webhook-list__actions">
          <a mat-stroked-button routerLink="/settings/webhooks/delivery-logs">
            <mat-icon>list_alt</mat-icon>
            View All Delivery Logs
          </a>
          <a mat-flat-button color="primary" routerLink="/settings/webhooks/new">
            <mat-icon>add</mat-icon>
            Add Webhook
          </a>
        </div>
      </div>
      <p class="webhook-list__subtitle">Manage webhook subscriptions for external integrations</p>

      @if (store.loading()) {
        <div class="webhook-list__loading">
          <mat-spinner diameter="48"></mat-spinner>
        </div>
      } @else if (store.subscriptions().length === 0) {
        <div class="webhook-list__empty">
          <mat-icon>link</mat-icon>
          <h3>No webhooks configured</h3>
          <p>Create a webhook subscription to send real-time event notifications to external systems.</p>
          <a mat-flat-button color="primary" routerLink="/settings/webhooks/new" style="margin-top: 16px">
            <mat-icon>add</mat-icon>
            Add Webhook
          </a>
        </div>
      } @else {
        @for (sub of store.subscriptions(); track sub.id) {
          <mat-card class="webhook-card" (click)="onView(sub)">
            <div class="webhook-card__content">
              <div class="webhook-card__info">
                <p class="webhook-card__name">{{ sub.name }}</p>
                <p class="webhook-card__url">{{ sub.url }}</p>
                <div class="webhook-card__meta">
                  <span class="webhook-card__badge"
                        [class.badge--active]="sub.isActive && !sub.isDisabled"
                        [class.badge--disabled]="sub.isDisabled"
                        [class.badge--paused]="!sub.isActive && !sub.isDisabled">
                    {{ getStatusLabel(sub) }}
                  </span>
                  <span class="webhook-card__events">
                    {{ sub.eventSubscriptions.length }} event{{ sub.eventSubscriptions.length !== 1 ? 's' : '' }}
                  </span>
                  @if (sub.consecutiveFailureCount > 0) {
                    <span class="webhook-card__failures">
                      {{ sub.consecutiveFailureCount }} consecutive failure{{ sub.consecutiveFailureCount !== 1 ? 's' : '' }}
                    </span>
                  }
                  @if (sub.lastDeliveryAt) {
                    <span class="webhook-card__last-delivery">
                      Last delivery: {{ sub.lastDeliveryAt | date:'short' }}
                    </span>
                  }
                </div>
              </div>
              <div class="webhook-card__actions" (click)="$event.stopPropagation()">
                <button mat-icon-button
                        matTooltip="Edit"
                        (click)="onEdit(sub)">
                  <mat-icon>edit</mat-icon>
                </button>
                <button mat-icon-button
                        matTooltip="Delete"
                        color="warn"
                        (click)="onDelete(sub)">
                  <mat-icon>delete</mat-icon>
                </button>
              </div>
            </div>
          </mat-card>
        }
      }
    </div>
  `,
})
export class WebhookListComponent implements OnInit {
  readonly store = inject(WebhookStore);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  ngOnInit(): void {
    this.store.loadSubscriptions();
  }

  getStatusLabel(sub: WebhookSubscription): string {
    if (sub.isDisabled) return 'Disabled';
    if (!sub.isActive) return 'Paused';
    return 'Active';
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
          `Webhook "${sub.name}" deleted.`,
          'Close',
          { duration: 3000 },
        );
      });
    });
  }
}

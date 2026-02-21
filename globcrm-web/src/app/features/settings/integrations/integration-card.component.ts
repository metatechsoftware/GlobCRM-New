import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  IntegrationCatalogItem,
  IntegrationConnection,
} from './integration.models';

@Component({
  selector: 'app-integration-card',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatMenuModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="ic-card"
      [class.ic-card--connected]="connection()?.status === 'Connected'"
    >
      <div class="ic-card__header">
        <div class="ic-card__icon-wrap">
          <img
            [src]="catalog().iconPath"
            [alt]="catalog().name"
            class="ic-card__icon"
          />
        </div>
        <div class="ic-card__badges">
          @if (catalog().isPopular) {
            <span class="ic-badge ic-badge--popular">{{ 'settings.integrations.popular' | transloco }}</span>
          }
          @if (connection()?.status === 'Connected') {
            <span class="ic-badge ic-badge--connected">{{ 'settings.integrations.status.connected' | transloco }}</span>
          } @else {
            <span class="ic-badge ic-badge--disconnected">{{ 'settings.integrations.status.notConnected' | transloco }}</span>
          }
        </div>
      </div>

      <div class="ic-card__body">
        <h3 class="ic-card__name">{{ catalog().name }}</h3>
        <p class="ic-card__desc">{{ catalog().description }}</p>
      </div>

      <div class="ic-card__actions">
        @if (isAdmin() && connection()?.status !== 'Connected') {
          <button
            mat-flat-button
            class="ic-card__connect-btn"
            (click)="connect.emit(); $event.stopPropagation()"
          >
            <mat-icon>power</mat-icon>
            {{ 'settings.integrations.connect' | transloco }}
          </button>
        }
        @if (isAdmin() && connection()?.status === 'Connected') {
          <button
            mat-icon-button
            class="ic-card__menu-btn"
            [matMenuTriggerFor]="cardMenu"
            (click)="$event.stopPropagation()"
          >
            <mat-icon>more_vert</mat-icon>
          </button>
          <mat-menu #cardMenu="matMenu">
            <button mat-menu-item (click)="testConnection.emit()">
              <mat-icon>speed</mat-icon>
              <span>{{ 'settings.integrations.testConnection' | transloco }}</span>
            </button>
            <button mat-menu-item class="ic-menu-disconnect" (click)="disconnect.emit()">
              <mat-icon>link_off</mat-icon>
              <span>{{ 'settings.integrations.disconnect' | transloco }}</span>
            </button>
          </mat-menu>
        }
        <button
          mat-button
          class="ic-card__details-btn"
          (click)="viewDetails.emit()"
        >
          {{ 'settings.integrations.viewDetails' | transloco }}
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      .ic-card {
        display: flex;
        flex-direction: column;
        padding: 20px;
        border: 1.5px solid var(--color-border);
        border-radius: 14px;
        background: var(--color-surface);
        min-height: 180px;
        cursor: pointer;
        transition:
          border-color 0.25s var(--ease-default),
          box-shadow 0.25s var(--ease-default),
          transform 0.25s var(--ease-default);
      }

      .ic-card:hover {
        border-color: var(--color-border-strong);
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
        transform: translateY(-2px);
      }

      .ic-card--connected {
        border-left: 3px solid var(--color-success);
      }

      .ic-card--connected:hover {
        border-left-color: var(--color-success);
      }

      .ic-card__header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        margin-bottom: 14px;
      }

      .ic-card__icon-wrap {
        width: 40px;
        height: 40px;
        flex-shrink: 0;
      }

      .ic-card__icon {
        width: 40px;
        height: 40px;
        object-fit: contain;
      }

      .ic-card__badges {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
        justify-content: flex-end;
      }

      .ic-badge {
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        padding: 2px 8px;
        border-radius: 6px;
        line-height: 1.6;
        white-space: nowrap;
      }

      .ic-badge--popular {
        background: var(--orange-glow);
        color: var(--color-primary);
      }

      .ic-badge--connected {
        background: var(--color-success-soft);
        color: var(--color-success-text);
      }

      .ic-badge--disconnected {
        background: var(--color-surface-hover);
        color: var(--color-text-muted);
      }

      .ic-card__body {
        flex: 1;
        margin-bottom: 14px;
      }

      .ic-card__name {
        font-size: 15px;
        font-weight: 700;
        color: var(--color-text);
        margin: 0 0 4px;
        letter-spacing: -0.02em;
      }

      .ic-card__desc {
        font-size: 12.5px;
        color: var(--color-text-muted);
        margin: 0;
        line-height: 1.45;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      .ic-card__actions {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-top: auto;
      }

      .ic-card__connect-btn {
        font-size: 12px;
        font-weight: 600;
        height: 32px;
        padding: 0 14px;
        border-radius: 8px;
        background: var(--color-primary) !important;
        color: var(--color-primary-fg) !important;
      }

      .ic-card__connect-btn mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
        margin-right: 4px;
      }

      .ic-card__menu-btn {
        width: 32px;
        height: 32px;
        line-height: 32px;
      }

      .ic-card__menu-btn mat-icon {
        font-size: 20px;
        color: var(--color-text-secondary);
      }

      .ic-card__details-btn {
        font-size: 12px;
        font-weight: 600;
        height: 32px;
        padding: 0 12px;
        border-radius: 8px;
        color: var(--color-text-secondary) !important;
      }

      .ic-card__details-btn:hover {
        color: var(--color-primary) !important;
      }

      @media (prefers-reduced-motion: reduce) {
        .ic-card {
          transition: none;
        }
      }
    `,
  ],
})
export class IntegrationCardComponent {
  readonly catalog = input.required<IntegrationCatalogItem>();
  readonly connection = input<IntegrationConnection | null>(null);
  readonly isAdmin = input<boolean>(false);

  readonly connect = output<void>();
  readonly disconnect = output<void>();
  readonly testConnection = output<void>();
  readonly viewDetails = output<void>();
}

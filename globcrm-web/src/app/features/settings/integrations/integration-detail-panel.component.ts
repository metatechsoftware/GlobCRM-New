import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  HostListener,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  IntegrationViewModel,
  IntegrationCatalogItem,
  IntegrationActivityLogEntry,
} from './integration.models';

@Component({
  selector: 'app-integration-detail-panel',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatDividerModule,
    DatePipe,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './integration-detail-panel.component.scss',
  template: `
    @if (integration(); as vm) {
      <div class="dp-panel" [class.dp-panel--open]="!!integration()">
        <!-- Brand Header Band -->
        <div class="dp-header-band" [style.--brand-color]="vm.catalog.brandColor"></div>

        <!-- Header -->
        <div class="dp-header">
          <div class="dp-header__left">
            <div class="dp-header__icon-wrap" [style.--brand-color]="vm.catalog.brandColor">
              <img
                [src]="vm.catalog.iconPath"
                [alt]="vm.catalog.name"
                class="dp-header__icon"
              />
            </div>
            <div class="dp-header__info">
              <h2 class="dp-header__name">{{ vm.catalog.name }}</h2>
              @if (vm.isConnected) {
                <span class="dp-status dp-status--connected">
                  <span class="dp-status__dot"></span>
                  {{ 'settings.integrations.status.connected' | transloco }}
                </span>
              } @else {
                <span class="dp-status dp-status--disconnected">
                  {{ 'settings.integrations.status.notConnected' | transloco }}
                </span>
              }
            </div>
          </div>
          <button
            mat-icon-button
            class="dp-header__close"
            (click)="close.emit()"
          >
            <mat-icon>close</mat-icon>
          </button>
        </div>

        <mat-divider />

        <!-- Description -->
        <div class="dp-section">
          <h3 class="dp-section__title">
            {{ 'settings.integrations.detail.description' | transloco }}
          </h3>
          <p class="dp-section__text">{{ vm.catalog.description }}</p>
          <span class="dp-category-chip">{{ vm.catalog.category }}</span>
        </div>

        <mat-divider />

        <!-- Connection Info (connected only) -->
        @if (vm.isConnected && vm.connection) {
          <div class="dp-section">
            <h3 class="dp-section__title">
              {{ 'settings.integrations.detail.connectionInfo' | transloco }}
            </h3>

            <!-- Masked Credentials -->
            @if (vm.connection.credentialMask) {
              <div class="dp-credential">
                <span class="dp-credential__label">
                  {{ 'settings.integrations.detail.credentials' | transloco }}
                </span>
                <span class="dp-credential__value">
                  {{ vm.connection.credentialMask }}
                </span>
              </div>
            }

            <!-- Connected At -->
            @if (vm.connection.connectedAt) {
              <div class="dp-credential">
                <span class="dp-credential__label">
                  {{ 'settings.integrations.detail.connectedAt' | transloco }}
                </span>
                <span class="dp-credential__value dp-credential__value--date">
                  {{ vm.connection.connectedAt | date:'medium' }}
                </span>
              </div>
            }
          </div>

          <mat-divider />
        }

        <!-- Actions (admin only) -->
        @if (isAdmin()) {
          <div class="dp-section dp-actions">
            @if (!vm.isConnected) {
              <button
                mat-flat-button
                class="dp-actions__connect"
                (click)="connect.emit(vm.catalog)"
              >
                <mat-icon>power</mat-icon>
                {{ 'settings.integrations.connect' | transloco }}
              </button>
            } @else {
              <button
                mat-stroked-button
                class="dp-actions__test"
                (click)="testConnection.emit(vm)"
              >
                <mat-icon>speed</mat-icon>
                {{ 'settings.integrations.testConnection' | transloco }}
              </button>
              <button
                mat-stroked-button
                class="dp-actions__disconnect"
                (click)="disconnect.emit(vm)"
              >
                <mat-icon>link_off</mat-icon>
                {{ 'settings.integrations.disconnect' | transloco }}
              </button>
            }
          </div>

          <!-- Test result display -->
          @if (testResult(); as result) {
            <div
              class="dp-test-result"
              [class.dp-test-result--success]="result.success"
              [class.dp-test-result--failure]="!result.success"
            >
              <mat-icon>{{ result.success ? 'check_circle' : 'error' }}</mat-icon>
              <span>
                {{ result.success
                  ? ('settings.integrations.detail.testPassed' | transloco)
                  : (('settings.integrations.detail.testFailed' | transloco) + (result.message ? ': ' + result.message : ''))
                }}
              </span>
            </div>
          }

          <mat-divider />
        }

        <!-- Activity Log -->
        <div class="dp-section dp-activity">
          <h3 class="dp-section__title">
            {{ 'settings.integrations.detail.activityLog' | transloco }}
          </h3>

          @if (activityLog().length > 0) {
            <div class="dp-activity__list">
              @for (entry of activityLog(); track entry.id) {
                <div class="dp-activity__item">
                  <div class="dp-activity__icon-wrap" [class]="getActionIconWrapClass(entry.action)">
                    <mat-icon class="dp-activity__icon">
                      {{ getActionIcon(entry.action) }}
                    </mat-icon>
                  </div>
                  <div class="dp-activity__content">
                    <span class="dp-activity__action">{{ entry.action }}</span>
                    <span class="dp-activity__user">{{ entry.performedByUserName }}</span>
                  </div>
                  <span class="dp-activity__time">
                    {{ entry.createdAt | date:'short' }}
                  </span>
                </div>
              }
            </div>
          } @else {
            <p class="dp-activity__empty">
              {{ 'settings.integrations.detail.noActivity' | transloco }}
            </p>
          }
        </div>
      </div>
    }
  `,
})
export class IntegrationDetailPanelComponent {
  readonly integration = input<IntegrationViewModel | null>(null);
  readonly isAdmin = input<boolean>(false);
  readonly activityLog = input<IntegrationActivityLogEntry[]>([]);
  readonly testResult = input<{ success: boolean; message: string } | null>(null);

  readonly close = output<void>();
  readonly connect = output<IntegrationCatalogItem>();
  readonly disconnect = output<IntegrationViewModel>();
  readonly testConnection = output<IntegrationViewModel>();

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.integration()) {
      this.close.emit();
    }
  }

  getActionIcon(action: string): string {
    const lower = action.toLowerCase();
    if (lower.includes('connected') && !lower.includes('disconnected')) return 'link';
    if (lower.includes('disconnected')) return 'link_off';
    if (lower.includes('test') && lower.includes('success')) return 'verified';
    if (lower.includes('test') && lower.includes('fail')) return 'error';
    if (lower.includes('test')) return 'speed';
    return 'history';
  }

  getActionIconWrapClass(action: string): string {
    const lower = action.toLowerCase();
    if (lower.includes('connected') && !lower.includes('disconnected')) return 'dp-activity__icon-wrap--connected';
    if (lower.includes('disconnected')) return 'dp-activity__icon-wrap--disconnected';
    if (lower.includes('test') && lower.includes('success')) return 'dp-activity__icon-wrap--success';
    if (lower.includes('test') && lower.includes('fail')) return 'dp-activity__icon-wrap--failure';
    return '';
  }
}

import {
  Component,
  ChangeDetectionStrategy,
  signal,
  computed,
  inject,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { AuthStore } from '../../../core/auth/auth.store';
import { INTEGRATION_CATALOG } from './integration-catalog';
import {
  IntegrationCategory,
  IntegrationCatalogItem,
  IntegrationViewModel,
  IntegrationActivityLogEntry,
  CATEGORY_ICONS,
} from './integration.models';
import { IntegrationCardComponent } from './integration-card.component';
import { IntegrationStore } from './integration.store';
import { IntegrationService } from './integration.service';
import {
  IntegrationConnectDialogComponent,
  ConnectDialogResult,
} from './integration-connect-dialog.component';
import { IntegrationDisconnectDialogComponent } from './integration-disconnect-dialog.component';
import { IntegrationDetailPanelComponent } from './integration-detail-panel.component';

interface CategoryOption {
  value: IntegrationCategory | 'all';
  labelKey: string;
}

@Component({
  selector: 'app-integration-marketplace',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    TranslocoPipe,
    IntegrationCardComponent,
    IntegrationDetailPanelComponent,
  ],
  providers: [IntegrationStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './integration-marketplace.component.scss',
  template: `
    <!-- Page Header -->
    <div class="mp-header">
      <div class="mp-header__mesh"></div>
      <div class="mp-header__content">
        <div class="mp-header__icon-wrap">
          <mat-icon class="mp-header__icon">hub</mat-icon>
        </div>
        <div class="mp-header__text">
          <h1 class="mp-header__title">{{ 'settings.integrations.title' | transloco }}</h1>
          <p class="mp-header__subtitle">{{ 'settings.integrations.subtitle' | transloco }}</p>
        </div>
      </div>
    </div>

    <!-- Filter Bar -->
    <div class="mp-filter-bar">
      <!-- Search -->
      <div class="mp-search">
        <mat-icon class="mp-search__icon">search</mat-icon>
        <input
          type="text"
          class="mp-search__input"
          [placeholder]="'settings.integrations.search' | transloco"
          [ngModel]="searchQuery()"
          (ngModelChange)="searchQuery.set($event)"
        />
      </div>

      <!-- Category Chips -->
      <div class="mp-categories">
        @for (cat of categories; track cat.value) {
          <button
            class="mp-chip"
            [class.mp-chip--active]="selectedCategory() === cat.value"
            (click)="selectedCategory.set(cat.value)"
          >
            <mat-icon class="mp-chip__icon">{{ getCategoryIcon(cat.value) }}</mat-icon>
            {{ cat.labelKey | transloco }}
          </button>
        }
      </div>
    </div>

    <!-- Integration Grid -->
    @if (integrations().length > 0) {
      <div class="mp-grid">
        @for (integration of integrations(); track integration.catalog.key; let i = $index) {
          <app-integration-card
            [catalog]="integration.catalog"
            [connection]="integration.connection"
            [isAdmin]="isAdmin()"
            [animationDelay]="(i * 60) + 'ms'"
            (connect)="onConnect(integration)"
            (disconnect)="onDisconnect(integration)"
            (testConnection)="onTestConnection(integration)"
            (viewDetails)="onViewDetails(integration)"
          />
        }
      </div>
    } @else {
      <div class="mp-empty">
        <div class="mp-empty__icon-wrap">
          <mat-icon class="mp-empty__icon">extension_off</mat-icon>
        </div>
        <h3 class="mp-empty__heading">{{ 'settings.integrations.empty' | transloco }}</h3>
        <p class="mp-empty__text">{{ 'settings.integrations.emptyHint' | transloco }}</p>
        <button class="mp-empty__reset" (click)="clearFilters()">
          {{ 'settings.clearSearch' | transloco }}
        </button>
      </div>
    }

    <!-- Backdrop -->
    @if (selectedIntegration()) {
      <div class="mp-backdrop" (click)="onClosePanel()"></div>
    }

    <!-- Detail Panel -->
    <app-integration-detail-panel
      [integration]="selectedIntegration()"
      [isAdmin]="isAdmin()"
      [activityLog]="activityLog()"
      [testResult]="panelTestResult()"
      (close)="onClosePanel()"
      (connect)="onPanelConnect($event)"
      (disconnect)="onPanelDisconnect($event)"
      (testConnection)="onPanelTestConnection($event)"
    />
  `,
})
export class IntegrationMarketplaceComponent implements OnInit {
  private readonly authStore = inject(AuthStore);
  private readonly integrationStore = inject(IntegrationStore);
  private readonly integrationService = inject(IntegrationService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly transloco = inject(TranslocoService);

  readonly searchQuery = signal('');
  readonly selectedCategory = signal<IntegrationCategory | 'all'>('all');
  readonly selectedIntegration = signal<IntegrationViewModel | null>(null);
  readonly activityLog = signal<IntegrationActivityLogEntry[]>([]);
  readonly panelTestResult = signal<{ success: boolean; message: string } | null>(null);

  readonly categories: CategoryOption[] = [
    { value: 'all', labelKey: 'settings.integrations.categories.all' },
    { value: 'communication', labelKey: 'settings.integrations.categories.communication' },
    { value: 'accounting', labelKey: 'settings.integrations.categories.accounting' },
    { value: 'marketing', labelKey: 'settings.integrations.categories.marketing' },
    { value: 'storage', labelKey: 'settings.integrations.categories.storage' },
    { value: 'calendar', labelKey: 'settings.integrations.categories.calendar' },
    { value: 'developer-tools', labelKey: 'settings.integrations.categories.developerTools' },
  ];

  readonly isAdmin = computed(() => this.authStore.userRole() === 'Admin');

  readonly integrations = computed<IntegrationViewModel[]>(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const category = this.selectedCategory();
    const conns = this.integrationStore.connections();

    return INTEGRATION_CATALOG.filter((item) => {
      if (category !== 'all' && item.category !== category) {
        return false;
      }
      if (query && !item.name.toLowerCase().includes(query)) {
        return false;
      }
      return true;
    }).map((item) => {
      const conn = conns.find((c) => c.integrationKey === item.key) ?? null;
      return {
        catalog: item,
        connection: conn,
        isConnected: conn?.status === 'Connected',
      };
    });
  });

  ngOnInit(): void {
    this.integrationStore.loadConnections();
  }

  getCategoryIcon(category: IntegrationCategory | 'all'): string {
    return CATEGORY_ICONS[category] ?? 'apps';
  }

  clearFilters(): void {
    this.searchQuery.set('');
    this.selectedCategory.set('all');
  }

  onConnect(integration: IntegrationViewModel): void {
    this.openConnectDialog(integration);
  }

  onDisconnect(integration: IntegrationViewModel): void {
    this.openDisconnectDialog(integration);
  }

  onTestConnection(integration: IntegrationViewModel): void {
    this.executeTestConnection(integration);
  }

  onViewDetails(integration: IntegrationViewModel): void {
    this.selectedIntegration.set(integration);
    this.panelTestResult.set(null);

    if (integration.isConnected && integration.connection) {
      this.integrationService
        .getActivityLog(integration.connection.id)
        .subscribe({
          next: (log) => this.activityLog.set(log),
          error: () => this.activityLog.set([]),
        });
    } else {
      this.activityLog.set([]);
    }
  }

  onClosePanel(): void {
    this.selectedIntegration.set(null);
    this.activityLog.set([]);
    this.panelTestResult.set(null);
  }

  onPanelConnect(catalog: IntegrationCatalogItem): void {
    const vm = this.integrations().find((i) => i.catalog.key === catalog.key);
    if (vm) {
      this.openConnectDialog(vm);
    }
  }

  onPanelDisconnect(integration: IntegrationViewModel): void {
    this.openDisconnectDialog(integration);
  }

  onPanelTestConnection(integration: IntegrationViewModel): void {
    this.executeTestConnection(integration);
  }

  private openConnectDialog(integration: IntegrationViewModel): void {
    const dialogRef = this.dialog.open(IntegrationConnectDialogComponent, {
      data: { catalogItem: integration.catalog },
      width: '480px',
    });

    dialogRef
      .afterClosed()
      .subscribe((result: ConnectDialogResult | undefined) => {
        if (result) {
          this.integrationStore.connectIntegration(
            integration.catalog.key,
            result.credentials,
            () => {
              this.snackBar.open(
                this.transloco.translate(
                  'settings.integrations.snackbar.connected',
                  { name: integration.catalog.name },
                ),
                'Close',
                { duration: 3000 },
              );
              // Refresh panel if it's open for this integration
              this.refreshPanelIfOpen(integration.catalog.key);
            },
            (error) => {
              this.snackBar.open(
                this.transloco.translate(
                  'settings.integrations.snackbar.connectError',
                  { name: integration.catalog.name },
                ),
                'Close',
                { duration: 5000 },
              );
            },
          );
        }
      });
  }

  private openDisconnectDialog(integration: IntegrationViewModel): void {
    const dialogRef = this.dialog.open(IntegrationDisconnectDialogComponent, {
      data: { integrationName: integration.catalog.name },
      width: '420px',
    });

    dialogRef.afterClosed().subscribe((confirmed: boolean) => {
      if (confirmed && integration.connection) {
        this.integrationStore.disconnectIntegration(
          integration.connection.id,
          () => {
            this.snackBar.open(
              this.transloco.translate(
                'settings.integrations.snackbar.disconnected',
                { name: integration.catalog.name },
              ),
              'Close',
              { duration: 3000 },
            );
            // Refresh panel if it's open for this integration
            this.refreshPanelIfOpen(integration.catalog.key);
          },
        );
      }
    });
  }

  private executeTestConnection(integration: IntegrationViewModel): void {
    if (!integration.connection) return;

    this.integrationStore.testConnection(
      integration.connection.id,
      (result) => {
        this.panelTestResult.set(result);
        if (result.success) {
          this.snackBar.open(
            this.transloco.translate(
              'settings.integrations.snackbar.testSuccess',
            ),
            'Close',
            { duration: 3000 },
          );
        } else {
          this.snackBar.open(
            this.transloco.translate(
              'settings.integrations.snackbar.testFailed',
            ),
            'Close',
            { duration: 5000 },
          );
        }
        // Refresh activity log after test
        if (integration.connection) {
          this.integrationService
            .getActivityLog(integration.connection.id)
            .subscribe({
              next: (log) => this.activityLog.set(log),
              error: () => {},
            });
        }
      },
      (error) => {
        this.panelTestResult.set({ success: false, message: error });
        this.snackBar.open(
          this.transloco.translate(
            'settings.integrations.snackbar.testFailed',
          ),
          'Close',
          { duration: 5000 },
        );
      },
    );
  }

  private refreshPanelIfOpen(integrationKey: string): void {
    const currentPanel = this.selectedIntegration();
    if (currentPanel && currentPanel.catalog.key === integrationKey) {
      // Re-find the updated integration from the computed list after store update
      setTimeout(() => {
        const updated = this.integrations().find(
          (i) => i.catalog.key === integrationKey,
        );
        if (updated) {
          this.selectedIntegration.set(updated);
          if (updated.isConnected && updated.connection) {
            this.integrationService
              .getActivityLog(updated.connection.id)
              .subscribe({
                next: (log) => this.activityLog.set(log),
                error: () => this.activityLog.set([]),
              });
          } else {
            this.activityLog.set([]);
          }
        }
      });
    }
  }
}

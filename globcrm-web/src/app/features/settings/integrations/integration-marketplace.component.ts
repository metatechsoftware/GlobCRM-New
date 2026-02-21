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
import { AuthStore } from '../../../core/auth/auth.store';
import { INTEGRATION_CATALOG } from './integration-catalog';
import {
  IntegrationCategory,
  IntegrationCatalogItem,
  IntegrationViewModel,
} from './integration.models';
import { IntegrationCardComponent } from './integration-card.component';
import { IntegrationStore } from './integration.store';
import {
  IntegrationConnectDialogComponent,
  ConnectDialogResult,
} from './integration-connect-dialog.component';
import { IntegrationDisconnectDialogComponent } from './integration-disconnect-dialog.component';

interface CategoryOption {
  value: IntegrationCategory | 'all';
  label: string;
}

@Component({
  selector: 'app-integration-marketplace',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    IntegrationCardComponent,
  ],
  providers: [IntegrationStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './integration-marketplace.component.scss',
  template: `
    <!-- Page Header -->
    <div class="mp-header">
      <h1 class="mp-header__title">Integrations</h1>
      <p class="mp-header__subtitle">
        Browse and connect third-party services to enhance your CRM workflow
      </p>
    </div>

    <!-- Filter Bar -->
    <div class="mp-filter-bar">
      <!-- Search -->
      <div class="mp-search">
        <mat-icon class="mp-search__icon">search</mat-icon>
        <input
          type="text"
          class="mp-search__input"
          placeholder="Search integrations..."
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
            {{ cat.label }}
          </button>
        }
      </div>
    </div>

    <!-- Integration Grid -->
    @if (integrations().length > 0) {
      <div class="mp-grid">
        @for (integration of integrations(); track integration.catalog.key) {
          <app-integration-card
            [catalog]="integration.catalog"
            [connection]="integration.connection"
            [isAdmin]="isAdmin()"
            (connect)="onConnect(integration)"
            (disconnect)="onDisconnect(integration)"
            (testConnection)="onTestConnection(integration)"
            (viewDetails)="onViewDetails(integration)"
          />
        }
      </div>
    } @else {
      <div class="mp-empty">
        <mat-icon class="mp-empty__icon">search_off</mat-icon>
        <p class="mp-empty__text">No integrations found matching your criteria</p>
        <button class="mp-empty__reset" (click)="clearFilters()">
          Clear Filters
        </button>
      </div>
    }
  `,
})
export class IntegrationMarketplaceComponent implements OnInit {
  private readonly authStore = inject(AuthStore);
  private readonly integrationStore = inject(IntegrationStore);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  readonly searchQuery = signal('');
  readonly selectedCategory = signal<IntegrationCategory | 'all'>('all');

  readonly categories: CategoryOption[] = [
    { value: 'all', label: 'All' },
    { value: 'communication', label: 'Communication' },
    { value: 'accounting', label: 'Accounting' },
    { value: 'marketing', label: 'Marketing' },
    { value: 'storage', label: 'Storage' },
    { value: 'calendar', label: 'Calendar' },
    { value: 'developer-tools', label: 'Developer Tools' },
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

  clearFilters(): void {
    this.searchQuery.set('');
    this.selectedCategory.set('all');
  }

  onConnect(integration: IntegrationViewModel): void {
    const dialogRef = this.dialog.open(IntegrationConnectDialogComponent, {
      data: { catalogItem: integration.catalog },
      width: '480px',
    });

    dialogRef.afterClosed().subscribe((result: ConnectDialogResult | undefined) => {
      if (result) {
        this.integrationStore.connectIntegration(
          integration.catalog.key,
          result.credentials,
          () => {
            this.snackBar.open(
              `Connected to ${integration.catalog.name}`,
              'Close',
              { duration: 3000 },
            );
          },
          (error) => {
            this.snackBar.open(error, 'Close', { duration: 5000 });
          },
        );
      }
    });
  }

  onDisconnect(integration: IntegrationViewModel): void {
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
              `Disconnected from ${integration.catalog.name}`,
              'Close',
              { duration: 3000 },
            );
          },
        );
      }
    });
  }

  onTestConnection(integration: IntegrationViewModel): void {
    if (!integration.connection) return;

    this.integrationStore.testConnection(
      integration.connection.id,
      (result) => {
        if (result.success) {
          this.snackBar.open('Connection test passed', 'Close', {
            duration: 3000,
          });
        } else {
          this.snackBar.open(
            `Connection test failed: ${result.message}`,
            'Close',
            { duration: 5000 },
          );
        }
      },
      (error) => {
        this.snackBar.open(`Connection test failed: ${error}`, 'Close', {
          duration: 5000,
        });
      },
    );
  }

  onViewDetails(integration: IntegrationViewModel): void {
    // Plan 05 will open detail panel here
    console.log('View details:', integration.catalog.key);
  }
}

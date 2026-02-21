import {
  Component,
  ChangeDetectionStrategy,
  signal,
  computed,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { AuthStore } from '../../../core/auth/auth.store';
import { INTEGRATION_CATALOG } from './integration-catalog';
import {
  IntegrationCategory,
  IntegrationConnection,
  IntegrationViewModel,
} from './integration.models';
import { IntegrationCardComponent } from './integration-card.component';

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
export class IntegrationMarketplaceComponent {
  private readonly authStore = inject(AuthStore);

  readonly searchQuery = signal('');
  readonly selectedCategory = signal<IntegrationCategory | 'all'>('all');

  /** Populated by Plan 04 when store wiring is complete */
  readonly connections = signal<IntegrationConnection[]>([]);

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
    const conns = this.connections();

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

  clearFilters(): void {
    this.searchQuery.set('');
    this.selectedCategory.set('all');
  }

  onConnect(integration: IntegrationViewModel): void {
    // Placeholder -- will be wired in Plan 04
  }

  onViewDetails(integration: IntegrationViewModel): void {
    // Placeholder -- will be wired in Plan 04
  }
}

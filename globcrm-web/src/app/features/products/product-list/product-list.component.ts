import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  inject,
  computed,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';

import { DynamicTableComponent } from '../../../shared/components/dynamic-table/dynamic-table.component';
import { ViewSidebarComponent } from '../../../shared/components/saved-views/view-sidebar.component';
import { FilterChipsComponent } from '../../../shared/components/filter-chips/filter-chips.component';
import { FilterPanelComponent } from '../../../shared/components/filter-panel/filter-panel.component';
import { HasPermissionDirective } from '../../../core/permissions/has-permission.directive';
import { CustomFieldService } from '../../../core/custom-fields/custom-field.service';
import { CustomFieldDefinition } from '../../../core/custom-fields/custom-field.models';
import {
  ColumnDefinition,
  ViewColumn,
  ViewFilter,
  SavedView,
} from '../../../shared/components/saved-views/view.models';
import { ViewStore } from '../../../shared/components/saved-views/view.store';
import { ConfirmDeleteDialogComponent } from '../../../shared/components/confirm-delete-dialog/confirm-delete-dialog.component';
import { ProductStore } from '../product.store';
import { ProductService } from '../product.service';
import { ProductDto } from '../product.models';
import { EntityFormDialogComponent } from '../../../shared/components/entity-form-dialog/entity-form-dialog.component';
import { EntityFormDialogResult } from '../../../shared/components/entity-form-dialog/entity-form-dialog.models';

/**
 * Core product column definitions for the dynamic table.
 */
const PRODUCT_CORE_COLUMNS: ColumnDefinition[] = [
  { fieldId: 'name', label: 'Product Name', isCustomField: false, fieldType: 'text', sortable: true, filterable: true },
  { fieldId: 'sku', label: 'SKU', isCustomField: false, fieldType: 'text', sortable: true, filterable: true },
  { fieldId: 'category', label: 'Category', isCustomField: false, fieldType: 'text', sortable: true, filterable: true },
  { fieldId: 'unitPrice', label: 'Unit Price', isCustomField: false, fieldType: 'number', sortable: true, filterable: true },
  { fieldId: 'isActive', label: 'Active', isCustomField: false, fieldType: 'checkbox', sortable: true, filterable: true, renderAs: 'badge' },
  { fieldId: 'createdAt', label: 'Created', isCustomField: false, fieldType: 'date', sortable: true, filterable: true },
];

/**
 * Default visible columns with initial widths and sort orders.
 */
const DEFAULT_PRODUCT_COLUMNS: ViewColumn[] = [
  { fieldId: 'name', isCustomField: false, width: 200, sortOrder: 0, visible: true },
  { fieldId: 'sku', isCustomField: false, width: 120, sortOrder: 1, visible: true },
  { fieldId: 'category', isCustomField: false, width: 150, sortOrder: 2, visible: true },
  { fieldId: 'unitPrice', isCustomField: false, width: 120, sortOrder: 3, visible: true },
  { fieldId: 'isActive', isCustomField: false, width: 100, sortOrder: 4, visible: true },
  { fieldId: 'createdAt', isCustomField: false, width: 150, sortOrder: 5, visible: true },
];

/**
 * Product list page with DynamicTableComponent.
 * Uses ViewStore for saved views and ProductStore for data.
 *
 * Standalone component with component-provided stores for per-page isolation.
 */
@Component({
  selector: 'app-product-list',
  standalone: true,
  imports: [
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    DynamicTableComponent,
    ViewSidebarComponent,
    FilterChipsComponent,
    FilterPanelComponent,
    HasPermissionDirective,
  ],
  providers: [ViewStore, ProductStore],
  templateUrl: './product-list.component.html',
  styleUrls: ['../../../../styles/_entity-list.scss', './product-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductListComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  readonly productStore = inject(ProductStore);
  private readonly productService = inject(ProductService);
  readonly viewStore = inject(ViewStore);
  private readonly customFieldService = inject(CustomFieldService);

  /** Column definitions (core + custom fields merged). */
  columnDefinitions = signal<ColumnDefinition[]>(PRODUCT_CORE_COLUMNS);

  /** Active view columns (or default). */
  columns = signal<ViewColumn[]>(DEFAULT_PRODUCT_COLUMNS);

  /** Active filters. */
  filters = signal<ViewFilter[]>([]);

  /**
   * Format data for display: format unitPrice as currency, isActive as text.
   */
  displayData = computed(() => {
    return this.productStore.items().map((product: ProductDto) => ({
      ...product,
      unitPrice: this.formatCurrency(product.unitPrice),
      isActive: product.isActive ? 'Active' : 'Inactive',
    }));
  });

  ngOnInit(): void {
    // Load product data
    this.productStore.loadPage();

    // Load custom field definitions and merge with core columns
    this.customFieldService.getFieldsByEntityType('Product').subscribe({
      next: (fields) => {
        const customColDefs: ColumnDefinition[] = fields.map((f) => ({
          fieldId: f.id,
          label: f.label,
          isCustomField: true,
          fieldType: f.fieldType.toLowerCase(),
          sortable: false,
          filterable: f.fieldType !== 'formula', // Formula fields are computed, not filterable
        }));
        this.columnDefinitions.set([...PRODUCT_CORE_COLUMNS, ...customColDefs]);

        // Add custom field columns (hidden by default)
        const customViewCols: ViewColumn[] = fields.map((f, i) => ({
          fieldId: f.id,
          isCustomField: true,
          width: 150,
          sortOrder: DEFAULT_PRODUCT_COLUMNS.length + i,
          visible: false,
        }));
        this.columns.set([...DEFAULT_PRODUCT_COLUMNS, ...customViewCols]);
      },
    });
  }

  onViewSelected(view: SavedView): void {
    if (view.columns.length > 0) {
      this.columns.set(view.columns);
    }
    if (view.filters.length > 0) {
      this.filters.set(view.filters);
      this.productStore.setFilters(view.filters);
    }
    if (view.sorts.length > 0) {
      const sort = view.sorts[0];
      this.productStore.setSort(sort.fieldId, sort.direction);
    }
  }

  onSearchChanged(search: string): void {
    this.productStore.setSearch(search);
  }

  onSortChanged(sort: { fieldId: string; direction: 'asc' | 'desc'; sortOrder: number }): void {
    this.productStore.setSort(sort.fieldId, sort.direction);
  }

  onPageChanged(event: { page: number; pageSize: number }): void {
    this.productStore.setPage(event.page);
    if (event.pageSize !== this.productStore.pageSize()) {
      this.productStore.setPageSize(event.pageSize);
    }
  }

  onFiltersChanged(filters: ViewFilter[]): void {
    this.filters.set(filters);
    this.productStore.setFilters(filters);
  }

  onFilterRemoved(filter: ViewFilter): void {
    const updated = this.filters().filter(
      (f) => f.fieldId !== filter.fieldId || f.operator !== filter.operator || f.value !== filter.value,
    );
    this.filters.set(updated);
    this.productStore.setFilters(updated);
  }

  onFiltersCleared(): void {
    this.filters.set([]);
    this.productStore.setFilters([]);
  }

  onColumnOrderChanged(columns: ViewColumn[]): void {
    this.columns.set(columns);
  }

  onColumnResized(event: { fieldId: string; width: number }): void {
    const updated = this.columns().map((col) =>
      col.fieldId === event.fieldId ? { ...col, width: event.width } : col,
    );
    this.columns.set(updated);
  }

  onColumnsVisibilityChanged(columns: ViewColumn[]): void {
    this.columns.set(columns);
  }

  onCustomFieldCreated(field: CustomFieldDefinition): void {
    // Append custom field to column definitions
    const newColDef: ColumnDefinition = {
      fieldId: field.id,
      label: field.label,
      isCustomField: true,
      fieldType: field.fieldType.toLowerCase(),
      sortable: false,
      filterable: field.fieldType !== 'formula', // Formula fields are computed, not filterable
    };
    this.columnDefinitions.set([...this.columnDefinitions(), newColDef]);

    // Append visible ViewColumn
    const maxOrder = this.columns().reduce((max, c) => Math.max(max, c.sortOrder), 0);
    this.columns.set([
      ...this.columns(),
      { fieldId: field.id, isCustomField: true, width: 150, sortOrder: maxOrder + 1, visible: true },
    ]);
  }

  onRowEditClicked(row: any): void {
    this.router.navigate(['/products', row.id]);
  }

  onRowViewClicked(row: any): void {
    this.router.navigate(['/products', row.id]);
  }

  onRowDeleteClicked(row: any): void {
    const dialogRef = this.dialog.open(ConfirmDeleteDialogComponent, {
      data: { name: row.name },
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.productService.delete(row.id).subscribe({
          next: () => this.productStore.loadPage(),
          error: () => {},
        });
      }
    });
  }

  navigateToNewProduct(): void {
    const dialogRef = this.dialog.open(EntityFormDialogComponent, {
      data: { entityType: 'Product' },
      width: '800px',
      maxHeight: '90vh',
    });
    dialogRef.afterClosed().subscribe((result?: EntityFormDialogResult) => {
      if (!result) return;
      if (result.action === 'view') {
        this.router.navigate(['/products', result.entity.id]);
      } else {
        this.productStore.loadPage();
      }
    });
  }

  private formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  }
}

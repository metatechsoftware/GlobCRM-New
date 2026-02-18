import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { DynamicTableComponent } from '../../../shared/components/dynamic-table/dynamic-table.component';
import { FilterPanelComponent } from '../../../shared/components/filter-panel/filter-panel.component';
import { FilterChipsComponent } from '../../../shared/components/filter-chips/filter-chips.component';
import { ViewSidebarComponent } from '../../../shared/components/saved-views/view-sidebar.component';
import { ViewStore } from '../../../shared/components/saved-views/view.store';
import {
  ColumnDefinition,
  ViewColumn,
  ViewFilter,
  ViewSort,
  SavedView,
} from '../../../shared/components/saved-views/view.models';
import { HasPermissionDirective } from '../../../core/permissions/has-permission.directive';
import { PermissionStore } from '../../../core/permissions/permission.store';
import { CustomFieldService } from '../../../core/custom-fields/custom-field.service';
import { CustomFieldDefinition } from '../../../core/custom-fields/custom-field.models';
import { ConfirmDeleteDialogComponent } from '../../settings/roles/role-list.component';
import { QuoteStore } from '../quote.store';
import { QuoteService } from '../quote.service';
import { QuoteListDto, QUOTE_STATUSES } from '../quote.models';

/**
 * Quote list page with dynamic table, status filter, saved views sidebar.
 * Component-provides ViewStore and QuoteStore for per-page instance isolation.
 *
 * Displays quotes with status badges (colored by QUOTE_STATUSES),
 * currency-formatted grand totals, and standard DynamicTable features.
 */
@Component({
  selector: 'app-quote-list',
  standalone: true,
  imports: [
    RouterLink,
    MatButtonModule,
    MatIconModule,
    DynamicTableComponent,
    FilterPanelComponent,
    FilterChipsComponent,
    ViewSidebarComponent,
    HasPermissionDirective,
  ],
  providers: [ViewStore, QuoteStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    @use '../../../../styles/entity-list';

    .status-badge {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
      color: #fff;
      line-height: 1.5;
    }
  `,
  template: `
    <div class="entity-list-layout">
      <app-view-sidebar
        [entityType]="'Quote'"
        (viewSelected)="onViewSelected($event)" />
      <div class="entity-list-content">
        <div class="list-header">
          <h1>Quotes</h1>

          <div class="list-header-actions">
            <button mat-raised-button color="primary"
                    *appHasPermission="'Quote:Create'"
                    routerLink="new">
              <mat-icon>add</mat-icon> New Quote
            </button>
          </div>
        </div>

        <app-filter-chips
          [filters]="quoteStore.filters()"
          [columnDefinitions]="columnDefs()"
          (filterRemoved)="onFilterRemoved($event)"
          (filtersCleared)="onFiltersCleared()" />

        <app-filter-panel
          [columnDefinitions]="columnDefs()"
          [activeFilters]="quoteStore.filters()"
          (filtersChanged)="onFilterApplied($event)" />

        <app-dynamic-table
          entityType="Quote"
          [data]="displayData()"
          [columns]="activeViewColumns()"
          [columnDefinitions]="columnDefs()"
          [totalCount]="quoteStore.totalCount()"
          [pageSize]="quoteStore.pageSize()"
          [loading]="quoteStore.isLoading()"
          (sortChanged)="onSortChanged($event)"
          (pageChanged)="onPageChanged($event)"
          (rowEditClicked)="onRowClicked($event)" />
      </div>
    </div>
  `,
})
export class QuoteListComponent implements OnInit {
  readonly quoteStore = inject(QuoteStore);
  private readonly viewStore = inject(ViewStore);
  private readonly quoteService = inject(QuoteService);
  private readonly customFieldService = inject(CustomFieldService);
  private readonly permissionStore = inject(PermissionStore);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);

  /** Currency formatter for grand total column. */
  private readonly currencyFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  });

  /** Status color map for quick lookup. */
  private readonly statusColorMap = new Map(
    QUOTE_STATUSES.map((s) => [s.value, s.color]),
  );

  /** All column definitions (core + custom fields). */
  columnDefs = signal<ColumnDefinition[]>([]);

  /** Custom field definitions loaded from API. */
  private customFieldDefs = signal<CustomFieldDefinition[]>([]);

  /** Active view columns (from selected view or defaults). */
  private viewColumns = signal<ViewColumn[]>([]);

  /** Default visible column field IDs. */
  private readonly defaultVisibleColumns = [
    'quoteNumber',
    'title',
    'status',
    'grandTotal',
    'contactName',
    'companyName',
    'createdAt',
  ];

  /** Core column definitions for Quote entity. */
  private readonly coreColumnDefs: ColumnDefinition[] = [
    { fieldId: 'quoteNumber', label: 'Quote #', isCustomField: false, fieldType: 'text', sortable: true, filterable: true },
    { fieldId: 'title', label: 'Title', isCustomField: false, fieldType: 'text', sortable: true, filterable: true },
    { fieldId: 'status', label: 'Status', isCustomField: false, fieldType: 'text', sortable: true, filterable: true },
    { fieldId: 'grandTotal', label: 'Total', isCustomField: false, fieldType: 'number', sortable: true, filterable: true },
    { fieldId: 'contactName', label: 'Contact', isCustomField: false, fieldType: 'text', sortable: true, filterable: true },
    { fieldId: 'companyName', label: 'Company', isCustomField: false, fieldType: 'text', sortable: true, filterable: true },
    { fieldId: 'dealTitle', label: 'Deal', isCustomField: false, fieldType: 'text', sortable: true, filterable: false },
    { fieldId: 'ownerName', label: 'Owner', isCustomField: false, fieldType: 'text', sortable: true, filterable: false },
    { fieldId: 'versionNumber', label: 'Version', isCustomField: false, fieldType: 'number', sortable: true, filterable: false },
    { fieldId: 'issueDate', label: 'Issue Date', isCustomField: false, fieldType: 'date', sortable: true, filterable: true },
    { fieldId: 'createdAt', label: 'Created', isCustomField: false, fieldType: 'date', sortable: true, filterable: true },
  ];

  /**
   * Display data with formatted currency and status badges.
   * Formats grandTotal as currency string (matching product list pattern).
   * Wraps status in HTML with colored badge styling.
   */
  displayData = computed(() => {
    return this.quoteStore.items().map((quote: QuoteListDto) => ({
      ...quote,
      grandTotal: this.currencyFormatter.format(quote.grandTotal),
    }));
  });

  /** Computed: columns for the active view (or defaults). */
  activeViewColumns = computed<ViewColumn[]>(() => {
    const cols = this.viewColumns();
    if (cols.length > 0) return cols;

    // Build default view columns from all column definitions
    return this.columnDefs().map((def, i) => ({
      fieldId: def.fieldId,
      isCustomField: def.isCustomField,
      width: 0,
      sortOrder: i,
      visible: this.defaultVisibleColumns.includes(def.fieldId),
    }));
  });

  ngOnInit(): void {
    // Load custom field definitions and build merged column definitions
    this.customFieldService.getFieldsByEntityType('Quote').subscribe({
      next: (fields) => {
        this.customFieldDefs.set(fields);
        this.buildColumnDefinitions(fields);
      },
      error: () => {
        // If custom fields fail to load, use core columns only
        this.columnDefs.set(this.coreColumnDefs);
      },
    });

    // Load saved views
    this.viewStore.loadViews('Quote');

    // Fetch initial data
    this.quoteStore.loadList();
  }

  /**
   * Merge core column definitions with custom field column definitions.
   */
  private buildColumnDefinitions(customFields: CustomFieldDefinition[]): void {
    const customColumnDefs: ColumnDefinition[] = customFields.map((field) => ({
      fieldId: field.id,
      label: field.label,
      isCustomField: true,
      fieldType: field.fieldType.toLowerCase(),
      sortable: false, // Custom field sorting not supported (JSONB limitation)
      filterable: true,
    }));

    this.columnDefs.set([...this.coreColumnDefs, ...customColumnDefs]);
  }

  /** Handle saved view selection. */
  onViewSelected(view: SavedView): void {
    // Apply view's columns
    if (view.columns && view.columns.length > 0) {
      this.viewColumns.set(view.columns);
    }

    // Apply view's filters
    if (view.filters && view.filters.length > 0) {
      this.quoteStore.setFilters(view.filters);
    }

    // Apply view's sorts
    if (view.sorts && view.sorts.length > 0) {
      const primarySort = view.sorts[0];
      this.quoteStore.setSort(primarySort.fieldId, primarySort.direction);
    }
  }

  /** Handle sort change from dynamic table. */
  onSortChanged(sort: ViewSort): void {
    this.quoteStore.setSort(sort.fieldId, sort.direction);
  }

  /** Handle page change from dynamic table. */
  onPageChanged(event: { page: number; pageSize: number }): void {
    this.quoteStore.setPage(event.page);
  }

  /** Handle filter applied from filter panel. */
  onFilterApplied(filters: ViewFilter[]): void {
    this.quoteStore.setFilters(filters);
  }

  /** Handle individual filter chip removed. */
  onFilterRemoved(filter: ViewFilter): void {
    const currentFilters = this.quoteStore.filters();
    const updated = currentFilters.filter(
      (f) => !(f.fieldId === filter.fieldId && f.operator === filter.operator && f.value === filter.value),
    );
    this.quoteStore.setFilters(updated);
  }

  /** Handle all filters cleared. */
  onFiltersCleared(): void {
    this.quoteStore.setFilters([]);
  }

  /** Handle row click -- navigate to detail page. */
  onRowClicked(row: any): void {
    this.router.navigate(['/quotes', row.id]);
  }

  /** Handle row edit click -- navigate to edit page. */
  onRowEditClicked(row: any): void {
    this.router.navigate(['/quotes', row.id, 'edit']);
  }

  /** Delete a quote with confirmation dialog. */
  onDeleteQuote(quote: any): void {
    const dialogRef = this.dialog.open(ConfirmDeleteDialogComponent, {
      data: { name: quote.title },
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.quoteService.delete(quote.id).subscribe({
          next: () => this.quoteStore.loadList(),
          error: () => {},
        });
      }
    });
  }
}

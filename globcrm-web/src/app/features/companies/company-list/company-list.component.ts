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
import { TranslocoPipe } from '@jsverse/transloco';
import { HasPermissionDirective } from '../../../core/permissions/has-permission.directive';
import { PermissionStore } from '../../../core/permissions/permission.store';
import { CustomFieldService } from '../../../core/custom-fields/custom-field.service';
import { CustomFieldDefinition } from '../../../core/custom-fields/custom-field.models';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmDeleteDialogComponent } from '../../../shared/components/confirm-delete-dialog/confirm-delete-dialog.component';
import { CompanyStore } from '../company.store';
import { CompanyService } from '../company.service';
import { EntityFormDialogComponent } from '../../../shared/components/entity-form-dialog/entity-form-dialog.component';
import { EntityFormDialogResult } from '../../../shared/components/entity-form-dialog/entity-form-dialog.models';

/**
 * Company list page with dynamic table, saved views sidebar, and filter panel.
 * Component-provides ViewStore and CompanyStore for per-page instance isolation.
 */
@Component({
  selector: 'app-company-list',
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
    TranslocoPipe,
  ],
  providers: [ViewStore, CompanyStore],
  templateUrl: './company-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['../../../../styles/_entity-list.scss', './company-list.component.scss'],
})
export class CompanyListComponent implements OnInit {
  readonly companyStore = inject(CompanyStore);
  private readonly viewStore = inject(ViewStore);
  private readonly companyService = inject(CompanyService);
  private readonly customFieldService = inject(CustomFieldService);
  private readonly permissionStore = inject(PermissionStore);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);

  /** All column definitions (core + custom fields). */
  columnDefs = signal<ColumnDefinition[]>([]);

  /** Custom field definitions loaded from API. */
  private customFieldDefs = signal<CustomFieldDefinition[]>([]);

  /** Active view columns (from selected view or defaults). */
  private viewColumns = signal<ViewColumn[]>([]);

  /** Default visible column field IDs. */
  private readonly defaultVisibleColumns = [
    'name',
    'industry',
    'email',
    'city',
    'ownerName',
    'createdAt',
  ];

  /** Core column definitions for Company entity. */
  private readonly coreColumnDefs: ColumnDefinition[] = [
    { fieldId: 'name', label: 'Company Name', isCustomField: false, fieldType: 'text', sortable: true, filterable: true, renderAs: 'avatar' },
    { fieldId: 'industry', label: 'Industry', isCustomField: false, fieldType: 'text', sortable: true, filterable: true },
    { fieldId: 'phone', label: 'Phone', isCustomField: false, fieldType: 'text', sortable: false, filterable: false },
    { fieldId: 'email', label: 'Email', isCustomField: false, fieldType: 'text', sortable: true, filterable: true },
    { fieldId: 'city', label: 'City', isCustomField: false, fieldType: 'text', sortable: true, filterable: true },
    { fieldId: 'country', label: 'Country', isCustomField: false, fieldType: 'text', sortable: true, filterable: true },
    { fieldId: 'ownerName', label: 'Owner', isCustomField: false, fieldType: 'text', sortable: true, filterable: false },
    { fieldId: 'createdAt', label: 'Created', isCustomField: false, fieldType: 'date', sortable: true, filterable: true },
  ];

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
    this.customFieldService.getFieldsByEntityType('Company').subscribe({
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
    this.viewStore.loadViews('Company');

    // Fetch initial data
    this.companyStore.loadPage();
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
      filterable: field.fieldType !== 'formula', // Formula fields are computed, not filterable
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
      this.companyStore.setFilters(view.filters);
    }

    // Apply view's sorts
    if (view.sorts && view.sorts.length > 0) {
      const primarySort = view.sorts[0];
      this.companyStore.setSort(primarySort.fieldId, primarySort.direction);
    }
  }

  /** Handle column visibility toggle from column picker. */
  onColumnsVisibilityChanged(columns: ViewColumn[]): void {
    this.viewColumns.set(columns);
  }

  /** Handle search change from dynamic table. */
  onSearchChanged(search: string): void {
    this.companyStore.setSearch(search);
  }

  /** Handle sort change from dynamic table. */
  onSortChanged(sort: ViewSort): void {
    this.companyStore.setSort(sort.fieldId, sort.direction);
  }

  /** Handle page change from dynamic table. */
  onPageChanged(event: { page: number; pageSize: number }): void {
    this.companyStore.setPage(event.page);
  }

  /** Handle filter applied from filter panel. */
  onFilterApplied(filters: ViewFilter[]): void {
    this.companyStore.setFilters(filters);
  }

  /** Handle individual filter chip removed. */
  onFilterRemoved(filter: ViewFilter): void {
    const currentFilters = this.companyStore.filters();
    const updated = currentFilters.filter(
      (f) => !(f.fieldId === filter.fieldId && f.operator === filter.operator && f.value === filter.value),
    );
    this.companyStore.setFilters(updated);
  }

  /** Handle all filters cleared. */
  onFiltersCleared(): void {
    this.companyStore.setFilters([]);
  }

  /** Handle row edit click -- navigate to edit page. */
  onRowEditClicked(row: any): void {
    this.router.navigate(['/companies', row.id, 'edit']);
  }

  /** Handle custom field created from quick-add in table header. */
  onCustomFieldCreated(field: CustomFieldDefinition): void {
    const updated = [...this.customFieldDefs(), field];
    this.customFieldDefs.set(updated);
    this.buildColumnDefinitions(updated);

    const currentViewCols = this.activeViewColumns().filter(c => c.fieldId !== field.id);
    const maxOrder = currentViewCols.reduce((max, c) => Math.max(max, c.sortOrder), 0);
    this.viewColumns.set([
      ...currentViewCols,
      { fieldId: field.id, isCustomField: true, width: 150, sortOrder: maxOrder + 1, visible: true },
    ]);
  }

  /** Handle row click -- navigate to detail page. */
  onRowClicked(row: any): void {
    this.router.navigate(['/companies', row.id]);
  }

  /** Handle row delete click -- soft delete with confirmation. */
  onRowDeleteClicked(row: any): void {
    const dialogRef = this.dialog.open(ConfirmDeleteDialogComponent, {
      data: { name: row.name },
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.companyService.delete(row.id).subscribe({
          next: () => this.companyStore.loadPage(),
          error: () => {},
        });
      }
    });
  }

  /** Open create dialog instead of navigating to /companies/new. */
  openCreateDialog(): void {
    const dialogRef = this.dialog.open(EntityFormDialogComponent, {
      data: { entityType: 'Company' },
      width: '800px',
      maxHeight: '90vh',
    });
    dialogRef.afterClosed().subscribe((result?: EntityFormDialogResult) => {
      if (!result) return;
      if (result.action === 'view') {
        this.router.navigate(['/companies', result.entity.id]);
      } else {
        this.companyStore.loadPage();
      }
    });
  }
}

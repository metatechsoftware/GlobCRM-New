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
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
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
import { RequestStore } from '../request.store';
import { RequestService } from '../request.service';

/**
 * Request list page with dynamic table, saved views sidebar, and filter panel.
 * Component-provides ViewStore and RequestStore for per-page instance isolation.
 */
@Component({
  selector: 'app-request-list',
  standalone: true,
  imports: [
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    DynamicTableComponent,
    FilterPanelComponent,
    FilterChipsComponent,
    ViewSidebarComponent,
    HasPermissionDirective,
  ],
  providers: [ViewStore, RequestStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    @use '../../../../styles/entity-list';

    .header-actions {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    @media (max-width: 768px) {
      .header-actions {
        flex-wrap: wrap;
        gap: 8px;
      }
    }
  `,
  template: `
    <div class="entity-list-layout">
      <app-view-sidebar
        [entityType]="'Request'"
        (viewSelected)="onViewSelected($event)" />
      <div class="entity-list-content">
        <div class="list-header">
          <h1>Requests</h1>

          <div class="header-actions">
            <button mat-raised-button color="primary"
                    *appHasPermission="'Request:Create'"
                    routerLink="new">
              <mat-icon>add</mat-icon> New Request
            </button>
          </div>
        </div>

        <app-filter-chips
          [filters]="requestStore.filters()"
          [columnDefinitions]="columnDefs()"
          (filterRemoved)="onFilterRemoved($event)"
          (filtersCleared)="onFiltersCleared()" />

        <app-filter-panel
          [columnDefinitions]="columnDefs()"
          [activeFilters]="requestStore.filters()"
          (filtersChanged)="onFilterApplied($event)" />

        <app-dynamic-table
          entityType="Request"
          [data]="requestStore.items()"
          [columns]="activeViewColumns()"
          [columnDefinitions]="columnDefs()"
          [totalCount]="requestStore.totalCount()"
          [pageSize]="requestStore.pageSize()"
          [loading]="requestStore.isLoading()"
          (sortChanged)="onSortChanged($event)"
          (pageChanged)="onPageChanged($event)"
          (rowClicked)="onRowClicked($event)"
          (rowEditClicked)="onRowEditClicked($event)"
          (searchChanged)="onSearchChanged($event)"
          (customFieldCreated)="onCustomFieldCreated($event)" />
      </div>
    </div>
  `,
})
export class RequestListComponent implements OnInit {
  readonly requestStore = inject(RequestStore);
  private readonly viewStore = inject(ViewStore);
  private readonly requestService = inject(RequestService);
  private readonly customFieldService = inject(CustomFieldService);
  private readonly permissionStore = inject(PermissionStore);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  /** All column definitions (core + custom fields). */
  columnDefs = signal<ColumnDefinition[]>([]);

  /** Custom field definitions loaded from API. */
  private customFieldDefs = signal<CustomFieldDefinition[]>([]);

  /** Active view columns (from selected view or defaults). */
  private viewColumns = signal<ViewColumn[]>([]);

  /** Default visible column field IDs. */
  private readonly defaultVisibleColumns = [
    'subject',
    'status',
    'priority',
    'category',
    'assignedToName',
    'createdAt',
  ];

  /** Core column definitions for Request entity. */
  private readonly coreColumnDefs: ColumnDefinition[] = [
    { fieldId: 'subject', label: 'Subject', isCustomField: false, fieldType: 'text', sortable: true, filterable: true },
    { fieldId: 'status', label: 'Status', isCustomField: false, fieldType: 'text', sortable: true, filterable: true },
    { fieldId: 'priority', label: 'Priority', isCustomField: false, fieldType: 'text', sortable: true, filterable: true },
    { fieldId: 'category', label: 'Category', isCustomField: false, fieldType: 'text', sortable: true, filterable: true },
    { fieldId: 'contactName', label: 'Contact', isCustomField: false, fieldType: 'text', sortable: true, filterable: false },
    { fieldId: 'companyName', label: 'Company', isCustomField: false, fieldType: 'text', sortable: true, filterable: false },
    { fieldId: 'ownerName', label: 'Owner', isCustomField: false, fieldType: 'text', sortable: true, filterable: false },
    { fieldId: 'assignedToName', label: 'Assigned To', isCustomField: false, fieldType: 'text', sortable: true, filterable: false },
    { fieldId: 'createdAt', label: 'Created', isCustomField: false, fieldType: 'date', sortable: true, filterable: true },
    { fieldId: 'resolvedAt', label: 'Resolved', isCustomField: false, fieldType: 'date', sortable: true, filterable: true },
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
    this.customFieldService.getFieldsByEntityType('Request').subscribe({
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
    this.viewStore.loadViews('Request');

    // Fetch initial data
    this.requestStore.loadList();
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
      sortable: false,
      filterable: true,
    }));

    this.columnDefs.set([...this.coreColumnDefs, ...customColumnDefs]);
  }

  /** Handle saved view selection. */
  onViewSelected(view: SavedView): void {
    if (view.columns && view.columns.length > 0) {
      this.viewColumns.set(view.columns);
    }
    if (view.filters && view.filters.length > 0) {
      this.requestStore.setFilters(view.filters);
    }
    if (view.sorts && view.sorts.length > 0) {
      const primarySort = view.sorts[0];
      this.requestStore.setSort(primarySort.fieldId, primarySort.direction);
    }
  }

  /** Handle search change from dynamic table. */
  onSearchChanged(search: string): void {
    this.requestStore.setSearch(search);
  }

  /** Handle sort change from dynamic table. */
  onSortChanged(sort: ViewSort): void {
    this.requestStore.setSort(sort.fieldId, sort.direction);
  }

  /** Handle page change from dynamic table. */
  onPageChanged(event: { page: number; pageSize: number }): void {
    this.requestStore.setPage(event.page);
  }

  /** Handle filter applied from filter panel. */
  onFilterApplied(filters: ViewFilter[]): void {
    this.requestStore.setFilters(filters);
  }

  /** Handle individual filter chip removed. */
  onFilterRemoved(filter: ViewFilter): void {
    const currentFilters = this.requestStore.filters();
    const updated = currentFilters.filter(
      (f) => !(f.fieldId === filter.fieldId && f.operator === filter.operator && f.value === filter.value),
    );
    this.requestStore.setFilters(updated);
  }

  /** Handle all filters cleared. */
  onFiltersCleared(): void {
    this.requestStore.setFilters([]);
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
    this.router.navigate(['/requests', row.id]);
  }

  /** Handle row edit click -- navigate to edit page. */
  onRowEditClicked(row: any): void {
    this.router.navigate(['/requests', row.id, 'edit']);
  }

  /** Delete a request with confirmation dialog. */
  onDeleteRequest(request: any): void {
    const dialogRef = this.dialog.open(ConfirmDeleteDialogComponent, {
      data: { name: request.subject },
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.requestService.delete(request.id).subscribe({
          next: () => this.requestStore.loadList(),
          error: () => {},
        });
      }
    });
  }
}

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
import { MatButtonToggleModule } from '@angular/material/button-toggle';
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
import { TranslocoPipe } from '@jsverse/transloco';
import { HasPermissionDirective } from '../../../core/permissions/has-permission.directive';
import { PermissionStore } from '../../../core/permissions/permission.store';
import { CustomFieldService } from '../../../core/custom-fields/custom-field.service';
import { CustomFieldDefinition } from '../../../core/custom-fields/custom-field.models';
import { ConfirmDeleteDialogComponent } from '../../../shared/components/confirm-delete-dialog/confirm-delete-dialog.component';
import { LeadStore } from '../lead.store';
import { LeadService } from '../lead.service';
import { EntityFormDialogComponent } from '../../../shared/components/entity-form-dialog/entity-form-dialog.component';
import { EntityFormDialogResult } from '../../../shared/components/entity-form-dialog/entity-form-dialog.models';

/**
 * Lead list page with dynamic table, saved views sidebar, filter panel,
 * and view mode switcher (Table / Kanban).
 * Component-provides ViewStore and LeadStore for per-page instance isolation.
 */
@Component({
  selector: 'app-lead-list',
  standalone: true,
  imports: [
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatButtonToggleModule,
    DynamicTableComponent,
    FilterPanelComponent,
    FilterChipsComponent,
    ViewSidebarComponent,
    HasPermissionDirective,
    TranslocoPipe,
  ],
  providers: [ViewStore, LeadStore],
  templateUrl: './lead-list.component.html',
  styleUrls: ['../../../../styles/_entity-list.scss', './lead-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeadListComponent implements OnInit {
  readonly leadStore = inject(LeadStore);
  private readonly viewStore = inject(ViewStore);
  private readonly leadService = inject(LeadService);
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
    'fullName',
    'email',
    'companyName',
    'stageName',
    'sourceName',
    'temperature',
    'ownerName',
    'createdAt',
  ];

  /** Core column definitions for Lead entity. */
  private readonly coreColumnDefs: ColumnDefinition[] = [
    { fieldId: 'fullName', label: 'Name', labelKey: 'leads.columns.fullName', isCustomField: false, fieldType: 'text', sortable: true, filterable: true, renderAs: 'avatar' },
    { fieldId: 'email', label: 'Email', labelKey: 'leads.columns.email', isCustomField: false, fieldType: 'text', sortable: true, filterable: true, renderAs: 'email' },
    { fieldId: 'phone', label: 'Phone', labelKey: 'leads.columns.phone', isCustomField: false, fieldType: 'text', sortable: false, filterable: false },
    { fieldId: 'companyName', label: 'Company', labelKey: 'leads.columns.companyName', isCustomField: false, fieldType: 'text', sortable: true, filterable: true },
    { fieldId: 'stageName', label: 'Stage', labelKey: 'leads.columns.stageName', isCustomField: false, fieldType: 'text', sortable: true, filterable: true, renderAs: 'badge' },
    { fieldId: 'sourceName', label: 'Source', labelKey: 'leads.columns.sourceName', isCustomField: false, fieldType: 'text', sortable: true, filterable: true },
    { fieldId: 'temperature', label: 'Temperature', labelKey: 'leads.columns.temperature', isCustomField: false, fieldType: 'text', sortable: true, filterable: true, renderAs: 'badge' },
    { fieldId: 'ownerName', label: 'Owner', labelKey: 'leads.columns.ownerName', isCustomField: false, fieldType: 'text', sortable: true, filterable: false },
    { fieldId: 'isConverted', label: 'Converted', labelKey: 'leads.columns.isConverted', isCustomField: false, fieldType: 'boolean', sortable: true, filterable: true },
    { fieldId: 'createdAt', label: 'Created', labelKey: 'leads.columns.createdAt', isCustomField: false, fieldType: 'date', sortable: true, filterable: true },
    { fieldId: 'updatedAt', label: 'Updated', labelKey: 'leads.columns.updatedAt', isCustomField: false, fieldType: 'date', sortable: true, filterable: true },
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
    this.customFieldService.getFieldsByEntityType('Lead').subscribe({
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
    this.viewStore.loadViews('Lead');

    // Load reference data for filters
    this.leadStore.loadStages();
    this.leadStore.loadSources();

    // Fetch initial data
    this.leadStore.loadPage();
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
      filterable: field.fieldType !== 'formula', // Formula fields are computed, not filterable
    }));

    this.columnDefs.set([...this.coreColumnDefs, ...customColumnDefs]);
  }

  /** Handle saved view selection. */
  onViewSelected(view: SavedView): void {
    if (view.columns && view.columns.length > 0) {
      this.viewColumns.set(view.columns);
    }

    if (view.filters && view.filters.length > 0) {
      this.leadStore.setFilters(view.filters);
    }

    if (view.sorts && view.sorts.length > 0) {
      const primarySort = view.sorts[0];
      this.leadStore.setSort(primarySort.fieldId, primarySort.direction);
    }
  }

  /** Handle column visibility toggle from column picker. */
  onColumnsVisibilityChanged(columns: ViewColumn[]): void {
    this.viewColumns.set(columns);
  }

  /** Handle search change from dynamic table. */
  onSearchChanged(search: string): void {
    this.leadStore.setSearch(search);
  }

  /** Handle sort change from dynamic table. */
  onSortChanged(sort: ViewSort): void {
    this.leadStore.setSort(sort.fieldId, sort.direction);
  }

  /** Handle page change from dynamic table. */
  onPageChanged(event: { page: number; pageSize: number }): void {
    this.leadStore.setPage(event.page);
  }

  /** Handle filter applied from filter panel. */
  onFilterApplied(filters: ViewFilter[]): void {
    this.leadStore.setFilters(filters);
  }

  /** Handle individual filter chip removed. */
  onFilterRemoved(filter: ViewFilter): void {
    const currentFilters = this.leadStore.filters();
    const updated = currentFilters.filter(
      (f) => !(f.fieldId === filter.fieldId && f.operator === filter.operator && f.value === filter.value),
    );
    this.leadStore.setFilters(updated);
  }

  /** Handle all filters cleared. */
  onFiltersCleared(): void {
    this.leadStore.setFilters([]);
  }

  /** Handle row edit click -- navigate to edit page. */
  onRowEditClicked(row: any): void {
    this.router.navigate(['/leads', row.id, 'edit']);
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
    this.router.navigate(['/leads', row.id]);
  }

  /** Open create dialog instead of navigating to /leads/new. */
  openCreateDialog(): void {
    const dialogRef = this.dialog.open(EntityFormDialogComponent, {
      data: { entityType: 'Lead' },
      width: '800px',
      maxHeight: '90vh',
    });
    dialogRef.afterClosed().subscribe((result?: EntityFormDialogResult) => {
      if (!result) return;
      if (result.action === 'view') {
        this.router.navigate(['/leads', result.entity.id]);
      } else {
        this.leadStore.loadPage();
      }
    });
  }

  /** Delete a lead with confirmation dialog. */
  onDeleteLead(lead: any): void {
    const dialogRef = this.dialog.open(ConfirmDeleteDialogComponent, {
      data: { name: lead.fullName },
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.leadService.delete(lead.id).subscribe({
          next: () => this.leadStore.loadPage(),
          error: () => {},
        });
      }
    });
  }
}

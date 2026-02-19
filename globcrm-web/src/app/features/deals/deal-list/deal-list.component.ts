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
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
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
import { HasPermissionDirective } from '../../../core/permissions/has-permission.directive';
import { PermissionStore } from '../../../core/permissions/permission.store';
import { CustomFieldService } from '../../../core/custom-fields/custom-field.service';
import { CustomFieldDefinition } from '../../../core/custom-fields/custom-field.models';
import { ConfirmDeleteDialogComponent } from '../../../shared/components/confirm-delete-dialog/confirm-delete-dialog.component';
import { PipelineService } from '../pipeline.service';
import { DealStore } from '../deal.store';
import { DealService } from '../deal.service';
import { PipelineDto } from '../deal.models';
import { EntityFormDialogComponent } from '../../../shared/components/entity-form-dialog/entity-form-dialog.component';
import { EntityFormDialogResult } from '../../../shared/components/entity-form-dialog/entity-form-dialog.models';

/**
 * Deal list page with dynamic table, pipeline filter, saved views sidebar,
 * and view mode switcher (List / Kanban / Calendar).
 * Component-provides ViewStore and DealStore for per-page instance isolation.
 */
@Component({
  selector: 'app-deal-list',
  standalone: true,
  imports: [
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatFormFieldModule,
    MatButtonToggleModule,
    DynamicTableComponent,
    FilterPanelComponent,
    FilterChipsComponent,
    ViewSidebarComponent,
    HasPermissionDirective,
  ],
  providers: [ViewStore, DealStore],
  templateUrl: './deal-list.component.html',
  styleUrls: ['../../../../styles/_entity-list.scss', './deal-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DealListComponent implements OnInit {
  readonly dealStore = inject(DealStore);
  private readonly viewStore = inject(ViewStore);
  private readonly pipelineService = inject(PipelineService);
  private readonly dealService = inject(DealService);
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

  /** Available pipelines for the filter dropdown. */
  pipelines = signal<PipelineDto[]>([]);

  /** Currently selected pipeline ID (null = All Pipelines). */
  selectedPipelineId = signal<string | null>(null);

  /** Default visible column field IDs. */
  private readonly defaultVisibleColumns = [
    'title',
    'value',
    'probability',
    'expectedCloseDate',
    'stageName',
    'companyName',
    'ownerName',
  ];

  /** Core column definitions for Deal entity. */
  private readonly coreColumnDefs: ColumnDefinition[] = [
    { fieldId: 'title', label: 'Title', isCustomField: false, fieldType: 'text', sortable: true, filterable: true },
    { fieldId: 'value', label: 'Value', isCustomField: false, fieldType: 'number', sortable: true, filterable: true },
    { fieldId: 'probability', label: 'Probability', isCustomField: false, fieldType: 'number', sortable: true, filterable: true },
    { fieldId: 'expectedCloseDate', label: 'Close Date', isCustomField: false, fieldType: 'date', sortable: true, filterable: true },
    { fieldId: 'stageName', label: 'Stage', isCustomField: false, fieldType: 'text', sortable: true, filterable: true, renderAs: 'badge' },
    { fieldId: 'pipelineName', label: 'Pipeline', isCustomField: false, fieldType: 'text', sortable: true, filterable: false },
    { fieldId: 'companyName', label: 'Company', isCustomField: false, fieldType: 'text', sortable: true, filterable: true },
    { fieldId: 'ownerName', label: 'Owner', isCustomField: false, fieldType: 'text', sortable: true, filterable: false },
    { fieldId: 'createdAt', label: 'Created', isCustomField: false, fieldType: 'date', sortable: true, filterable: true },
    { fieldId: 'updatedAt', label: 'Updated', isCustomField: false, fieldType: 'date', sortable: true, filterable: true },
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
    // Load pipelines for filter dropdown
    this.pipelineService.getAll().subscribe({
      next: (pipelines) => this.pipelines.set(pipelines),
      error: () => {}, // Silently fail -- pipeline filter just won't populate
    });

    // Load custom field definitions and build merged column definitions
    this.customFieldService.getFieldsByEntityType('Deal').subscribe({
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
    this.viewStore.loadViews('Deal');

    // Fetch initial data
    this.dealStore.loadPage();
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

  /** Handle pipeline filter selection. */
  onPipelineChanged(pipelineId: string | null): void {
    this.selectedPipelineId.set(pipelineId);
    this.dealStore.setPipelineId(pipelineId);
  }

  /** Handle saved view selection. */
  onViewSelected(view: SavedView): void {
    // Apply view's columns
    if (view.columns && view.columns.length > 0) {
      this.viewColumns.set(view.columns);
    }

    // Apply view's filters
    if (view.filters && view.filters.length > 0) {
      this.dealStore.setFilters(view.filters);
    }

    // Apply view's sorts
    if (view.sorts && view.sorts.length > 0) {
      const primarySort = view.sorts[0];
      this.dealStore.setSort(primarySort.fieldId, primarySort.direction);
    }
  }

  /** Handle column visibility toggle from column picker. */
  onColumnsVisibilityChanged(columns: ViewColumn[]): void {
    this.viewColumns.set(columns);
  }

  /** Handle search change from dynamic table. */
  onSearchChanged(search: string): void {
    this.dealStore.setSearch(search);
  }

  /** Handle sort change from dynamic table. */
  onSortChanged(sort: ViewSort): void {
    this.dealStore.setSort(sort.fieldId, sort.direction);
  }

  /** Handle page change from dynamic table. */
  onPageChanged(event: { page: number; pageSize: number }): void {
    this.dealStore.setPage(event.page);
  }

  /** Handle filter applied from filter panel. */
  onFilterApplied(filters: ViewFilter[]): void {
    this.dealStore.setFilters(filters);
  }

  /** Handle individual filter chip removed. */
  onFilterRemoved(filter: ViewFilter): void {
    const currentFilters = this.dealStore.filters();
    const updated = currentFilters.filter(
      (f) => !(f.fieldId === filter.fieldId && f.operator === filter.operator && f.value === filter.value),
    );
    this.dealStore.setFilters(updated);
  }

  /** Handle all filters cleared. */
  onFiltersCleared(): void {
    this.dealStore.setFilters([]);
  }

  /** Handle row edit click -- navigate to edit page. */
  onRowEditClicked(row: any): void {
    this.router.navigate(['/deals', row.id, 'edit']);
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
    this.router.navigate(['/deals', row.id]);
  }

  /** Open create dialog instead of navigating to /deals/new. */
  openCreateDialog(): void {
    const dialogRef = this.dialog.open(EntityFormDialogComponent, {
      data: { entityType: 'Deal' },
      width: '800px',
      maxHeight: '90vh',
    });
    dialogRef.afterClosed().subscribe((result?: EntityFormDialogResult) => {
      if (!result) return;
      if (result.action === 'view') {
        this.router.navigate(['/deals', result.entity.id]);
      } else {
        this.dealStore.loadPage();
      }
    });
  }

  /** Delete a deal with confirmation dialog. */
  onDeleteDeal(deal: any): void {
    const dialogRef = this.dialog.open(ConfirmDeleteDialogComponent, {
      data: { name: deal.title },
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.dealService.delete(deal.id).subscribe({
          next: () => this.dealStore.loadPage(),
          error: () => {},
        });
      }
    });
  }
}

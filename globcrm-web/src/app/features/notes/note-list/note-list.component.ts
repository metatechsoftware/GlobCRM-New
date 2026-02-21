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
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { HasPermissionDirective } from '../../../core/permissions/has-permission.directive';
import { PermissionStore } from '../../../core/permissions/permission.store';
import { CustomFieldService } from '../../../core/custom-fields/custom-field.service';
import { CustomFieldDefinition } from '../../../core/custom-fields/custom-field.models';
import { NoteStore } from '../note.store';
import { NoteListDto } from '../note.models';

/**
 * Note list page with dynamic table, saved views sidebar, and filter panel.
 * Component-provides ViewStore and NoteStore for per-page instance isolation.
 *
 * Displays notes with Title, Entity Type, Entity Name, Author, PlainTextBody preview, Created At columns.
 * PlainTextBody shows truncated preview (first 100 chars).
 */
@Component({
  selector: 'app-note-list',
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
  providers: [ViewStore, NoteStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    @use '../../../../styles/entity-list';
  `,
  template: `
    <div class="entity-list-layout">
      <app-view-sidebar
        [entityType]="'Note'"
        (viewSelected)="onViewSelected($event)" />
      <div class="entity-list-content">
        <div class="list-header">
          <h1>{{ 'list.title' | transloco }}</h1>

          <div class="list-header-actions">
            <button mat-raised-button color="primary"
                    *appHasPermission="'Note:Create'"
                    routerLink="new">
              <mat-icon>add</mat-icon> {{ 'list.newNote' | transloco }}
            </button>
          </div>
        </div>

        <app-filter-chips
          [filters]="noteStore.filters()"
          [columnDefinitions]="columnDefs()"
          (filterRemoved)="onFilterRemoved($event)"
          (filtersCleared)="onFiltersCleared()" />

        <app-filter-panel
          [columnDefinitions]="columnDefs()"
          [activeFilters]="noteStore.filters()"
          (filtersChanged)="onFilterApplied($event)" />

        <app-dynamic-table
          entityType="Note"
          [data]="displayData()"
          [columns]="activeViewColumns()"
          [columnDefinitions]="columnDefs()"
          [totalCount]="noteStore.totalCount()"
          [pageSize]="noteStore.pageSize()"
          [loading]="noteStore.isLoading()"
          (sortChanged)="onSortChanged($event)"
          (pageChanged)="onPageChanged($event)"
          (rowEditClicked)="onRowClicked($event)"
          (searchChanged)="onSearchChanged($event)" />
      </div>
    </div>
  `,
})
export class NoteListComponent implements OnInit {
  readonly noteStore = inject(NoteStore);
  private readonly viewStore = inject(ViewStore);
  private readonly customFieldService = inject(CustomFieldService);
  private readonly permissionStore = inject(PermissionStore);
  private readonly router = inject(Router);
  private readonly translocoService = inject(TranslocoService);

  /** All column definitions (core + custom fields). */
  columnDefs = signal<ColumnDefinition[]>([]);

  /** Custom field definitions loaded from API. */
  private customFieldDefs = signal<CustomFieldDefinition[]>([]);

  /** Active view columns (from selected view or defaults). */
  private viewColumns = signal<ViewColumn[]>([]);

  /** Default visible column field IDs. */
  private readonly defaultVisibleColumns = [
    'title',
    'entityType',
    'entityName',
    'authorName',
    'plainTextBody',
    'createdAt',
  ];

  /** Core column definitions for Note entity (labels resolved via transloco). */
  private get coreColumnDefs(): ColumnDefinition[] {
    const t = (key: string) => this.translocoService.translate(`notes.list.columns.${key}`);
    return [
      { fieldId: 'title', label: t('title'), isCustomField: false, fieldType: 'text', sortable: true, filterable: true },
      { fieldId: 'entityType', label: t('entityType'), isCustomField: false, fieldType: 'text', sortable: true, filterable: true },
      { fieldId: 'entityName', label: t('entityName'), isCustomField: false, fieldType: 'text', sortable: true, filterable: true },
      { fieldId: 'authorName', label: t('author'), isCustomField: false, fieldType: 'text', sortable: true, filterable: false },
      { fieldId: 'plainTextBody', label: t('preview'), isCustomField: false, fieldType: 'text', sortable: false, filterable: false },
      { fieldId: 'createdAt', label: t('created'), isCustomField: false, fieldType: 'date', sortable: true, filterable: true },
      { fieldId: 'updatedAt', label: t('updated'), isCustomField: false, fieldType: 'date', sortable: true, filterable: true },
    ];
  }

  /**
   * Display data with truncated plainTextBody preview (first 100 chars).
   */
  displayData = computed(() => {
    return this.noteStore.items().map((note: NoteListDto) => ({
      ...note,
      plainTextBody: note.plainTextBody
        ? note.plainTextBody.length > 100
          ? note.plainTextBody.substring(0, 100) + '...'
          : note.plainTextBody
        : '',
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
    this.customFieldService.getFieldsByEntityType('Note').subscribe({
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
    this.viewStore.loadViews('Note');

    // Fetch initial data
    this.noteStore.loadList();
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
      this.noteStore.setFilters(view.filters);
    }

    // Apply view's sorts
    if (view.sorts && view.sorts.length > 0) {
      const primarySort = view.sorts[0];
      this.noteStore.setSort(primarySort.fieldId, primarySort.direction);
    }
  }

  /** Handle search change from dynamic table. */
  onSearchChanged(search: string): void {
    this.noteStore.setSearch(search);
  }

  /** Handle sort change from dynamic table. */
  onSortChanged(sort: ViewSort): void {
    this.noteStore.setSort(sort.fieldId, sort.direction);
  }

  /** Handle page change from dynamic table. */
  onPageChanged(event: { page: number; pageSize: number }): void {
    this.noteStore.setPage(event.page);
  }

  /** Handle filter applied from filter panel. */
  onFilterApplied(filters: ViewFilter[]): void {
    this.noteStore.setFilters(filters);
  }

  /** Handle individual filter chip removed. */
  onFilterRemoved(filter: ViewFilter): void {
    const currentFilters = this.noteStore.filters();
    const updated = currentFilters.filter(
      (f) => !(f.fieldId === filter.fieldId && f.operator === filter.operator && f.value === filter.value),
    );
    this.noteStore.setFilters(updated);
  }

  /** Handle all filters cleared. */
  onFiltersCleared(): void {
    this.noteStore.setFilters([]);
  }

  /** Handle row click -- navigate to detail page. */
  onRowClicked(row: any): void {
    this.router.navigate(['/notes', row.id]);
  }
}

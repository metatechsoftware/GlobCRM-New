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
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
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
import { ContactStore } from '../contact.store';
import { ContactService } from '../contact.service';
import { EntityFormDialogComponent } from '../../../shared/components/entity-form-dialog/entity-form-dialog.component';
import { EntityFormDialogResult } from '../../../shared/components/entity-form-dialog/entity-form-dialog.models';
import { SequenceService } from '../../sequences/sequence.service';
import { SequenceListItem } from '../../sequences/sequence.models';

/**
 * Contact list page with dynamic table, saved views sidebar, and filter panel.
 * Component-provides ViewStore and ContactStore for per-page instance isolation.
 */
@Component({
  selector: 'app-contact-list',
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
  providers: [ViewStore, ContactStore],
  templateUrl: './contact-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['../../../../styles/_entity-list.scss', './contact-list.component.scss'],
})
export class ContactListComponent implements OnInit {
  readonly contactStore = inject(ContactStore);
  private readonly viewStore = inject(ViewStore);
  private readonly contactService = inject(ContactService);
  private readonly customFieldService = inject(CustomFieldService);
  private readonly sequenceService = inject(SequenceService);
  private readonly permissionStore = inject(PermissionStore);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  /** Selected contacts for bulk actions. */
  selectedContacts = signal<any[]>([]);

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
    'phone',
    'jobTitle',
    'companyName',
    'createdAt',
  ];

  /** Core column definitions for Contact entity. */
  private readonly coreColumnDefs: ColumnDefinition[] = [
    { fieldId: 'fullName', label: 'Name', isCustomField: false, fieldType: 'text', sortable: true, filterable: true },
    { fieldId: 'firstName', label: 'First Name', isCustomField: false, fieldType: 'text', sortable: true, filterable: true },
    { fieldId: 'lastName', label: 'Last Name', isCustomField: false, fieldType: 'text', sortable: true, filterable: true },
    { fieldId: 'email', label: 'Email', isCustomField: false, fieldType: 'text', sortable: true, filterable: true, renderAs: 'email' },
    { fieldId: 'phone', label: 'Phone', isCustomField: false, fieldType: 'text', sortable: false, filterable: false },
    { fieldId: 'jobTitle', label: 'Job Title', isCustomField: false, fieldType: 'text', sortable: true, filterable: true },
    { fieldId: 'companyName', label: 'Company', isCustomField: false, fieldType: 'text', sortable: true, filterable: true },
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
    this.customFieldService.getFieldsByEntityType('Contact').subscribe({
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
    this.viewStore.loadViews('Contact');

    // Fetch initial data
    this.contactStore.loadPage();
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
      this.contactStore.setFilters(view.filters);
    }

    // Apply view's sorts
    if (view.sorts && view.sorts.length > 0) {
      const primarySort = view.sorts[0];
      this.contactStore.setSort(primarySort.fieldId, primarySort.direction);
    }
  }

  /** Handle column visibility toggle from column picker. */
  onColumnsVisibilityChanged(columns: ViewColumn[]): void {
    this.viewColumns.set(columns);
  }

  /** Handle search change from dynamic table. */
  onSearchChanged(search: string): void {
    this.contactStore.setSearch(search);
  }

  /** Handle sort change from dynamic table. */
  onSortChanged(sort: ViewSort): void {
    this.contactStore.setSort(sort.fieldId, sort.direction);
  }

  /** Handle page change from dynamic table. */
  onPageChanged(event: { page: number; pageSize: number }): void {
    this.contactStore.setPage(event.page);
  }

  /** Handle filter applied from filter panel. */
  onFilterApplied(filters: ViewFilter[]): void {
    this.contactStore.setFilters(filters);
  }

  /** Handle individual filter chip removed. */
  onFilterRemoved(filter: ViewFilter): void {
    const currentFilters = this.contactStore.filters();
    const updated = currentFilters.filter(
      (f) => !(f.fieldId === filter.fieldId && f.operator === filter.operator && f.value === filter.value),
    );
    this.contactStore.setFilters(updated);
  }

  /** Handle all filters cleared. */
  onFiltersCleared(): void {
    this.contactStore.setFilters([]);
  }

  /** Handle row edit click -- navigate to edit page. */
  onRowEditClicked(row: any): void {
    this.router.navigate(['/contacts', row.id, 'edit']);
  }

  /** Handle custom field created from quick-add in table header. */
  onCustomFieldCreated(field: CustomFieldDefinition): void {
    // 1. Update custom field definitions and rebuild column defs
    const updated = [...this.customFieldDefs(), field];
    this.customFieldDefs.set(updated);
    this.buildColumnDefinitions(updated);

    // 2. Snapshot current view columns, filter out any default entry for this field
    const currentViewCols = this.activeViewColumns().filter(c => c.fieldId !== field.id);
    const maxOrder = currentViewCols.reduce((max, c) => Math.max(max, c.sortOrder), 0);

    // 3. Append new column as visible
    this.viewColumns.set([
      ...currentViewCols,
      { fieldId: field.id, isCustomField: true, width: 150, sortOrder: maxOrder + 1, visible: true },
    ]);
  }

  /** Handle row click -- navigate to detail page. */
  onRowClicked(row: any): void {
    this.router.navigate(['/contacts', row.id]);
  }

  /** Handle row delete click -- soft delete with confirmation. */
  onRowDeleteClicked(row: any): void {
    const dialogRef = this.dialog.open(ConfirmDeleteDialogComponent, {
      data: { name: row.fullName },
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.contactService.delete(row.id).subscribe({
          next: () => this.contactStore.loadPage(),
          error: () => {},
        });
      }
    });
  }

  /** Open create dialog instead of navigating to /contacts/new. */
  openCreateDialog(): void {
    const dialogRef = this.dialog.open(EntityFormDialogComponent, {
      data: { entityType: 'Contact' },
      width: '800px',
      maxHeight: '90vh',
    });
    dialogRef.afterClosed().subscribe((result?: EntityFormDialogResult) => {
      if (!result) return;
      if (result.action === 'view') {
        this.router.navigate(['/contacts', result.entity.id]);
      } else {
        this.contactStore.loadPage();
      }
    });
  }

  /** Handle selection changes from dynamic table. */
  onSelectionChanged(selected: any[]): void {
    this.selectedContacts.set(selected);
  }

  /** Clear current selection (called from bulk action bar). */
  clearSelection(): void {
    this.selectedContacts.set([]);
  }

  /** Open sequence picker then bulk enroll selected contacts. */
  bulkEnrollInSequence(): void {
    const contacts = this.selectedContacts();
    if (contacts.length === 0) return;

    // Lazy import sequence picker dialog to avoid eagerly loading the sequence module
    import('../../sequences/sequence-picker-dialog/sequence-picker-dialog.component').then(
      ({ SequencePickerDialogComponent }) => {
        const dialogRef = this.dialog.open(SequencePickerDialogComponent, {
          width: '500px',
          maxHeight: '80vh',
        });

        dialogRef.afterClosed().subscribe((selectedSequence: SequenceListItem | undefined) => {
          if (!selectedSequence) return;

          const contactIds = contacts.map((c: any) => c.id);
          this.sequenceService
            .bulkEnroll(selectedSequence.id, { contactIds })
            .subscribe({
              next: (result) => {
                const msg =
                  result.skipped > 0
                    ? `Enrolled ${result.enrolled} contacts in ${selectedSequence.name}, ${result.skipped} skipped (already enrolled).`
                    : `Enrolled ${result.enrolled} contacts in ${selectedSequence.name}.`;
                this.snackBar.open(msg, 'Close', { duration: 5000 });
                this.selectedContacts.set([]);
              },
              error: (err) => {
                this.snackBar.open(
                  err?.message ?? 'Failed to enroll contacts.',
                  'Close',
                  { duration: 5000 },
                );
              },
            });
        });
      },
    );
  }
}

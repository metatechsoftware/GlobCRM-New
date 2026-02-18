import {
  Component,
  ChangeDetectionStrategy,
  computed,
  DestroyRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule, MatSort, Sort } from '@angular/material/sort';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import {
  MatPaginatorModule,
  MatPaginator,
  PageEvent,
} from '@angular/material/paginator';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ColumnResizeDirective } from '../../directives/column-resize.directive';
import { ColumnPickerComponent } from './column-picker.component';
import { QuickAddFieldComponent } from './quick-add-field.component';
import { AuthStore } from '../../../core/auth/auth.store';
import { CustomFieldDefinition } from '../../../core/custom-fields/custom-field.models';
import {
  ColumnDefinition,
  ViewColumn,
  ViewSort,
} from '../saved-views/view.models';

/**
 * Reusable dynamic table component with runtime-configurable columns.
 * Supports CDK drag-drop column reorder, column resize, sorting,
 * pagination, and column show/hide via ColumnPicker.
 *
 * Every entity list page (companies, contacts, deals, etc.) uses this
 * component as its primary data display.
 */
@Component({
  selector: 'app-dynamic-table',
  standalone: true,
  imports: [
    MatTableModule,
    MatSortModule,
    MatPaginatorModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule,
    MatProgressBarModule,
    MatTooltipModule,
    ColumnResizeDirective,
    ColumnPickerComponent,
    QuickAddFieldComponent,
  ],
  templateUrl: './dynamic-table.component.html',
  styleUrl: './dynamic-table.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DynamicTableComponent {
  // Required inputs
  entityType = input.required<string>();
  data = input.required<any[]>();
  columns = input.required<ViewColumn[]>();
  columnDefinitions = input.required<ColumnDefinition[]>();
  totalCount = input.required<number>();

  // Optional inputs
  pageSize = input<number>(25);
  loading = input<boolean>(false);

  // Outputs
  columnOrderChanged = output<ViewColumn[]>();
  columnResized = output<{ fieldId: string; width: number }>();
  columnsVisibilityChanged = output<ViewColumn[]>();
  sortChanged = output<ViewSort>();
  pageChanged = output<{ page: number; pageSize: number }>();
  rowEditClicked = output<any>();
  rowViewClicked = output<any>();
  rowDeleteClicked = output<any>();
  searchChanged = output<string>();
  customFieldCreated = output<CustomFieldDefinition>();

  // Admin check for addColumn
  private readonly authStore = inject(AuthStore);
  isAdmin = computed(() => this.authStore.userRole() === 'Admin');

  // View children
  readonly sort = viewChild(MatSort);
  readonly paginator = viewChild(MatPaginator);

  // Search state
  searchValue = signal('');
  private readonly searchSubject = new Subject<string>();
  private readonly destroyRef = inject(DestroyRef);

  // Drag state
  draggedFieldId = signal<string | null>(null);
  private dragColumnOrder = signal<string[] | null>(null);

  constructor() {
    this.searchSubject
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((term) => this.searchChanged.emit(term));
  }

  // Computed: visible columns sorted by sortOrder, plus optional addColumn and actions
  displayedColumns = computed<string[]>(() => {
    const admin = this.isAdmin();
    const dragOrder = this.dragColumnOrder();
    if (dragOrder) {
      return admin ? [...dragOrder, 'addColumn', 'actions'] : [...dragOrder, 'actions'];
    }

    const visible = this.columns()
      .filter((c) => c.visible)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((c) => c.fieldId);
    return admin ? [...visible, 'addColumn', 'actions'] : [...visible, 'actions'];
  });

  // Computed: only visible ViewColumns, sorted
  visibleColumns = computed<ViewColumn[]>(() =>
    this.columns()
      .filter((c) => c.visible)
      .sort((a, b) => a.sortOrder - b.sortOrder),
  );

  /**
   * Get cell value for a row, handling both core fields and custom fields.
   */
  getCellValue(row: any, fieldId: string): any {
    // Check if it's a custom field stored in row.customFields
    if (
      row.customFields &&
      typeof row.customFields === 'object' &&
      fieldId in row.customFields
    ) {
      return row.customFields[fieldId];
    }
    // Direct property access for core fields
    return row[fieldId] ?? '';
  }

  /**
   * Get column label from column definitions.
   */
  getColumnLabel(fieldId: string): string {
    const def = this.columnDefinitions().find((d) => d.fieldId === fieldId);
    return def?.label ?? fieldId;
  }

  /**
   * Get column width in pixels.
   */
  getColumnWidth(fieldId: string): string {
    const col = this.columns().find((c) => c.fieldId === fieldId);
    return col?.width ? `${col.width}px` : 'auto';
  }

  /**
   * Check if a column is sortable.
   */
  isSortable(fieldId: string): boolean {
    const def = this.columnDefinitions().find((d) => d.fieldId === fieldId);
    return def?.sortable ?? false;
  }

  /**
   * Start dragging a column header.
   */
  onDragStart(event: DragEvent, fieldId: string): void {
    this.draggedFieldId.set(fieldId);

    // Initialize mutable column order from current visible columns
    const order = this.columns()
      .filter((c) => c.visible)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((c) => c.fieldId);
    this.dragColumnOrder.set(order);

    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', fieldId);
    }
  }

  /**
   * Column header entered — snap the dragged column to this position.
   */
  onDragEnter(event: DragEvent, targetFieldId: string): void {
    event.preventDefault();
    const draggedId = this.draggedFieldId();
    const order = this.dragColumnOrder();
    if (!draggedId || !order || draggedId === targetFieldId) return;

    const fromIndex = order.indexOf(draggedId);
    const toIndex = order.indexOf(targetFieldId);
    if (fromIndex === -1 || toIndex === -1) return;

    const newOrder = [...order];
    newOrder.splice(fromIndex, 1);
    newOrder.splice(toIndex, 0, draggedId);
    this.dragColumnOrder.set(newOrder);
  }

  /**
   * Allow drop on column headers.
   */
  onDragOver(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  }

  /**
   * Finish drag — emit final column order and clear drag state.
   */
  onDragEnd(): void {
    const order = this.dragColumnOrder();
    if (order) {
      const updated = this.columns().map((col) => {
        const newIndex = order.indexOf(col.fieldId);
        if (newIndex >= 0) {
          return { ...col, sortOrder: newIndex };
        }
        return col;
      });
      this.columnOrderChanged.emit(updated);
    }

    this.draggedFieldId.set(null);
    this.dragColumnOrder.set(null);
  }

  /**
   * Handle column resize from the resize directive.
   */
  onColumnResized(event: { fieldId: string; newWidth: number }): void {
    this.columnResized.emit({
      fieldId: event.fieldId,
      width: event.newWidth,
    });
  }

  /**
   * Handle sort change from mat-sort.
   */
  onSort(sortState: Sort): void {
    if (!sortState.active || sortState.direction === '') return;
    this.sortChanged.emit({
      fieldId: sortState.active,
      direction: sortState.direction as 'asc' | 'desc',
      sortOrder: 0,
    });
  }

  /**
   * Handle page change from mat-paginator.
   */
  onPageChange(event: PageEvent): void {
    this.pageChanged.emit({
      page: event.pageIndex + 1, // 1-based for API
      pageSize: event.pageSize,
    });
  }

  /**
   * Handle search input — push to debounced subject.
   */
  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchValue.set(value);
    this.searchSubject.next(value);
  }

  /**
   * Clear search — emit immediately (no debounce needed for clear).
   */
  onSearchClear(): void {
    this.searchValue.set('');
    this.searchChanged.emit('');
  }

  /**
   * Handle custom field created from quick-add component.
   */
  onCustomFieldCreated(field: CustomFieldDefinition): void {
    this.customFieldCreated.emit(field);
  }
}

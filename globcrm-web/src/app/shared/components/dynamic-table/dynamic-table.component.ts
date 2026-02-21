import {
  Component,
  ChangeDetectionStrategy,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NgClass } from '@angular/common';
import { SelectionModel } from '@angular/cdk/collections';
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
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoService, TranslocoPipe } from '@jsverse/transloco';
import { ColumnResizeDirective } from '../../directives/column-resize.directive';
import { ColumnPickerComponent } from './column-picker.component';
import { QuickAddFieldComponent } from './quick-add-field.component';
import { AuthStore } from '../../../core/auth/auth.store';
import { CustomFieldDefinition, isFormulaError } from '../../../core/custom-fields/custom-field.models';
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
    NgClass,
    MatTableModule,
    MatSortModule,
    MatPaginatorModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule,
    MatCheckboxModule,
    MatProgressBarModule,
    MatTooltipModule,
    TranslocoPipe,
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
  enableSelection = input<boolean>(false);

  // Outputs
  selectionChanged = output<any[]>();
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

  // Locale-aware formatting
  private readonly translocoService = inject(TranslocoService);

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

  // Page tracking for footer summary
  currentPageIndex = signal(0);

  // Drag state
  draggedFieldId = signal<string | null>(null);
  private dragColumnOrder = signal<string[] | null>(null);

  // Selection state (generic row selection via CDK SelectionModel)
  readonly selection = new SelectionModel<any>(true, []);
  readonly selectedCount = signal(0);
  readonly hasSelection = computed(() => this.selectedCount() > 0);

  constructor() {
    this.searchSubject
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((term) => this.searchChanged.emit(term));

    // Clear selection when data changes (new page, new filters)
    effect(() => {
      // Read data signal to track changes
      this.data();
      this.clearSelection();
    });
  }

  // Computed: visible columns sorted by sortOrder, plus optional select, addColumn and actions
  displayedColumns = computed<string[]>(() => {
    const admin = this.isAdmin();
    const selectionEnabled = this.enableSelection();
    const dragOrder = this.dragColumnOrder();

    let cols: string[];
    if (dragOrder) {
      cols = admin ? [...dragOrder, 'addColumn', 'actions'] : [...dragOrder, 'actions'];
    } else {
      const visible = this.columns()
        .filter((c) => c.visible)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((c) => c.fieldId);
      cols = admin ? [...visible, 'addColumn', 'actions'] : [...visible, 'actions'];
    }

    // Prepend select column when selection is enabled
    if (selectionEnabled) {
      cols = ['select', ...cols];
    }

    return cols;
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
   * Check if a cell value is a formula error marker.
   */
  isFormulaErrorValue(value: any): boolean {
    return isFormulaError(value);
  }

  /**
   * Get the error tooltip for a formula error value.
   */
  getFormulaErrorTooltip(value: any): string {
    return isFormulaError(value) ? value.message : '';
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
    this.currentPageIndex.set(event.pageIndex);
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

  // ---- Selection Methods ----

  /**
   * Check if all rows on the current page are selected.
   */
  isAllSelected(): boolean {
    const data = this.data();
    return data.length > 0 && this.selection.selected.length === data.length;
  }

  /**
   * Check if some (but not all) rows are selected.
   */
  isIndeterminate(): boolean {
    return this.selection.selected.length > 0 && !this.isAllSelected();
  }

  /**
   * Toggle selection for all rows on the current page.
   */
  toggleAllRows(): void {
    if (this.isAllSelected()) {
      this.selection.clear();
    } else {
      this.selection.select(...this.data());
    }
    this.emitSelection();
  }

  /**
   * Toggle selection for a single row.
   */
  toggleRow(row: any): void {
    this.selection.toggle(row);
    this.emitSelection();
  }

  /**
   * Clear all selections.
   */
  clearSelection(): void {
    this.selection.clear();
    this.selectedCount.set(0);
  }

  /**
   * Emit the current selection state.
   */
  private emitSelection(): void {
    this.selectedCount.set(this.selection.selected.length);
    this.selectionChanged.emit(this.selection.selected);
  }

  // ---- Badge / Cell Rendering ----

  private static readonly STATUS_BADGE_MAP: Record<string, string> = {
    // Success tier
    won: 'badge--success',
    completed: 'badge--success',
    done: 'badge--success',
    active: 'badge--success',
    closed: 'badge--success',
    converted: 'badge--success',
    qualified: 'badge--success',
    // Warning tier
    pending: 'badge--warning',
    warm: 'badge--warning',
    'in progress': 'badge--warning',
    'follow up': 'badge--warning',
    expired: 'badge--warning',
    // Danger tier
    lost: 'badge--danger',
    cancelled: 'badge--danger',
    cold: 'badge--danger',
    urgent: 'badge--danger',
    overdue: 'badge--danger',
    hot: 'badge--danger',
    rejected: 'badge--danger',
    // Info tier
    new: 'badge--info',
    open: 'badge--info',
    assigned: 'badge--info',
    sent: 'badge--info',
    medium: 'badge--info',
    // Primary tier
    accepted: 'badge--primary',
    call: 'badge--primary',
    // Secondary tier
    draft: 'badge--secondary',
    inactive: 'badge--secondary',
    review: 'badge--secondary',
  };

  private static readonly BADGE_VARIANTS = [
    'badge--primary',
    'badge--secondary',
    'badge--success',
    'badge--warning',
    'badge--info',
    'badge--accent',
  ];

  /**
   * Get CSS class for a badge value — semantic map first, hash fallback.
   */
  getBadgeClass(value: any): string {
    if (value == null || value === '') return 'badge--secondary';
    const normalized = String(value).toLowerCase().trim();
    const mapped = DynamicTableComponent.STATUS_BADGE_MAP[normalized];
    if (mapped) return mapped;

    // Deterministic hash fallback for unknown values
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
      hash = ((hash << 5) - hash + normalized.charCodeAt(i)) | 0;
    }
    return DynamicTableComponent.BADGE_VARIANTS[
      Math.abs(hash) % DynamicTableComponent.BADGE_VARIANTS.length
    ];
  }

  /**
   * Convert camelCase or PascalCase to spaced label.
   */
  getBadgeLabel(value: any): string {
    if (value == null || value === '') return '';
    return String(value)
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/_/g, ' ');
  }

  /**
   * Get the effective renderAs type for a column.
   * Auto-detects 'date' from fieldType when no explicit renderAs is set.
   */
  getEffectiveRenderAs(fieldId: string): 'text' | 'badge' | 'email' | 'date' | 'avatar' {
    const def = this.columnDefinitions().find((d) => d.fieldId === fieldId);
    if (def?.renderAs) return def.renderAs;
    if (def?.fieldType === 'date') return 'date';
    return 'text';
  }

  /**
   * Format an ISO date string to a locale-aware human-readable format.
   * Uses the active Transloco language to determine locale:
   *   - English: "Feb 19, 2026"
   *   - Turkish: "19 Sub 2026"
   */
  formatDate(value: any): string {
    if (!value) return '';
    const date = new Date(value);
    if (isNaN(date.getTime())) return String(value);
    const locale = this.translocoService.getActiveLang() === 'tr' ? 'tr-TR' : 'en-US';
    return new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  }

  /**
   * Extract initials from a name (first + last initial).
   */
  getInitials(value: any): string {
    if (!value) return '';
    const parts = String(value).trim().split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  private static readonly AVATAR_COLORS = [
    '#f97316', '#ef4444', '#8b5cf6', '#06b6d4',
    '#10b981', '#f59e0b', '#ec4899', '#6366f1',
    '#14b8a6', '#e11d48',
  ];

  /**
   * Get a deterministic avatar background color from a name string.
   */
  getAvatarColor(value: any): string {
    if (!value) return DynamicTableComponent.AVATAR_COLORS[0];
    const str = String(value);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
    }
    return DynamicTableComponent.AVATAR_COLORS[
      Math.abs(hash) % DynamicTableComponent.AVATAR_COLORS.length
    ];
  }

  /**
   * Compute "Showing X-Y of Z" summary for the footer.
   */
  getPageRangeSummary(): string {
    const total = this.totalCount();
    if (total === 0) return this.translocoService.translate('common.table.noRecordsShort');
    const size = this.pageSize();
    const pageIdx = this.currentPageIndex();
    const start = pageIdx * size + 1;
    const end = Math.min(start + size - 1, total);
    return this.translocoService.translate('common.table.showing', { start, end, total });
  }
}

import {
  Component,
  ChangeDetectionStrategy,
  computed,
  input,
  output,
  viewChild,
} from '@angular/core';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule, MatSort, Sort } from '@angular/material/sort';
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
import {
  CdkDragDrop,
  CdkDropList,
  CdkDrag,
  moveItemInArray,
} from '@angular/cdk/drag-drop';
import { ColumnResizeDirective } from '../../directives/column-resize.directive';
import { ColumnPickerComponent } from './column-picker.component';
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
    CdkDropList,
    CdkDrag,
    ColumnResizeDirective,
    ColumnPickerComponent,
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

  // View children
  readonly sort = viewChild(MatSort);
  readonly paginator = viewChild(MatPaginator);

  // Computed: visible columns sorted by sortOrder, plus actions column
  displayedColumns = computed<string[]>(() => {
    const visible = this.columns()
      .filter((c) => c.visible)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((c) => c.fieldId);
    return [...visible, 'actions'];
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
   * Handle column reorder via CDK drag-drop.
   */
  onColumnDrop(event: CdkDragDrop<string[]>): void {
    const displayed = [...this.displayedColumns()];
    // Remove 'actions' for reorder
    const cols = displayed.filter((c) => c !== 'actions');
    moveItemInArray(cols, event.previousIndex, event.currentIndex);

    // Update sortOrder on ViewColumn objects
    const updated = this.columns().map((col) => {
      const newIndex = cols.indexOf(col.fieldId);
      if (newIndex >= 0) {
        return { ...col, sortOrder: newIndex };
      }
      return col;
    });

    this.columnOrderChanged.emit(updated);
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
}

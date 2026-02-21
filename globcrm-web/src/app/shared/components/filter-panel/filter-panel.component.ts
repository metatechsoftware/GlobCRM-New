import {
  Component,
  ChangeDetectionStrategy,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  ColumnDefinition,
  ViewFilter,
  FilterOperator,
} from '../saved-views/view.models';

interface OperatorOption {
  value: FilterOperator;
  label: string;
}

interface FilterRow {
  fieldId: string;
  operator: FilterOperator;
  value: string | null;
}

const TEXT_OPERATORS: OperatorOption[] = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Not equals' },
  { value: 'contains', label: 'Contains' },
  { value: 'not_contains', label: 'Does not contain' },
  { value: 'starts_with', label: 'Starts with' },
  { value: 'ends_with', label: 'Ends with' },
  { value: 'is_null', label: 'Is empty' },
  { value: 'is_not_null', label: 'Is not empty' },
];

const NUMBER_OPERATORS: OperatorOption[] = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Not equals' },
  { value: 'gt', label: 'Greater than' },
  { value: 'gte', label: 'Greater than or equal' },
  { value: 'lt', label: 'Less than' },
  { value: 'lte', label: 'Less than or equal' },
  { value: 'between', label: 'Between' },
  { value: 'is_null', label: 'Is empty' },
  { value: 'is_not_null', label: 'Is not empty' },
];

const DATE_OPERATORS: OperatorOption[] = [
  { value: 'equals', label: 'On' },
  { value: 'gt', label: 'After' },
  { value: 'gte', label: 'On or after' },
  { value: 'lt', label: 'Before' },
  { value: 'lte', label: 'On or before' },
  { value: 'between', label: 'Between' },
  { value: 'is_null', label: 'Is empty' },
  { value: 'is_not_null', label: 'Is not empty' },
];

const SELECT_OPERATORS: OperatorOption[] = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Not equals' },
  { value: 'in', label: 'Is any of' },
  { value: 'is_null', label: 'Is empty' },
  { value: 'is_not_null', label: 'Is not empty' },
];

/**
 * Expandable filter panel for building advanced filter queries.
 * Supports adding multiple filter rows with field/operator/value selection.
 * Operators adapt to the field type (text, number, date, select).
 */
@Component({
  selector: 'app-filter-panel',
  standalone: true,
  imports: [
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    TranslocoPipe,
  ],
  templateUrl: './filter-panel.component.html',
  styleUrl: './filter-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FilterPanelComponent {
  columnDefinitions = input.required<ColumnDefinition[]>();
  activeFilters = input.required<ViewFilter[]>();
  filtersChanged = output<ViewFilter[]>();

  isPanelOpen = signal(false);
  filterRows: FilterRow[] = [];

  filterableColumns = computed(() =>
    this.columnDefinitions().filter((c) => c.filterable),
  );

  togglePanel(): void {
    this.isPanelOpen.update((v) => !v);
  }

  /**
   * Get available operators based on the field type.
   */
  getOperatorsForField(fieldId: string): OperatorOption[] {
    const col = this.columnDefinitions().find((c) => c.fieldId === fieldId);
    if (!col) return TEXT_OPERATORS;

    const type = col.fieldType.toLowerCase();

    if (type === 'number' || type === 'currency') {
      return NUMBER_OPERATORS;
    }
    if (type === 'date' || type === 'datetime') {
      return DATE_OPERATORS;
    }
    if (
      type === 'dropdown' ||
      type === 'multiselect' ||
      type === 'checkbox'
    ) {
      return SELECT_OPERATORS;
    }

    return TEXT_OPERATORS;
  }

  isNullOperator(operator: FilterOperator): boolean {
    return operator === 'is_null' || operator === 'is_not_null';
  }

  addFilter(): void {
    const filterable = this.filterableColumns();
    const defaultField = filterable[0]?.fieldId ?? '';
    this.filterRows = [
      ...this.filterRows,
      { fieldId: defaultField, operator: 'equals', value: null },
    ];
  }

  removeFilter(index: number): void {
    this.filterRows = this.filterRows.filter((_, i) => i !== index);
  }

  onFieldChange(index: number, fieldId: string): void {
    this.filterRows = this.filterRows.map((row, i) =>
      i === index ? { ...row, fieldId, operator: 'equals', value: null } : row,
    );
  }

  onOperatorChange(index: number, operator: FilterOperator): void {
    this.filterRows = this.filterRows.map((row, i) =>
      i === index ? { ...row, operator } : row,
    );
  }

  onValueChange(index: number, value: string): void {
    this.filterRows = this.filterRows.map((row, i) =>
      i === index ? { ...row, value: value || null } : row,
    );
  }

  clearFilters(): void {
    this.filterRows = [];
    this.filtersChanged.emit([]);
  }

  applyFilters(): void {
    const filters: ViewFilter[] = this.filterRows
      .filter((row) => row.fieldId)
      .map((row) => ({
        fieldId: row.fieldId,
        operator: row.operator,
        value: row.value,
      }));
    this.filtersChanged.emit(filters);
  }
}

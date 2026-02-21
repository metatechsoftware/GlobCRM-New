import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { NgClass } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { ColumnDefinition, ViewFilter } from '../saved-views/view.models';

/**
 * Displays active filters as removable badge chips.
 * Chips are color-coded by field type using the global .badge utility.
 */
@Component({
  selector: 'app-filter-chips',
  standalone: true,
  imports: [MatIconModule, NgClass, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './filter-chips.component.html',
  styleUrl: './filter-chips.component.scss',
})
export class FilterChipsComponent {
  filters = input.required<ViewFilter[]>();
  columnDefinitions = input.required<ColumnDefinition[]>();

  filterRemoved = output<ViewFilter>();
  filtersCleared = output<void>();

  /**
   * Get the badge color class based on the field type.
   */
  getChipBadgeClass(filter: ViewFilter): string {
    const col = this.columnDefinitions().find(
      (c) => c.fieldId === filter.fieldId,
    );
    if (!col) return 'badge--primary';

    const type = col.fieldType.toLowerCase();
    if (type === 'number' || type === 'currency') return 'badge--accent';
    if (type === 'date' || type === 'datetime') return 'badge--warning';
    if (type === 'dropdown' || type === 'multiselect' || type === 'checkbox')
      return 'badge--secondary';
    if (type === 'text') return 'badge--info';
    return 'badge--primary';
  }

  /**
   * Build a human-readable chip label from a ViewFilter.
   */
  getChipLabel(filter: ViewFilter): string {
    const col = this.columnDefinitions().find(
      (c) => c.fieldId === filter.fieldId,
    );
    const fieldLabel = col?.label ?? filter.fieldId;
    const operatorLabel = this.formatOperator(filter.operator);

    if (filter.operator === 'is_null' || filter.operator === 'is_not_null') {
      return `${fieldLabel} ${operatorLabel}`;
    }

    return `${fieldLabel} ${operatorLabel} ${filter.value ?? ''}`;
  }

  private formatOperator(operator: string): string {
    const operatorMap: Record<string, string> = {
      equals: '=',
      not_equals: '!=',
      contains: 'contains',
      not_contains: 'not contains',
      starts_with: 'starts with',
      ends_with: 'ends with',
      gt: '>',
      gte: '>=',
      lt: '<',
      lte: '<=',
      in: 'in',
      between: 'between',
      is_null: 'is empty',
      is_not_null: 'is not empty',
    };
    return operatorMap[operator] ?? operator;
  }
}

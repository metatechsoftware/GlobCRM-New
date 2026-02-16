import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { ColumnDefinition, ViewFilter } from '../saved-views/view.models';

/**
 * Displays active filters as removable chips.
 * Shows "{fieldLabel} {operator} {value}" with a remove (x) button per chip,
 * and a "Clear all" chip when filters are active.
 */
@Component({
  selector: 'app-filter-chips',
  standalone: true,
  imports: [MatChipsModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (filters().length > 0) {
      <mat-chip-set class="filter-chips" aria-label="Active filters">
        @for (filter of filters(); track $index) {
          <mat-chip (removed)="filterRemoved.emit(filter)" highlighted>
            {{ getChipLabel(filter) }}
            <button matChipRemove aria-label="Remove filter">
              <mat-icon>cancel</mat-icon>
            </button>
          </mat-chip>
        }
        <mat-chip
          class="clear-all-chip"
          (click)="filtersCleared.emit()">
          <mat-icon>clear_all</mat-icon>
          Clear all
        </mat-chip>
      </mat-chip-set>
    }
  `,
  styles: `
    .filter-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      padding: 8px 16px;
    }

    .clear-all-chip {
      cursor: pointer;
    }
  `,
})
export class FilterChipsComponent {
  filters = input.required<ViewFilter[]>();
  columnDefinitions = input.required<ColumnDefinition[]>();

  filterRemoved = output<ViewFilter>();
  filtersCleared = output<void>();

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

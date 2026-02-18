import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
} from '@angular/core';
import { MetricResultDto } from '../../../models/dashboard.models';

interface TableColumn {
  key: string;
  label: string;
}

/**
 * Table widget renders a mini data table from series data.
 * Uses plain HTML table with configurable columns.
 * Values auto-formatted based on type detection.
 */
@Component({
  selector: 'app-table-widget',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
      height: 100%;
      overflow: auto;
    }

    .widget-table {
      width: 100%;
      border-collapse: collapse;
      font-size: var(--text-sm, 0.8125rem);
    }

    .widget-table th {
      text-align: left;
      padding: var(--space-2, 8px) var(--space-3, 12px);
      font-weight: var(--font-semibold, 600);
      color: var(--color-text-secondary, #6B7280);
      font-size: var(--text-xs, 0.75rem);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border-bottom: 2px solid var(--color-border-subtle, #F3F4F6);
      white-space: nowrap;
    }

    .widget-table th:last-child {
      text-align: right;
    }

    .widget-table td {
      padding: var(--space-2, 8px) var(--space-3, 12px);
      color: var(--color-text, #111827);
      border-bottom: 1px solid var(--color-border-subtle, #F3F4F6);
    }

    .widget-table td:last-child {
      text-align: right;
      font-weight: var(--font-medium, 500);
      font-variant-numeric: tabular-nums;
    }

    .widget-table tbody tr:hover {
      background: var(--color-highlight, rgba(249, 115, 22, 0.08));
    }

    .widget-table tbody tr:last-child td {
      border-bottom: none;
    }

    .table-empty {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: var(--color-text-muted, #9CA3AF);
      font-size: var(--text-sm, 0.8125rem);
      padding: var(--space-4, 16px);
    }
  `,
  template: `
    @if (rows().length > 0) {
      <table class="widget-table">
        <thead>
          <tr>
            @for (col of columns(); track col.key) {
              <th>{{ col.label }}</th>
            }
          </tr>
        </thead>
        <tbody>
          @for (row of rows(); track $index) {
            <tr>
              @for (col of columns(); track col.key) {
                <td>{{ row[col.key] }}</td>
              }
            </tr>
          }
        </tbody>
      </table>
    } @else {
      <div class="table-empty">
        <span>No data available</span>
      </div>
    }
  `,
})
export class TableWidgetComponent {
  readonly data = input<MetricResultDto | null>(null);
  readonly title = input<string>('');
  readonly columns = input<TableColumn[]>([
    { key: 'label', label: 'Name' },
    { key: 'value', label: 'Value' },
  ]);

  readonly rows = computed<Record<string, string>[]>(() => {
    const metric = this.data();
    const series = metric?.series ?? [];

    return series.map((s) => ({
      label: s.label,
      value: this.formatValue(s.value),
    }));
  });

  private formatValue(val: number): string {
    // Detect currency-like values (large non-integer values)
    if (val > 100 && !Number.isInteger(val)) {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(val);
    }
    return new Intl.NumberFormat('en-US').format(val);
  }
}

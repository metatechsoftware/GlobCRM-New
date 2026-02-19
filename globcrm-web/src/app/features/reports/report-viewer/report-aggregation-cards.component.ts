import {
  Component,
  ChangeDetectionStrategy,
  input,
} from '@angular/core';
import { ReportAggregateResult } from '../report.models';

/**
 * Chart.js color palette for accent borders on aggregation cards.
 */
const CARD_ACCENT_COLORS = [
  '#F97316',
  '#8B5CF6',
  '#14B8A6',
  '#3B82F6',
  '#22C55E',
  '#F59E0B',
  '#EF4444',
  '#9CA3AF',
];

/**
 * Aggregation summary cards displayed above the report data table when grouping
 * is active. Shows KPI values (count, sum, average, min, max) with colored
 * accent borders and formatted values.
 */
@Component({
  selector: 'app-report-aggregation-cards',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
      margin-bottom: 16px;
    }

    .aggregation-cards {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }

    .aggregation-card {
      flex: 1;
      min-width: 140px;
      max-width: 220px;
      padding: 16px;
      border: 1px solid var(--color-border, #e2e8f0);
      border-radius: 8px;
      background: var(--color-surface, #fff);
      transition: border-color 0.15s;
    }

    .aggregation-card:hover {
      border-color: var(--color-border-hover, #cbd5e1);
    }

    .aggregation-card__label {
      display: block;
      font-size: 11px;
      color: var(--color-text-secondary, #6B7280);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-weight: 500;
      margin-bottom: 4px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .aggregation-card__value {
      display: block;
      font-size: 24px;
      font-weight: 700;
      line-height: 1.2;
      color: var(--color-text, #1A1A1A);
    }

    @media (max-width: 768px) {
      .aggregation-cards {
        flex-direction: column;
      }

      .aggregation-card {
        max-width: none;
      }
    }
  `,
  template: `
    <div class="aggregation-cards">
      @for (agg of aggregates(); track agg.fieldId; let i = $index) {
        <div
          class="aggregation-card"
          [style.border-left]="'3px solid ' + accentColor(i)"
        >
          <span class="aggregation-card__label">{{ agg.label }} ({{ agg.aggregation }})</span>
          <span class="aggregation-card__value">{{ formatValue(agg.value, agg.aggregation) }}</span>
        </div>
      }
    </div>
  `,
})
export class ReportAggregationCardsComponent {
  readonly aggregates = input<ReportAggregateResult[]>([]);

  accentColor(index: number): string {
    return CARD_ACCENT_COLORS[index % CARD_ACCENT_COLORS.length];
  }

  formatValue(value: any, aggregation: string): string {
    if (value == null) return '--';

    const num = Number(value);
    if (isNaN(num)) return String(value);

    // Round averages to 2 decimal places
    if (aggregation === 'average') {
      return num.toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      });
    }

    // Counts and other integers -- no decimal places
    if (aggregation === 'count') {
      return Math.round(num).toLocaleString();
    }

    // Sum, min, max -- if value looks like currency (> 1 and has decimals), format with 2 decimals
    if (num !== Math.floor(num)) {
      return num.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    }

    return num.toLocaleString();
  }
}

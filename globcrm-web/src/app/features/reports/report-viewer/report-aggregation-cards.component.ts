import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
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
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    @keyframes cardSlideUp {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

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
      min-width: 160px;
      max-width: 240px;
      padding: 20px;
      border: 1px solid rgba(0, 0, 0, 0.06);
      border-radius: var(--radius-lg, 12px);
      background: rgba(255, 255, 255, 0.7);
      backdrop-filter: blur(8px);
      position: relative;
      overflow: hidden;
      transition: border-color 200ms cubic-bezier(0, 0, 0.2, 1),
                  box-shadow 200ms cubic-bezier(0, 0, 0.2, 1),
                  transform 200ms cubic-bezier(0, 0, 0.2, 1);
      animation: cardSlideUp 400ms cubic-bezier(0, 0, 0.2, 1) backwards;
    }

    .aggregation-card:nth-child(1) { animation-delay: 0ms; }
    .aggregation-card:nth-child(2) { animation-delay: 60ms; }
    .aggregation-card:nth-child(3) { animation-delay: 120ms; }
    .aggregation-card:nth-child(4) { animation-delay: 180ms; }
    .aggregation-card:nth-child(5) { animation-delay: 240ms; }
    .aggregation-card:nth-child(6) { animation-delay: 300ms; }
    .aggregation-card:nth-child(7) { animation-delay: 360ms; }
    .aggregation-card:nth-child(8) { animation-delay: 420ms; }

    .aggregation-card__accent {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
    }

    .aggregation-card:hover {
      border-color: rgba(0, 0, 0, 0.1);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
      transform: translateY(-1px);
    }

    .aggregation-card__header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 8px;
    }

    .aggregation-card__icon {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
    }

    .aggregation-card__label {
      display: block;
      font-size: 11px;
      color: var(--color-text-secondary, #6B7280);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .aggregation-card__value {
      display: block;
      font-size: 28px;
      font-weight: 700;
      line-height: 1.2;
      color: var(--color-text, #1A1A1A);
      font-variant-numeric: tabular-nums;
      letter-spacing: -0.02em;
    }

    @media (max-width: 768px) {
      .aggregation-cards {
        flex-direction: column;
      }

      .aggregation-card {
        max-width: none;
        backdrop-filter: none;
        background: var(--color-surface, #fff);
      }
    }
  `,
  template: `
    <div class="aggregation-cards">
      @for (agg of aggregates(); track agg.fieldId; let i = $index) {
        <div class="aggregation-card">
          <div
            class="aggregation-card__accent"
            [style.background]="'linear-gradient(90deg, ' + accentColor(i) + ', ' + accentColor(i) + '80)'"
          ></div>
          <div class="aggregation-card__header">
            <div
              class="aggregation-card__icon"
              [style.background]="accentColor(i) + '15'"
              [style.color]="accentColor(i)"
            >
              <mat-icon>{{ aggregationIcon(agg.aggregation) }}</mat-icon>
            </div>
            <span class="aggregation-card__label">{{ agg.label }} ({{ agg.aggregation }})</span>
          </div>
          <span class="aggregation-card__value">{{ formatValue(agg.value, agg.aggregation) }}</span>
        </div>
      }
    </div>
  `,
})
export class ReportAggregationCardsComponent {
  readonly aggregates = input<ReportAggregateResult[]>([]);

  /** Compact number formatter for large values */
  private readonly compactFormatter = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });

  accentColor(index: number): string {
    return CARD_ACCENT_COLORS[index % CARD_ACCENT_COLORS.length];
  }

  aggregationIcon(aggregation: string): string {
    const map: Record<string, string> = {
      count: 'tag',
      sum: 'functions',
      average: 'calculate',
      min: 'arrow_downward',
      max: 'arrow_upward',
    };
    return map[aggregation] ?? 'analytics';
  }

  formatValue(value: any, aggregation: string): string {
    if (value == null) return '--';

    const num = Number(value);
    if (isNaN(num)) return String(value);

    // Large numbers — compact notation (1.2M, 45K)
    const abs = Math.abs(num);
    if (abs >= 1_000_000) {
      return this.compactFormatter.format(num);
    }

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

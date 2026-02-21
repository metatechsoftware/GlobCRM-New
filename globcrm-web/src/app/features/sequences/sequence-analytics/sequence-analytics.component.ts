import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
} from '@angular/core';
import { DecimalPipe, PercentPipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { BaseChartDirective } from 'ng2-charts';
import { ChartData, ChartOptions } from 'chart.js';
import { SequenceAnalytics, StepMetrics, FunnelData } from '../sequence.models';

/**
 * Orange gradient palette for funnel chart bars (dark to light).
 */
const FUNNEL_COLORS = [
  '#EA580C', // orange-600
  '#F97316', // orange-500
  '#FB923C', // orange-400
  '#FDBA74', // orange-300
  '#FED7AA', // orange-200
  '#FFEDD5', // orange-100
  '#FFF7ED', // orange-50
];

/**
 * Sequence analytics visualization component.
 * Displays summary metric cards, a horizontal funnel chart, and per-step metrics table.
 * Used in the sequence detail page.
 */
@Component({
  selector: 'app-sequence-analytics',
  standalone: true,
  imports: [
    DecimalPipe,
    PercentPipe,
    MatIconModule,
    TranslocoPipe,
    BaseChartDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
      margin-bottom: var(--space-6, 24px);
    }

    /* ─── Summary Metric Cards ─── */
    .analytics__metrics {
      display: flex;
      gap: var(--space-3, 12px);
      margin-bottom: var(--space-6, 24px);
      flex-wrap: wrap;
    }

    .metric-card {
      flex: 1;
      min-width: 130px;
      padding: var(--space-4, 16px) var(--space-4, 16px);
      background: var(--color-surface, #fff);
      border: 1px solid var(--color-border, #e2e8f0);
      border-radius: var(--radius-lg, 12px);
      text-align: center;
      position: relative;
      overflow: hidden;
      transition:
        border-color var(--duration-fast, 100ms) var(--ease-default),
        box-shadow var(--duration-fast, 100ms) var(--ease-default),
        transform var(--duration-fast, 100ms) var(--ease-default);
      box-shadow: var(--shadow-xs, 0 1px 2px rgba(0,0,0,0.04));
    }

    .metric-card:hover {
      transform: translateY(-2px);
      box-shadow: var(--shadow-md, 0 4px 6px rgba(0,0,0,0.05));
    }

    .metric-card__icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      margin: 0 auto var(--space-2, 8px);
      border-radius: var(--radius-md, 8px);
    }

    .metric-card__icon mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .metric-card__value {
      display: block;
      font-size: var(--text-2xl, 24px);
      font-weight: var(--font-bold, 700);
      line-height: 1.2;
      font-variant-numeric: tabular-nums;
    }

    .metric-card__label {
      display: block;
      font-size: 11px;
      color: var(--color-text-secondary, #64748b);
      margin-top: var(--space-1, 4px);
      text-transform: uppercase;
      letter-spacing: 0.6px;
      font-weight: var(--font-semibold, 600);
    }

    /* Card variants with accent colors */
    .metric-card--primary {
      border-bottom: 3px solid var(--color-primary, #F97316);
      .metric-card__icon { background: var(--color-primary-soft, #FFF7ED); color: var(--color-primary, #F97316); }
      .metric-card__value { color: var(--color-primary-hover, #EA580C); }
      &:hover { border-color: var(--color-primary, #F97316); }
    }

    .metric-card--active {
      border-bottom: 3px solid var(--color-success, #22C55E);
      .metric-card__icon { background: var(--color-success-soft, #F0FDF4); color: var(--color-success, #22C55E); }
      .metric-card__value { color: var(--color-success-text, #15803D); }
      &:hover { border-color: var(--color-success, #22C55E); }
    }

    .metric-card--completed {
      border-bottom: 3px solid var(--color-info, #3B82F6);
      .metric-card__icon { background: var(--color-info-soft, #EFF6FF); color: var(--color-info, #3B82F6); }
      .metric-card__value { color: var(--color-info-text, #1D4ED8); }
      &:hover { border-color: var(--color-info, #3B82F6); }
    }

    .metric-card--replied {
      border-bottom: 3px solid var(--color-secondary, #8B5CF6);
      .metric-card__icon { background: var(--color-secondary-soft, #F5F3FF); color: var(--color-secondary, #8B5CF6); }
      .metric-card__value { color: var(--color-secondary-text, #6D28D9); }
      &:hover { border-color: var(--color-secondary, #8B5CF6); }
    }

    .metric-card--bounced {
      border-bottom: 3px solid var(--color-danger, #EF4444);
      .metric-card__icon { background: var(--color-danger-soft, #FEF2F2); color: var(--color-danger, #EF4444); }
      .metric-card__value { color: var(--color-danger-text, #B91C1C); }
      &:hover { border-color: var(--color-danger, #EF4444); }
    }

    /* ─── Funnel Chart Section ─── */
    .analytics__funnel {
      margin-bottom: var(--space-8, 32px);
      background: var(--color-surface, #fff);
      border: 1px solid var(--color-border, #e2e8f0);
      border-radius: var(--radius-lg, 12px);
      padding: var(--space-5, 20px);
      box-shadow: var(--shadow-xs, 0 1px 2px rgba(0,0,0,0.04));
    }

    .analytics__section-title {
      display: flex;
      align-items: center;
      gap: var(--space-2, 8px);
      font-size: var(--text-md, 16px);
      font-weight: var(--font-semibold, 600);
      margin: 0 0 var(--space-4, 16px) 0;
      color: var(--color-text, #1e293b);
    }

    .analytics__section-title mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
      color: var(--color-primary, #f97316);
    }

    .analytics__chart-wrap {
      position: relative;
      width: 100%;
      min-height: 200px;
    }

    /* ─── Per-Step Metrics Table ─── */
    .analytics__step-metrics {
      margin-bottom: var(--space-6, 24px);
      background: var(--color-surface, #fff);
      border: 1px solid var(--color-border, #e2e8f0);
      border-radius: var(--radius-lg, 12px);
      padding: var(--space-5, 20px);
      box-shadow: var(--shadow-xs, 0 1px 2px rgba(0,0,0,0.04));
      overflow-x: auto;
    }

    .step-table {
      width: 100%;
      border-collapse: collapse;
    }

    .step-table th {
      text-align: left;
      font-size: 11px;
      font-weight: var(--font-semibold, 600);
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: var(--color-text-secondary, #64748b);
      padding: var(--space-2, 8px) var(--space-3, 12px);
      border-bottom: 2px solid var(--color-border, #e2e8f0);
    }

    .step-table td {
      padding: var(--space-3, 12px);
      font-size: var(--text-base, 14px);
      border-bottom: 1px solid var(--color-border-subtle, #f1f5f9);
      vertical-align: middle;
    }

    .step-table tbody tr {
      transition: background-color var(--duration-fast, 100ms) var(--ease-default);
    }

    .step-table tbody tr:hover {
      background: var(--color-highlight, rgba(249, 115, 22, 0.06));
    }

    .step-table tbody tr:last-child td {
      border-bottom: none;
    }

    .step-table__step-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      border-radius: var(--radius-full, 9999px);
      background: linear-gradient(135deg, var(--color-primary, #f97316) 0%, var(--color-primary-hover, #EA580C) 100%);
      color: var(--color-primary-fg, white);
      font-size: 11px;
      font-weight: var(--font-bold, 700);
      margin-right: var(--space-2, 8px);
      box-shadow: 0 1px 3px rgba(249, 115, 22, 0.2);
    }

    .step-table__rate {
      font-weight: var(--font-semibold, 600);
      font-variant-numeric: tabular-nums;
    }

    .step-table__estimated {
      font-size: 10px;
      color: var(--color-text-muted, #9CA3AF);
      font-style: italic;
      margin-left: var(--space-1, 4px);
    }

    .analytics__empty {
      text-align: center;
      padding: var(--space-8, 32px);
      color: var(--color-text-secondary, #64748b);
      font-size: var(--text-sm, 13px);
      background: var(--color-surface, #fff);
      border: 1px solid var(--color-border, #e2e8f0);
      border-radius: var(--radius-lg, 12px);
    }

    @media (max-width: 768px) {
      .analytics__metrics {
        flex-direction: column;
      }

      .metric-card {
        min-width: auto;
      }

      .analytics__funnel,
      .analytics__step-metrics {
        padding: var(--space-3, 12px);
      }
    }
  `,
  template: `
    <!-- Summary Metric Cards -->
    @if (analytics()) {
      <div class="analytics__metrics">
        <div class="metric-card metric-card--primary">
          <div class="metric-card__icon"><mat-icon>people</mat-icon></div>
          <span class="metric-card__value">{{ analytics()!.totalEnrolled }}</span>
          <span class="metric-card__label">{{ 'sequences.analytics.totalEnrolled' | transloco }}</span>
        </div>
        <div class="metric-card metric-card--active">
          <div class="metric-card__icon"><mat-icon>play_circle</mat-icon></div>
          <span class="metric-card__value">{{ analytics()!.active }}</span>
          <span class="metric-card__label">{{ 'sequences.analytics.active' | transloco }}</span>
        </div>
        <div class="metric-card metric-card--completed">
          <div class="metric-card__icon"><mat-icon>check_circle</mat-icon></div>
          <span class="metric-card__value">{{ analytics()!.completed }}</span>
          <span class="metric-card__label">{{ 'sequences.analytics.completed' | transloco }}</span>
        </div>
        <div class="metric-card metric-card--replied">
          <div class="metric-card__icon"><mat-icon>reply</mat-icon></div>
          <span class="metric-card__value">{{ analytics()!.replied }}</span>
          <span class="metric-card__label">{{ 'sequences.analytics.replied' | transloco }}</span>
        </div>
        <div class="metric-card metric-card--bounced">
          <div class="metric-card__icon"><mat-icon>error</mat-icon></div>
          <span class="metric-card__value">{{ analytics()!.bounced }}</span>
          <span class="metric-card__label">{{ 'sequences.analytics.bounced' | transloco }}</span>
        </div>
      </div>
    }

    <!-- Funnel Chart -->
    @if (funnelData().length > 0) {
      <div class="analytics__funnel">
        <h3 class="analytics__section-title">
          <mat-icon>filter_alt</mat-icon>
          {{ 'sequences.analytics.funnelTitle' | transloco }}
        </h3>
        <div class="analytics__chart-wrap">
          <canvas baseChart
            [data]="funnelChartData()"
            [options]="funnelChartOptions"
            type="bar">
          </canvas>
        </div>
      </div>
    }

    <!-- Per-Step Metrics Table -->
    @if (stepMetrics().length > 0) {
      <div class="analytics__step-metrics">
        <h3 class="analytics__section-title">
          <mat-icon>bar_chart</mat-icon>
          {{ 'sequences.analytics.stepPerformanceTitle' | transloco }}
        </h3>
        <table class="step-table">
          <thead>
            <tr>
              <th>{{ 'sequences.analytics.stepColumns.step' | transloco }}</th>
              <th>{{ 'sequences.analytics.stepColumns.template' | transloco }}</th>
              <th>{{ 'sequences.analytics.stepColumns.sent' | transloco }}</th>
              <th>{{ 'sequences.analytics.stepColumns.openRate' | transloco }}</th>
              <th>{{ 'sequences.analytics.stepColumns.clickRate' | transloco }}</th>
            </tr>
          </thead>
          <tbody>
            @for (metric of stepMetrics(); track metric.stepNumber) {
              <tr>
                <td>
                  <span class="step-table__step-badge">{{ metric.stepNumber }}</span>
                </td>
                <td>{{ metric.templateName }}</td>
                <td>{{ metric.sent }}</td>
                <td>
                  <span class="step-table__rate">{{ metric.openRate }}%</span>
                  <span class="step-table__estimated">{{ 'sequences.analytics.estimated' | transloco }}</span>
                </td>
                <td>
                  <span class="step-table__rate">{{ metric.clickRate }}%</span>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }

    @if (!analytics() && funnelData().length === 0 && stepMetrics().length === 0) {
      <div class="analytics__empty">
        {{ 'sequences.analytics.noData' | transloco }}
      </div>
    }
  `,
})
export class SequenceAnalyticsComponent {
  readonly analytics = input<SequenceAnalytics | null>(null);
  readonly stepMetrics = input<StepMetrics[]>([]);
  readonly funnelData = input<FunnelData[]>([]);

  /** Computed: Chart.js data for the horizontal bar funnel chart. */
  readonly funnelChartData = computed<ChartData<'bar'>>(() => {
    const data = this.funnelData();
    const labels = data.map((d) => `Step ${d.stepNumber}: ${d.stepName}`);
    const values = data.map((d) => d.count);

    // Assign colors from the gradient palette (repeat if more steps than colors)
    const bgColors = values.map(
      (_, i) => FUNNEL_COLORS[i % FUNNEL_COLORS.length],
    );

    return {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: bgColors,
          borderRadius: 4,
          barThickness: 28,
        },
      ],
    };
  });

  /** Chart options: horizontal bars, no legend, clean grid. */
  readonly funnelChartOptions: ChartOptions<'bar'> = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: (context) => `${context.parsed.x} contacts`,
        },
      },
    },
    scales: {
      x: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.06)',
        },
        ticks: {
          precision: 0,
        },
      },
      y: {
        grid: {
          display: false,
        },
      },
    },
  };
}

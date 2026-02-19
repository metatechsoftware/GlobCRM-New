import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
} from '@angular/core';
import { DecimalPipe, PercentPipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
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
    BaseChartDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
    }

    /* Summary Metric Cards */
    .analytics__metrics {
      display: flex;
      gap: 16px;
      margin-bottom: 24px;
      flex-wrap: wrap;
    }

    .metric-card {
      flex: 1;
      min-width: 120px;
      padding: 16px;
      border: 1px solid var(--border-color, #e2e8f0);
      border-radius: 8px;
      text-align: center;
      transition: border-color 0.15s;
    }

    .metric-card:hover {
      border-color: var(--primary, #f97316);
    }

    .metric-card__value {
      display: block;
      font-size: 28px;
      font-weight: 700;
      line-height: 1.2;
    }

    .metric-card__label {
      display: block;
      font-size: 12px;
      color: var(--text-secondary, #64748b);
      margin-top: 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-weight: 500;
    }

    .metric-card--primary .metric-card__value { color: #EA580C; }
    .metric-card--active .metric-card__value { color: #16A34A; }
    .metric-card--completed .metric-card__value { color: #2563EB; }
    .metric-card--replied .metric-card__value { color: #7C3AED; }
    .metric-card--bounced .metric-card__value { color: #DC2626; }

    /* Funnel Chart Section */
    .analytics__funnel {
      margin-bottom: 32px;
    }

    .analytics__section-title {
      font-size: 16px;
      font-weight: 500;
      margin: 0 0 16px 0;
      color: var(--text-primary, #1e293b);
    }

    .analytics__chart-wrap {
      position: relative;
      width: 100%;
      min-height: 200px;
    }

    /* Per-Step Metrics Table */
    .analytics__step-metrics {
      margin-bottom: 24px;
    }

    .step-table {
      width: 100%;
      border-collapse: collapse;
    }

    .step-table th {
      text-align: left;
      font-size: 12px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-secondary, #64748b);
      padding: 8px 12px;
      border-bottom: 2px solid var(--border-color, #e2e8f0);
    }

    .step-table td {
      padding: 10px 12px;
      font-size: 14px;
      border-bottom: 1px solid var(--border-color-subtle, #f1f5f9);
      vertical-align: middle;
    }

    .step-table__step-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: var(--primary, #f97316);
      color: white;
      font-size: 12px;
      font-weight: 600;
      margin-right: 8px;
    }

    .step-table__estimated {
      font-size: 11px;
      color: var(--text-secondary, #94a3b8);
      font-style: italic;
    }

    .analytics__empty {
      text-align: center;
      padding: 32px;
      color: var(--text-secondary, #64748b);
      font-size: 14px;
    }

    @media (max-width: 768px) {
      .analytics__metrics {
        flex-direction: column;
      }

      .metric-card {
        min-width: auto;
      }
    }
  `,
  template: `
    <!-- Summary Metric Cards -->
    @if (analytics()) {
      <div class="analytics__metrics">
        <div class="metric-card metric-card--primary">
          <span class="metric-card__value">{{ analytics()!.totalEnrolled }}</span>
          <span class="metric-card__label">Total Enrolled</span>
        </div>
        <div class="metric-card metric-card--active">
          <span class="metric-card__value">{{ analytics()!.active }}</span>
          <span class="metric-card__label">Active</span>
        </div>
        <div class="metric-card metric-card--completed">
          <span class="metric-card__value">{{ analytics()!.completed }}</span>
          <span class="metric-card__label">Completed</span>
        </div>
        <div class="metric-card metric-card--replied">
          <span class="metric-card__value">{{ analytics()!.replied }}</span>
          <span class="metric-card__label">Replied</span>
        </div>
        <div class="metric-card metric-card--bounced">
          <span class="metric-card__value">{{ analytics()!.bounced }}</span>
          <span class="metric-card__label">Bounced</span>
        </div>
      </div>
    }

    <!-- Funnel Chart -->
    @if (funnelData().length > 0) {
      <div class="analytics__funnel">
        <h3 class="analytics__section-title">Enrollment Funnel</h3>
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
        <h3 class="analytics__section-title">Per-Step Performance</h3>
        <table class="step-table">
          <thead>
            <tr>
              <th>Step</th>
              <th>Template</th>
              <th>Sent</th>
              <th>Open Rate</th>
              <th>Click Rate</th>
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
                  {{ metric.openRate }}%
                  <span class="step-table__estimated">(estimated)</span>
                </td>
                <td>{{ metric.clickRate }}%</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }

    @if (!analytics() && funnelData().length === 0 && stepMetrics().length === 0) {
      <div class="analytics__empty">
        No analytics data available yet. Enroll contacts and send emails to see metrics.
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

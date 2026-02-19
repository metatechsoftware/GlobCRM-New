import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
  ElementRef,
  afterNextRender,
  OnDestroy,
  viewChild,
} from '@angular/core';
import { BaseChartDirective } from 'ng2-charts';
import { ChartData, ChartOptions, Chart } from 'chart.js';
import { MetricResultDto } from '../../../models/dashboard.models';

/**
 * Chart.js color palette matching GlobCRM design system.
 * Hex values required since Chart.js doesn't support CSS variables.
 */
const CHART_COLORS = [
  '#F97316', // primary (orange)
  '#8B5CF6', // secondary (violet)
  '#14B8A6', // accent (teal)
  '#3B82F6', // info (blue)
  '#22C55E', // success (green)
  '#F59E0B', // warning (amber)
  '#EF4444', // danger (red)
  '#9CA3AF', // neutral (muted)
];

const CHART_COLORS_ALPHA = CHART_COLORS.map((c) => c + '33');

/**
 * Chart widget that renders bar, line, pie, or doughnut charts
 * using ng2-charts/Chart.js. Handles responsive resize via ResizeObserver.
 */
@Component({
  selector: 'app-chart-widget',
  standalone: true,
  imports: [BaseChartDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
      height: 100%;
      position: relative;
    }

    .chart-container {
      position: relative;
      width: 100%;
      height: 100%;
      min-height: 0;
    }

    canvas {
      width: 100% !important;
      height: 100% !important;
    }
  `,
  template: `
    <div class="chart-container">
      <canvas
        #chartCanvas
        baseChart
        [data]="chartData()"
        [options]="chartOptions"
        [type]="chartType()"
      ></canvas>
    </div>
  `,
})
export class ChartWidgetComponent implements OnDestroy {
  readonly chartType = input.required<'bar' | 'line' | 'pie' | 'doughnut'>();
  readonly data = input<MetricResultDto | null>(null);
  readonly title = input<string>('');

  readonly chartDirective = viewChild(BaseChartDirective);

  private resizeObserver: ResizeObserver | null = null;

  readonly chartOptions: ChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          usePointStyle: true,
          padding: 16,
          font: { size: 11, family: 'Inter, sans-serif' },
          color: '#9CA3AF',
        },
      },
      title: {
        display: false,
      },
      tooltip: {
        backgroundColor: '#1A1A1A',
        titleFont: { size: 12, family: 'Inter, sans-serif', weight: '600' as any },
        bodyFont: { size: 11, family: 'Inter, sans-serif' },
        padding: 10,
        cornerRadius: 8,
        displayColors: true,
        boxPadding: 4,
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          font: { size: 11, family: 'Inter, sans-serif' },
          color: '#9CA3AF',
        },
        border: { display: false },
      },
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(249, 115, 22, 0.04)' },
        ticks: {
          font: { size: 11, family: 'Inter, sans-serif' },
          color: '#9CA3AF',
        },
        border: { display: false },
      },
    },
  };

  readonly chartData = computed<ChartData>(() => {
    const metric = this.data();
    const type = this.chartType();
    const series = metric?.series ?? [];
    const labels = series.map((s) => s.label);
    const values = series.map((s) => s.value);

    const isPieType = type === 'pie' || type === 'doughnut';

    if (isPieType) {
      return {
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: CHART_COLORS.slice(0, values.length),
            borderWidth: 2,
            borderColor: '#FFFFFF',
            hoverBorderWidth: 3,
            hoverOffset: 4,
          },
        ],
      };
    }

    const isLine = type === 'line';
    return {
      labels,
      datasets: [
        {
          label: metric?.label ?? this.title(),
          data: values,
          backgroundColor: isLine
            ? 'rgba(249, 115, 22, 0.08)'
            : values.map((_, i) => {
                const baseColor = CHART_COLORS[i % CHART_COLORS.length];
                return baseColor + 'CC'; // 80% opacity for bar depth
              }),
          borderColor: isLine ? CHART_COLORS[0] : values.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]),
          borderWidth: isLine ? 2.5 : 1,
          fill: isLine,
          tension: isLine ? 0.4 : 0,
          pointBackgroundColor: isLine ? '#FFFFFF' : undefined,
          pointBorderColor: isLine ? CHART_COLORS[0] : undefined,
          pointBorderWidth: isLine ? 2 : undefined,
          pointRadius: isLine ? 4 : undefined,
          pointHoverRadius: isLine ? 6 : undefined,
          borderRadius: isLine ? undefined : 6,
          borderSkipped: false as any,
        },
      ],
    };
  });

  constructor(private elementRef: ElementRef) {
    afterNextRender(() => {
      this.setupResizeObserver();
      this.applyScaleOptions();
    });
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
  }

  /**
   * Hide x/y scales for pie and doughnut charts since they are not applicable.
   */
  private applyScaleOptions(): void {
    const type = this.chartType();
    if (type === 'pie' || type === 'doughnut') {
      (this.chartOptions as any).scales = {};
    }
  }

  /**
   * ResizeObserver ensures Chart.js updates correctly when the widget
   * container is resized (e.g., gridster drag-resize).
   * This avoids the known Chart.js resize pitfall from research.
   */
  private setupResizeObserver(): void {
    this.resizeObserver = new ResizeObserver(() => {
      const directive = this.chartDirective();
      if (directive?.chart) {
        directive.chart.resize();
      }
    });
    this.resizeObserver.observe(this.elementRef.nativeElement);
  }
}

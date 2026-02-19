import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
  viewChild,
  ElementRef,
  afterNextRender,
  OnDestroy,
} from '@angular/core';
import { BaseChartDirective } from 'ng2-charts';
import {
  ChartData,
  ChartOptions,
  ChartType,
  Chart,
  TooltipItem,
} from 'chart.js';
import { FunnelController, TrapezoidElement } from 'chartjs-chart-funnel';
import {
  ReportExecutionResult,
  ReportChartType,
  ReportFilterCondition,
} from '../report.models';

// Register funnel chart type
Chart.register(FunnelController, TrapezoidElement);

/**
 * Chart.js color palette matching GlobCRM design system.
 */
const CHART_COLORS = [
  '#F97316',
  '#8B5CF6',
  '#14B8A6',
  '#3B82F6',
  '#22C55E',
  '#F59E0B',
  '#EF4444',
  '#9CA3AF',
];

const CHART_COLORS_ALPHA = CHART_COLORS.map((c) => c + '1A'); // 10% opacity

/**
 * Orange gradient palette for funnel charts (dark to light).
 */
const FUNNEL_COLORS = [
  '#EA580C',
  '#F97316',
  '#FB923C',
  '#FDBA74',
  '#FED7AA',
  '#FFEDD5',
  '#FFF7ED',
];

/**
 * Chart rendering component for report visualization.
 * Supports bar, line, pie (doughnut), and funnel chart types with polished
 * styling, smooth animations, detailed tooltips, and drill-down click handling.
 */
@Component({
  selector: 'app-report-chart',
  standalone: true,
  imports: [BaseChartDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
      position: relative;
    }

    .report-chart {
      position: relative;
      width: 100%;
      height: 100%;
      min-height: 300px;
    }

    .report-chart canvas {
      width: 100% !important;
      height: 100% !important;
    }
  `,
  template: `
    @if (chartType() !== 'table' && executionResult()) {
      <div class="report-chart" #chartContainer>
        <canvas
          baseChart
          [data]="chartData()"
          [options]="chartOptions()"
          [type]="resolvedChartType()"
        ></canvas>
      </div>
    }
  `,
})
export class ReportChartComponent implements OnDestroy {
  readonly executionResult = input<ReportExecutionResult | null>(null);
  readonly chartType = input<ReportChartType>('bar');
  readonly groupingField = input<string>('');
  readonly drillDown = output<ReportFilterCondition>();

  readonly chartDirective = viewChild(BaseChartDirective);

  private resizeObserver: ResizeObserver | null = null;

  constructor() {
    afterNextRender(() => {
      this.setupResizeObserver();
    });
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
  }

  /**
   * Map report chart type to Chart.js chart type.
   * Pie uses 'doughnut' for modern look.
   */
  readonly resolvedChartType = computed<ChartType>(() => {
    const type = this.chartType();
    if (type === 'pie') return 'doughnut';
    if (type === 'funnel') return 'funnel' as ChartType;
    return type as ChartType;
  });

  /**
   * Transform execution result rows into Chart.js data structure.
   * Extracts labels from the grouping field column and values from the first
   * numeric aggregated column.
   */
  readonly chartData = computed<ChartData>(() => {
    const result = this.executionResult();
    const type = this.chartType();
    if (!result || !result.rows.length) {
      return { labels: [], datasets: [] };
    }

    const headers = result.columnHeaders;
    const rows = result.rows;

    // The first column is typically the group label, remaining columns are data
    const labelKey = this.findLabelKey(headers, rows);
    const valueKey = this.findValueKey(headers, rows, labelKey);

    const labels = rows.map((row) => this.extractLabel(row, labelKey));
    const values = rows.map((row) => this.extractNumericValue(row, valueKey));

    if (type === 'pie') {
      return this.buildPieData(labels, values);
    }
    if (type === 'funnel') {
      return this.buildFunnelData(labels, values);
    }
    if (type === 'line') {
      return this.buildLineData(labels, values);
    }
    // Default: bar
    return this.buildBarData(labels, values);
  });

  /**
   * Build chart options based on chart type with polished styling.
   */
  readonly chartOptions = computed<ChartOptions>(() => {
    const type = this.chartType();
    const result = this.executionResult();
    const totalSum = result?.rows.reduce((sum, row) => {
      const vKey = this.findValueKey(
        result.columnHeaders,
        result.rows,
        this.findLabelKey(result.columnHeaders, result.rows),
      );
      return sum + this.extractNumericValue(row, vKey);
    }, 0) ?? 0;

    const sharedTooltip = {
      backgroundColor: 'rgba(0,0,0,0.8)',
      padding: 12,
      cornerRadius: 8,
      titleFont: { weight: 'bold' as const },
      bodyFont: { size: 13 },
    };

    const sharedLegend = {
      labels: {
        usePointStyle: true,
        padding: 16,
        font: { size: 12 },
      },
    };

    const onClick = (_event: any, elements: any[]) => {
      if (elements.length > 0) {
        const index = elements[0].index;
        const data = this.chartData();
        const label = data.labels?.[index];
        if (label != null) {
          this.drillDown.emit({
            fieldId: this.groupingField(),
            operator: 'equals',
            value: String(label),
          });
        }
      }
    };

    if (type === 'bar') {
      return {
        responsive: true,
        maintainAspectRatio: false,
        onClick,
        animation: {
          duration: 800,
          easing: 'easeOutQuart',
        },
        plugins: {
          legend: { ...sharedLegend, display: false },
          tooltip: {
            ...sharedTooltip,
            callbacks: {
              label: (ctx: TooltipItem<'bar'>) => {
                const val = ctx.parsed.y ?? 0;
                const pct = totalSum > 0 ? ((val / totalSum) * 100).toFixed(1) : '0';
                return `${ctx.label}: ${val.toLocaleString()} (${pct}%)`;
              },
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { size: 11 }, color: '#6B7280' },
            border: { display: false },
          },
          y: {
            beginAtZero: true,
            grid: { color: '#f3f4f6' },
            ticks: { font: { size: 11 }, color: '#6B7280' },
            border: { display: false },
          },
        },
      } as ChartOptions;
    }

    if (type === 'line') {
      return {
        responsive: true,
        maintainAspectRatio: false,
        onClick,
        animation: {
          duration: 800,
          easing: 'easeOutQuart',
        },
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          legend: { ...sharedLegend, display: false },
          tooltip: {
            ...sharedTooltip,
            mode: 'index',
            intersect: false,
            callbacks: {
              label: (ctx: TooltipItem<'line'>) => {
                const val = ctx.parsed.y ?? 0;
                return `${ctx.dataset.label ?? 'Value'}: ${val.toLocaleString()}`;
              },
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { size: 11 }, color: '#6B7280' },
            border: { display: false },
          },
          y: {
            beginAtZero: true,
            grid: { color: '#f3f4f6' },
            ticks: { font: { size: 11 }, color: '#6B7280' },
            border: { display: false },
          },
        },
      } as ChartOptions;
    }

    if (type === 'pie') {
      return {
        responsive: true,
        maintainAspectRatio: false,
        onClick,
        animation: {
          duration: 800,
          easing: 'easeOutQuart',
        },
        plugins: {
          legend: {
            ...sharedLegend,
            position: 'right',
          },
          tooltip: {
            ...sharedTooltip,
            callbacks: {
              label: (ctx: TooltipItem<'doughnut'>) => {
                const val = ctx.parsed;
                const pct = totalSum > 0 ? ((val / totalSum) * 100).toFixed(1) : '0';
                return `${ctx.label}: ${val.toLocaleString()} (${pct}%)`;
              },
            },
          },
        },
      } as ChartOptions;
    }

    if (type === 'funnel') {
      const firstStageValue = this.chartData().datasets?.[0]?.data?.[0] ?? 1;
      return {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        onClick,
        animation: {
          duration: 800,
          easing: 'easeOutQuart',
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            ...sharedTooltip,
            callbacks: {
              label: (ctx: any) => {
                const val = ctx.parsed.x ?? ctx.parsed;
                const pct =
                  Number(firstStageValue) > 0
                    ? ((Number(val) / Number(firstStageValue)) * 100).toFixed(1)
                    : '0';
                return `${ctx.label}: ${Number(val).toLocaleString()} (${pct}% of first stage)`;
              },
            },
          },
        },
      } as ChartOptions;
    }

    // Fallback
    return {
      responsive: true,
      maintainAspectRatio: false,
      onClick,
    } as ChartOptions;
  });

  // ---- Data builders ----

  private buildBarData(labels: string[], values: number[]): ChartData<'bar'> {
    return {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: CHART_COLORS.slice(0, values.length).map(
            (c) => c + 'CC',
          ), // 80% opacity
          hoverBackgroundColor: CHART_COLORS.slice(0, values.length),
          borderRadius: 6,
          borderSkipped: false,
          barPercentage: 0.7,
        },
      ],
    };
  }

  private buildLineData(
    labels: string[],
    values: number[],
  ): ChartData<'line'> {
    return {
      labels,
      datasets: [
        {
          label: 'Value',
          data: values,
          borderColor: CHART_COLORS[0],
          backgroundColor: CHART_COLORS_ALPHA[0],
          fill: true,
          tension: 0.4,
          pointBackgroundColor: CHART_COLORS[0],
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
          borderWidth: 2,
        },
      ],
    };
  }

  private buildPieData(
    labels: string[],
    values: number[],
  ): ChartData<'doughnut'> {
    return {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: CHART_COLORS.slice(0, values.length),
          hoverBackgroundColor: CHART_COLORS.slice(0, values.length).map(
            (c) => c + 'DD',
          ),
          borderWidth: 2,
          borderColor: '#ffffff',
          hoverOffset: 8,
        },
      ],
    } as ChartData<'doughnut'>;
  }

  private buildFunnelData(labels: string[], values: number[]): ChartData {
    return {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: FUNNEL_COLORS.slice(0, values.length),
        },
      ],
    };
  }

  // ---- Helpers ----

  /**
   * Find the key used for labels. Prefers the grouping field, falls back to
   * the first non-numeric column.
   */
  private findLabelKey(
    headers: string[],
    rows: Record<string, any>[],
  ): string {
    if (headers.length === 0 || rows.length === 0) return '';
    // Use the first header as label key by default (usually the group column)
    return headers[0];
  }

  /**
   * Find the key used for numeric values. Picks the first column after the
   * label key that contains numeric data.
   */
  private findValueKey(
    headers: string[],
    rows: Record<string, any>[],
    labelKey: string,
  ): string {
    if (rows.length === 0) return '';

    // The row keys may differ from headers -- try header-derived keys first
    const rowKeys = Object.keys(rows[0]);

    for (const key of rowKeys) {
      if (key === labelKey) continue;
      const sample = rows[0][key];
      if (typeof sample === 'number' || !isNaN(Number(sample))) {
        return key;
      }
    }
    // Fallback: second header or last key
    return headers.length > 1 ? headers[1] : rowKeys[rowKeys.length - 1] ?? '';
  }

  private extractLabel(row: Record<string, any>, key: string): string {
    const val = row[key];
    if (val == null) return '(empty)';
    return String(val);
  }

  private extractNumericValue(row: Record<string, any>, key: string): number {
    const val = row[key];
    if (val == null) return 0;
    const num = Number(val);
    return isNaN(num) ? 0 : num;
  }

  private setupResizeObserver(): void {
    const container = document.querySelector('.report-chart');
    if (!container) return;

    this.resizeObserver = new ResizeObserver(() => {
      const directive = this.chartDirective();
      if (directive?.chart) {
        directive.chart.resize();
      }
    });
    this.resizeObserver.observe(container);
  }
}

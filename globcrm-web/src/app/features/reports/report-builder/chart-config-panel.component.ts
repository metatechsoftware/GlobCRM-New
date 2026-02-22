import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  signal,
  effect,
} from '@angular/core';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { ReportChartConfig, ReportChartType } from '../report.models';

interface ChartTypeOption {
  value: ReportChartType;
  label: string;
  icon: string;
}

const CHART_TYPE_OPTIONS: ChartTypeOption[] = [
  { value: 'table', label: 'Table', icon: 'grid_on' },
  { value: 'bar', label: 'Bar', icon: 'bar_chart' },
  { value: 'line', label: 'Line', icon: 'show_chart' },
  { value: 'pie', label: 'Pie', icon: 'pie_chart' },
  { value: 'funnel', label: 'Funnel', icon: 'filter_alt' },
];

const DEFAULT_CHART_CONFIG: ReportChartConfig = {
  chartType: 'table',
  showLegend: true,
  showDataLabels: false,
};

/**
 * Chart configuration panel for selecting visualization type and display options.
 * Provides chart type toggle (table/bar/line/pie/funnel) with legend and data label toggles.
 */
@Component({
  selector: 'app-chart-config-panel',
  standalone: true,
  imports: [
    MatExpansionModule,
    MatButtonToggleModule,
    MatSlideToggleModule,
    MatIconModule,
    FormsModule,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-expansion-panel class="chart-config-panel">
      <mat-expansion-panel-header>
        <mat-panel-title>
          <mat-icon>insert_chart</mat-icon>
          {{ 'reports.panels.visualization' | transloco }}
        </mat-panel-title>
      </mat-expansion-panel-header>

      <div class="chart-config-panel__content">
        <!-- Chart Type Selection -->
        <mat-button-toggle-group
          [value]="chartTypeValue()"
          (change)="onChartTypeChange($event.value)"
          class="chart-config-panel__type-group"
        >
          @for (option of chartTypeOptions; track option.value) {
            <mat-button-toggle [value]="option.value" class="chart-config-panel__type-toggle">
              <mat-icon>{{ option.icon }}</mat-icon>
              <span class="chart-config-panel__type-label">{{ 'reports.card.chartTypes.' + option.value | transloco }}</span>
            </mat-button-toggle>
          }
        </mat-button-toggle-group>

        <!-- Display Options -->
        <div class="chart-config-panel__toggles">
          <div class="chart-config-panel__toggle-row">
            <span>{{ 'reports.panels.showLegend' | transloco }}</span>
            <mat-slide-toggle
              [checked]="showLegendValue()"
              (change)="onShowLegendChange($event.checked)"
              color="primary"
            ></mat-slide-toggle>
          </div>

          <div class="chart-config-panel__toggle-row">
            <span>{{ 'reports.panels.showDataLabels' | transloco }}</span>
            <mat-slide-toggle
              [checked]="showDataLabelsValue()"
              (change)="onShowDataLabelsChange($event.checked)"
              color="primary"
            ></mat-slide-toggle>
          </div>
        </div>
      </div>
    </mat-expansion-panel>
  `,
  styles: `
    .chart-config-panel {
      &__content {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      &__type-group {
        display: flex;
        width: 100%;
        border: 1px solid var(--color-border, #E8E8E6);
        border-radius: var(--radius-md, 8px);
        overflow: hidden;
      }

      &__type-toggle {
        flex: 1;
      }

      &__type-label {
        display: block;
        font-size: 10px;
        margin-top: 2px;
      }

      &__toggles {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      &__toggle-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: var(--text-sm, 13px);
        color: var(--color-text, #1A1A1A);
        padding: 4px 0;
      }
    }
  `,
})
export class ChartConfigPanelComponent {
  readonly chartConfig = input<ReportChartConfig | null>(null);
  readonly chartConfigChange = output<ReportChartConfig>();

  readonly chartTypeOptions = CHART_TYPE_OPTIONS;

  // Local signals for state tracking
  readonly chartTypeValue = signal<ReportChartType>('table');
  readonly showLegendValue = signal(true);
  readonly showDataLabelsValue = signal(false);

  constructor() {
    // Sync input to local signals for edit mode pre-population
    effect(() => {
      const config = this.chartConfig();
      if (config) {
        this.chartTypeValue.set(config.chartType);
        this.showLegendValue.set(config.showLegend);
        this.showDataLabelsValue.set(config.showDataLabels);
      }
    });
  }

  onChartTypeChange(value: ReportChartType): void {
    this.chartTypeValue.set(value);
    this.emitConfig();
  }

  onShowLegendChange(checked: boolean): void {
    this.showLegendValue.set(checked);
    this.emitConfig();
  }

  onShowDataLabelsChange(checked: boolean): void {
    this.showDataLabelsValue.set(checked);
    this.emitConfig();
  }

  private emitConfig(): void {
    this.chartConfigChange.emit({
      chartType: this.chartTypeValue(),
      showLegend: this.showLegendValue(),
      showDataLabels: this.showDataLabelsValue(),
    });
  }
}

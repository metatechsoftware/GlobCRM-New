import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { DealPipelineSummaryDto } from './summary.models';

@Component({
  selector: 'app-deal-pipeline-chart',
  standalone: true,
  imports: [MatIconModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (hasDeals()) {
      <div class="pipeline-chart-container">
        <div class="chart-section">
          <div class="donut-chart" [style.background]="chartSegments()"></div>
          <div class="chart-center">
            <span class="chart-center-value">{{ pipeline().totalDeals }}</span>
            <span class="chart-center-label">deals</span>
          </div>
        </div>
        <div class="chart-stats">
          <div class="stat stat-value-pill">
            <span class="stat-value">{{ formattedTotalValue() }}</span>
            <span class="stat-label">{{ 'common.summaryTab.dealPipelineChart.totalValue' | transloco }}</span>
          </div>
          <div class="stat stat-rate-pill">
            <span class="stat-value">{{ formattedWinRate() }}</span>
            <span class="stat-label">{{ 'common.summaryTab.dealPipelineChart.winRate' | transloco }}</span>
          </div>
        </div>
        <div class="chart-legend">
          @for (stage of pipeline().dealsByStage; track stage.stageName) {
            <div class="legend-item">
              <span class="legend-dot" [style.backgroundColor]="stage.color"></span>
              <span class="legend-label">{{ stage.stageName }}</span>
              <span class="legend-count">{{ stage.count }}</span>
            </div>
          }
        </div>
      </div>
    } @else {
      <div class="pipeline-empty">
        <mat-icon>trending_up</mat-icon>
        <span>{{ 'common.summaryTab.dealPipelineChart.noDeals' | transloco }}</span>
      </div>
    }
  `,
  styles: [`
    .pipeline-chart-container {
      display: flex;
      gap: var(--space-6, 24px);
      align-items: center;
      flex-wrap: wrap;
    }

    .chart-section {
      position: relative;
      width: 140px;
      height: 140px;
      flex-shrink: 0;
      filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.08));
    }

    .donut-chart {
      width: 140px;
      height: 140px;
      border-radius: 50%;
      position: relative;
      mask: radial-gradient(circle at center, transparent 44px, black 44px);
      -webkit-mask: radial-gradient(circle at center, transparent 44px, black 44px);
    }

    .chart-center {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }

    .chart-center-value {
      font-size: 28px;
      font-weight: var(--font-bold, 700);
      color: var(--color-text, #212121);
      line-height: 1;
    }

    .chart-center-label {
      font-size: var(--text-xs, 12px);
      color: var(--color-text-muted, #9CA3AF);
      margin-top: 2px;
    }

    .chart-stats {
      display: flex;
      flex-direction: column;
      gap: var(--space-3, 12px);
    }

    .stat {
      display: flex;
      flex-direction: column;
      padding: var(--space-2, 8px) var(--space-3, 12px);
      border-radius: var(--radius-md, 8px);
    }

    .stat-value-pill {
      background: var(--color-success-soft, #F0FDF4);

      .stat-value {
        color: var(--color-success-text, #15803D);
      }
    }

    .stat-rate-pill {
      background: var(--color-info-soft, #EFF6FF);

      .stat-value {
        color: var(--color-info-text, #1D4ED8);
      }
    }

    .stat-value {
      font-size: var(--text-xl, 20px);
      font-weight: var(--font-semibold, 600);
    }

    .stat-label {
      font-size: var(--text-xs, 12px);
      color: var(--color-text-secondary, #6B7280);
    }

    .chart-legend {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2, 8px) var(--space-4, 16px);
      width: 100%;
    }

    .legend-item {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1-5, 6px);
      font-size: var(--text-sm, 13px);
      color: var(--color-text, #212121);
    }

    .legend-dot {
      width: 12px;
      height: 12px;
      border-radius: var(--radius-sm, 4px);
      flex-shrink: 0;
    }

    .legend-label {
      color: var(--color-text-secondary, #6B7280);
    }

    .legend-count {
      font-weight: var(--font-semibold, 600);
    }

    .pipeline-empty {
      display: flex;
      align-items: center;
      gap: var(--space-2, 8px);
      color: var(--color-text-muted, #9CA3AF);
      padding: var(--space-4, 16px) 0;
    }
  `],
})
export class DealPipelineChartComponent {
  readonly pipeline = input.required<DealPipelineSummaryDto>();

  readonly hasDeals = computed(() => this.pipeline().totalDeals > 0);

  readonly chartSegments = computed(() => {
    const stages = this.pipeline().dealsByStage;
    const total = this.pipeline().totalDeals;
    if (total === 0) return 'transparent';

    const segments: string[] = [];
    let currentAngle = 0;

    for (const stage of stages) {
      const percentage = (stage.count / total) * 360;
      const endAngle = currentAngle + percentage;
      segments.push(`${stage.color} ${currentAngle}deg ${endAngle}deg`);
      currentAngle = endAngle;
    }

    return `conic-gradient(${segments.join(', ')})`;
  });

  readonly formattedTotalValue = computed(() => {
    const value = this.pipeline().totalValue;
    if (value >= 1_000_000) {
      return `$${(value / 1_000_000).toFixed(1)}M`;
    }
    if (value >= 1_000) {
      return `$${(value / 1_000).toFixed(0)}K`;
    }
    return `$${value.toFixed(0)}`;
  });

  readonly formattedWinRate = computed(() => {
    const rate = this.pipeline().winRate;
    return `${Math.round(rate * 100)}%`;
  });
}

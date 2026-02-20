import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { DealPipelineSummaryDto } from './summary.models';

@Component({
  selector: 'app-deal-pipeline-chart',
  standalone: true,
  imports: [MatIconModule],
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
          <div class="stat">
            <span class="stat-value">{{ formattedTotalValue() }}</span>
            <span class="stat-label">Total Value</span>
          </div>
          <div class="stat">
            <span class="stat-value">{{ formattedWinRate() }}</span>
            <span class="stat-label">Win Rate</span>
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
        <span>No deals yet</span>
      </div>
    }
  `,
  styles: [`
    .pipeline-chart-container {
      display: flex;
      gap: 24px;
      align-items: center;
      flex-wrap: wrap;
    }

    .chart-section {
      position: relative;
      width: 120px;
      height: 120px;
      flex-shrink: 0;
    }

    .donut-chart {
      width: 120px;
      height: 120px;
      border-radius: 50%;
      position: relative;
      mask: radial-gradient(circle at center, transparent 38px, black 38px);
      -webkit-mask: radial-gradient(circle at center, transparent 38px, black 38px);
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
      font-size: 24px;
      font-weight: 700;
      color: var(--text-primary, #212121);
      line-height: 1;
    }

    .chart-center-label {
      font-size: 11px;
      color: var(--text-secondary, #666);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .chart-stats {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .stat {
      display: flex;
      flex-direction: column;
    }

    .stat-value {
      font-size: 20px;
      font-weight: 600;
      color: var(--text-primary, #212121);
    }

    .stat-label {
      font-size: 12px;
      color: var(--text-secondary, #666);
      text-transform: uppercase;
    }

    .chart-legend {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 16px;
      width: 100%;
    }

    .legend-item {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      color: var(--text-primary, #212121);
    }

    .legend-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .legend-label {
      color: var(--text-secondary, #666);
    }

    .legend-count {
      font-weight: 600;
    }

    .pipeline-empty {
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--text-secondary, #666);
      padding: 16px 0;
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

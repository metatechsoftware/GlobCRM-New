import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MyDayPipelineStageDto } from '../../my-day.models';

@Component({
  selector: 'app-pipeline-widget',
  standalone: true,
  imports: [MatCardModule, MatIconModule, MatTooltipModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-card class="pipeline-widget">
      <mat-card-header>
        <mat-icon class="pipeline-widget__header-icon">handshake</mat-icon>
        <mat-card-title>My Pipeline</mat-card-title>
      </mat-card-header>

      <mat-card-content>
        @if (isLoading()) {
          <div class="pipeline-widget__loading">
            <div class="pipeline-widget__shimmer-bar"></div>
            <div class="pipeline-widget__shimmer-legend">
              @for (i of [1, 2, 3]; track i) {
                <div class="pipeline-widget__shimmer-legend-row"></div>
              }
            </div>
          </div>
        } @else if (stages().length === 0) {
          <div class="pipeline-widget__empty">
            <mat-icon class="pipeline-widget__empty-icon">shopping_cart</mat-icon>
            <span class="pipeline-widget__empty-text">No active deals</span>
          </div>
        } @else {
          <!-- Horizontal stacked bar chart -->
          <div class="pipeline-widget__bar-container">
            @for (stage of stages(); track stage.stageName) {
              <div class="pipeline-widget__bar-segment"
                   [style.flex]="stage.dealCount"
                   [style.background-color]="stage.color"
                   [matTooltip]="stage.stageName + ': ' + stage.dealCount + ' deals - ' + formatCurrency(stage.totalValue)">
              </div>
            }
          </div>

          <!-- Legend -->
          <div class="pipeline-widget__legend">
            @for (stage of stages(); track stage.stageName) {
              <div class="pipeline-widget__legend-item">
                <span class="pipeline-widget__legend-dot" [style.background-color]="stage.color"></span>
                <span class="pipeline-widget__legend-name">{{ stage.stageName }}</span>
                <span class="pipeline-widget__legend-count">{{ stage.dealCount }}</span>
              </div>
            }
          </div>

          <!-- Summary -->
          <div class="pipeline-widget__summary">
            {{ dealCount() }} deals &middot; {{ formattedTotalValue() }} total value
          </div>
        }
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    .pipeline-widget {
      width: 100%;
      height: fit-content;
    }

    mat-card-header {
      display: flex;
      align-items: center;
      gap: var(--space-2, 8px);
      margin-bottom: var(--space-3, 12px);
    }

    .pipeline-widget__header-icon {
      color: var(--color-primary);
    }

    mat-card-title {
      margin: 0;
      font-size: var(--text-lg, 1.125rem);
      font-weight: var(--font-semibold, 600);
    }

    /* Stacked bar chart */
    .pipeline-widget__bar-container {
      display: flex;
      height: 24px;
      border-radius: 12px;
      overflow: hidden;
      margin-bottom: var(--space-3, 12px);
    }

    .pipeline-widget__bar-segment {
      min-width: 4px;
      transition: opacity 0.2s ease;
      cursor: default;

      &:hover {
        opacity: 0.8;
      }
    }

    /* Legend */
    .pipeline-widget__legend {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2, 8px) var(--space-4, 16px);
      margin-bottom: var(--space-3, 12px);
    }

    .pipeline-widget__legend-item {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: var(--text-xs, 0.75rem);
    }

    .pipeline-widget__legend-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .pipeline-widget__legend-name {
      color: var(--color-text-secondary);
    }

    .pipeline-widget__legend-count {
      font-weight: var(--font-semibold, 600);
      color: var(--color-text);
    }

    /* Summary */
    .pipeline-widget__summary {
      font-size: var(--text-sm, 0.875rem);
      font-weight: var(--font-medium, 500);
      color: var(--color-text-secondary);
      padding-top: var(--space-2, 8px);
      border-top: 1px solid var(--color-border-subtle);
    }

    /* Empty state */
    .pipeline-widget__empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-2, 8px);
      padding: var(--space-8, 32px) 0;
    }

    .pipeline-widget__empty-icon {
      font-size: 40px;
      width: 40px;
      height: 40px;
      color: var(--color-text-muted);
      opacity: 0.5;
    }

    .pipeline-widget__empty-text {
      font-size: var(--text-sm, 0.875rem);
      color: var(--color-text-muted);
    }

    /* Loading state */
    .pipeline-widget__loading {
      display: flex;
      flex-direction: column;
      gap: var(--space-3, 12px);
    }

    .pipeline-widget__shimmer-bar {
      height: 24px;
      border-radius: 12px;
      background: linear-gradient(
        90deg,
        var(--color-border-subtle) 25%,
        var(--color-primary-soft) 37%,
        var(--color-border-subtle) 63%
      );
      background-size: 200% 100%;
      animation: shimmer 1.8s ease-in-out infinite;
    }

    .pipeline-widget__shimmer-legend {
      display: flex;
      flex-direction: column;
      gap: var(--space-2, 8px);
    }

    .pipeline-widget__shimmer-legend-row {
      height: 16px;
      width: 60%;
      border-radius: var(--radius-sm, 4px);
      background: linear-gradient(
        90deg,
        var(--color-border-subtle) 25%,
        var(--color-primary-soft) 37%,
        var(--color-border-subtle) 63%
      );
      background-size: 200% 100%;
      animation: shimmer 1.8s ease-in-out infinite;

      &:nth-child(2) { width: 50%; animation-delay: 100ms; }
      &:nth-child(3) { width: 45%; animation-delay: 200ms; }
    }

    @keyframes shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
  `],
})
export class PipelineWidgetComponent {
  readonly stages = input<MyDayPipelineStageDto[]>([]);
  readonly totalValue = input<number>(0);
  readonly dealCount = input<number>(0);
  readonly isLoading = input<boolean>(false);

  readonly formattedTotalValue = computed(() => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(this.totalValue());
  });

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  }
}

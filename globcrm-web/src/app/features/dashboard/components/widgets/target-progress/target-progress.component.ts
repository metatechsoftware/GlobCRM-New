import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MetricResultDto, TargetDto } from '../../../models/dashboard.models';

/**
 * Target progress widget shows current vs target with a circular
 * progress indicator using CSS conic-gradient.
 * Color indicates status: green >= 100%, yellow >= 50%, red < 50%.
 */
@Component({
  selector: 'app-target-progress',
  standalone: true,
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
      height: 100%;
    }

    .target-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-3, 12px);
      padding: var(--space-4, 16px);
      height: 100%;
      box-sizing: border-box;
    }

    .target-card__ring {
      position: relative;
      width: 100px;
      height: 100px;
      border-radius: var(--radius-full, 9999px);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .target-card__ring-inner {
      position: absolute;
      inset: 8px;
      border-radius: var(--radius-full, 9999px);
      background: var(--color-surface, #FFFFFF);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .target-card__ring-percent {
      font-size: var(--text-lg, 1.125rem);
      font-weight: var(--font-bold, 700);
    }

    .target-card__ring-percent--green {
      color: var(--color-success-text, #3D7940);
    }

    .target-card__ring-percent--yellow {
      color: var(--color-warning-text, #8C6D1A);
    }

    .target-card__ring-percent--red {
      color: var(--color-danger-text, #993D3D);
    }

    .target-card__name {
      font-size: var(--text-sm, 0.8125rem);
      font-weight: var(--font-semibold, 600);
      color: var(--color-text, #3D2E22);
      text-align: center;
      margin: 0;
      line-height: var(--leading-tight, 1.25);
    }

    .target-card__values {
      display: flex;
      gap: var(--space-2, 8px);
      align-items: baseline;
      font-size: var(--text-sm, 0.8125rem);
    }

    .target-card__current {
      font-weight: var(--font-bold, 700);
      color: var(--color-text, #3D2E22);
    }

    .target-card__separator {
      color: var(--color-text-muted, #A89888);
    }

    .target-card__target-val {
      color: var(--color-text-secondary, #7A6B5D);
    }

    .target-card__period {
      font-size: var(--text-xs, 0.75rem);
      color: var(--color-text-muted, #A89888);
      text-transform: capitalize;
    }

    .target-card__empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      gap: var(--space-2, 8px);
      color: var(--color-text-muted, #A89888);
    }

    .target-card__empty mat-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
      opacity: 0.5;
    }
  `,
  template: `
    @if (target()) {
      <div class="target-card">
        <div
          class="target-card__ring"
          [style.background]="ringGradient()"
        >
          <div class="target-card__ring-inner">
            <span class="target-card__ring-percent" [class]="percentColorClass()">
              {{ progressPercent() }}%
            </span>
          </div>
        </div>

        <p class="target-card__name">{{ target()!.name }}</p>

        <div class="target-card__values">
          <span class="target-card__current">{{ formattedCurrent() }}</span>
          <span class="target-card__separator">/</span>
          <span class="target-card__target-val">{{ formattedTarget() }}</span>
        </div>

        <span class="target-card__period">{{ target()!.period }}</span>
      </div>
    } @else {
      <div class="target-card__empty">
        <mat-icon>track_changes</mat-icon>
        <span>No target configured</span>
      </div>
    }
  `,
})
export class TargetProgressComponent {
  readonly target = input<TargetDto | null>(null);
  readonly data = input<MetricResultDto | null>(null);

  readonly progressPercent = computed(() => {
    const t = this.target();
    if (!t || t.targetValue === 0) return 0;
    return Math.round((t.currentValue / t.targetValue) * 100);
  });

  readonly statusColor = computed(() => {
    const pct = this.progressPercent();
    if (pct >= 100) return 'green';
    if (pct >= 50) return 'yellow';
    return 'red';
  });

  readonly ringGradient = computed(() => {
    const pct = Math.min(this.progressPercent(), 100);
    const color = this.statusColor();
    const fillColor =
      color === 'green'
        ? 'var(--color-success, #6AAE6E)'
        : color === 'yellow'
          ? 'var(--color-warning, #D4A840)'
          : 'var(--color-danger, #CC6060)';
    const trackColor = 'var(--color-border-subtle, #F0E8E0)';
    return `conic-gradient(${fillColor} ${pct * 3.6}deg, ${trackColor} ${pct * 3.6}deg)`;
  });

  readonly percentColorClass = computed(() => {
    return `target-card__ring-percent target-card__ring-percent--${this.statusColor()}`;
  });

  readonly formattedCurrent = computed(() => {
    const t = this.target();
    if (!t) return '0';
    return new Intl.NumberFormat('en-US').format(t.currentValue);
  });

  readonly formattedTarget = computed(() => {
    const t = this.target();
    if (!t) return '0';
    return new Intl.NumberFormat('en-US').format(t.targetValue);
  });
}

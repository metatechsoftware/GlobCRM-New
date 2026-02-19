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
    @keyframes ringFill {
      from { stroke-dashoffset: 314; }
    }

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
      width: 110px;
      height: 110px;
      flex-shrink: 0;
    }

    .target-card__ring svg {
      width: 110px;
      height: 110px;
      transform: rotate(-90deg);
    }

    .target-card__ring-track {
      fill: none;
      stroke: var(--color-border-subtle, #F3F4F6);
      stroke-width: 8;
    }

    .target-card__ring-fill {
      fill: none;
      stroke-width: 8;
      stroke-linecap: round;
      transition: stroke-dashoffset 800ms var(--ease-out, cubic-bezier(0, 0, 0.2, 1));
      animation: ringFill 800ms var(--ease-out, cubic-bezier(0, 0, 0.2, 1)) both;
      filter: drop-shadow(0 0 4px currentColor);
    }

    .target-card__ring-fill--green {
      stroke: var(--color-success, #22C55E);
      color: rgba(34, 197, 94, 0.3);
    }

    .target-card__ring-fill--yellow {
      stroke: var(--color-warning, #F59E0B);
      color: rgba(245, 158, 11, 0.3);
    }

    .target-card__ring-fill--red {
      stroke: var(--color-danger, #EF4444);
      color: rgba(239, 68, 68, 0.3);
    }

    .target-card__ring-text {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }

    .target-card__ring-percent {
      font-size: var(--text-xl, 1.25rem);
      font-weight: var(--font-bold, 700);
      font-variant-numeric: tabular-nums;
      line-height: 1;
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

    .target-card__ring-sublabel {
      font-size: 9px;
      font-weight: var(--font-semibold, 600);
      color: var(--color-text-muted, #9CA3AF);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-top: 2px;
    }

    .target-card__name {
      font-size: var(--text-sm, 0.8125rem);
      font-weight: var(--font-semibold, 600);
      color: var(--color-text, #111827);
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
      color: var(--color-text, #111827);
      font-variant-numeric: tabular-nums;
    }

    .target-card__separator {
      color: var(--color-text-muted, #9CA3AF);
    }

    .target-card__target-val {
      color: var(--color-text-secondary, #6B7280);
      font-variant-numeric: tabular-nums;
    }

    .target-card__period {
      font-size: var(--text-xs, 0.75rem);
      color: var(--color-text-muted, #9CA3AF);
      text-transform: capitalize;
      font-weight: var(--font-medium, 500);
    }

    .target-card__empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      gap: var(--space-2, 8px);
      color: var(--color-text-muted, #9CA3AF);
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
        <div class="target-card__ring">
          <svg viewBox="0 0 110 110">
            <circle class="target-card__ring-track" cx="55" cy="55" r="50" />
            <circle
              class="target-card__ring-fill"
              [class]="ringFillClass()"
              cx="55" cy="55" r="50"
              [attr.stroke-dasharray]="314"
              [attr.stroke-dashoffset]="ringDashOffset()"
            />
          </svg>
          <div class="target-card__ring-text">
            <span class="target-card__ring-percent" [class]="percentColorClass()">
              {{ progressPercent() }}%
            </span>
            <span class="target-card__ring-sublabel">complete</span>
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

  readonly ringDashOffset = computed(() => {
    const pct = Math.min(this.progressPercent(), 100);
    const circumference = 314; // 2 * PI * 50
    return circumference - (circumference * pct) / 100;
  });

  readonly ringFillClass = computed(() => {
    return `target-card__ring-fill target-card__ring-fill--${this.statusColor()}`;
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

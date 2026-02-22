import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';

/**
 * KPI metric card widget.
 * Displays a metric value with icon, optional target progress bar,
 * and formatted value (number, currency, or percent).
 */
@Component({
  selector: 'app-kpi-card',
  standalone: true,
  imports: [MatIconModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    @keyframes progressFill {
      from { width: 0; }
    }

    :host {
      display: block;
      height: 100%;
    }

    .kpi-card {
      display: flex;
      flex-direction: column;
      gap: var(--space-3, 12px);
      padding: var(--space-4, 16px);
      height: 100%;
      box-sizing: border-box;
    }

    .kpi-card__header {
      display: flex;
      align-items: center;
      gap: var(--space-3, 12px);
    }

    .kpi-card__icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 42px;
      height: 42px;
      min-width: 42px;
      border-radius: var(--radius-md, 8px);
      font-size: 20px;
      box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.06);
    }

    .kpi-card__icon[data-color="primary"] {
      background: var(--color-primary-soft, #FDEBD4);
      color: var(--color-primary-text, #C2410C);
    }

    .kpi-card__icon[data-color="secondary"] {
      background: var(--color-secondary-soft, #F0EAF7);
      color: var(--color-secondary-text, #6B5399);
    }

    .kpi-card__icon[data-color="accent"] {
      background: var(--color-accent-soft, #E0F2EB);
      color: var(--color-accent-text, #4A7D66);
    }

    .kpi-card__icon[data-color="success"] {
      background: var(--color-success-soft, #E4F3E5);
      color: var(--color-success-text, #3D7940);
    }

    .kpi-card__icon[data-color="warning"] {
      background: var(--color-warning-soft, #FDF5E0);
      color: var(--color-warning-text, #8C6D1A);
    }

    .kpi-card__icon[data-color="danger"] {
      background: var(--color-danger-soft, #FBEAEA);
      color: var(--color-danger-text, #993D3D);
    }

    .kpi-card__icon[data-color="info"] {
      background: var(--color-info-soft, #E4F0FB);
      color: var(--color-info-text, #3D6B8C);
    }

    .kpi-card__title {
      font-size: var(--text-xs, 0.75rem);
      font-weight: var(--font-semibold, 600);
      color: var(--color-text-muted, #9CA3AF);
      margin: 0;
      line-height: var(--leading-tight, 1.25);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .kpi-card__value {
      font-size: var(--text-3xl, 1.875rem);
      font-weight: var(--font-bold, 700);
      color: var(--color-text, #111827);
      margin: 0;
      line-height: var(--leading-tight, 1.25);
      font-variant-numeric: tabular-nums;
      letter-spacing: -0.02em;
    }

    .kpi-card__progress {
      margin-top: auto;
    }

    .kpi-card__progress-bar {
      width: 100%;
      height: 6px;
      background: var(--color-border-subtle, #F3F4F6);
      border-radius: var(--radius-full, 9999px);
      overflow: hidden;
    }

    .kpi-card__progress-fill {
      height: 100%;
      background: linear-gradient(90deg, var(--color-primary, #F97316), var(--color-primary-hover, #EA580C));
      border-radius: var(--radius-full, 9999px);
      transition: width var(--duration-slower, 500ms) var(--ease-out);
      animation: progressFill 800ms var(--ease-out) both;
      box-shadow: 0 0 8px rgba(249, 115, 22, 0.3);
    }

    .kpi-card__progress-meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: var(--space-1, 4px);
    }

    .kpi-card__progress-text {
      font-size: var(--text-xs, 0.75rem);
      color: var(--color-text-muted, #9CA3AF);
    }

    .kpi-card__progress-pct {
      font-size: var(--text-xs, 0.75rem);
      font-weight: var(--font-semibold, 600);
      color: var(--color-primary-text, #C2410C);
      font-variant-numeric: tabular-nums;
    }
  `,
  template: `
    <div class="kpi-card">
      <div class="kpi-card__header">
        <div class="kpi-card__icon" [attr.data-color]="color()">
          <mat-icon>{{ icon() }}</mat-icon>
        </div>
        <p class="kpi-card__title">{{ title() }}</p>
      </div>

      <p class="kpi-card__value">{{ formattedValue() }}</p>

      @if (target() !== null) {
        <div class="kpi-card__progress">
          <div class="kpi-card__progress-bar">
            <div
              class="kpi-card__progress-fill"
              [style.width.%]="progressPercent()"
            ></div>
          </div>
          <div class="kpi-card__progress-meta">
            <span class="kpi-card__progress-text">{{ 'dashboard.widgets.ofTarget' | transloco }}</span>
            <span class="kpi-card__progress-pct">{{ progressPercent() }}%</span>
          </div>
        </div>
      }
    </div>
  `,
})
export class KpiCardComponent {
  readonly title = input<string>('');
  readonly value = input<number>(0);
  readonly icon = input<string>('trending_up');
  readonly color = input<string>('primary');
  readonly format = input<'number' | 'currency' | 'percent'>('number');
  readonly target = input<number | null>(null);

  readonly formattedValue = computed(() => {
    const val = this.value();
    switch (this.format()) {
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(val);
      case 'percent':
        return new Intl.NumberFormat('en-US', {
          style: 'percent',
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        }).format(val / 100);
      default:
        return new Intl.NumberFormat('en-US').format(val);
    }
  });

  readonly progressPercent = computed(() => {
    const t = this.target();
    if (t === null || t === 0) return 0;
    return Math.min(Math.round((this.value() / t) * 100), 100);
  });
}

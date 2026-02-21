import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { MetricResultDto } from '../../../models/dashboard.models';

interface LeaderboardEntry {
  rank: number;
  name: string;
  initial: string;
  value: string;
  barPercent: number;
}

/**
 * Leaderboard widget displays a ranked user list with values.
 * Top 3 entries get gold/silver/bronze color accents.
 * Shows up to 10 entries from series data.
 */
@Component({
  selector: 'app-leaderboard',
  standalone: true,
  imports: [MatIconModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
      height: 100%;
      overflow: auto;
    }

    .leaderboard {
      display: flex;
      flex-direction: column;
      gap: 0;
      padding: var(--space-1, 4px) 0;
    }

    .leaderboard__entry {
      display: flex;
      align-items: center;
      gap: var(--space-3, 12px);
      padding: var(--space-2, 8px) var(--space-4, 16px);
      position: relative;
      transition: background var(--duration-fast, 100ms);
    }

    .leaderboard__entry:hover {
      background: var(--color-highlight, rgba(249, 115, 22, 0.06));
    }

    .leaderboard__bar-bg {
      position: absolute;
      left: var(--space-4, 16px);
      right: var(--space-4, 16px);
      bottom: 2px;
      height: 3px;
      border-radius: var(--radius-full, 9999px);
      background: var(--color-border-subtle, #F3F4F6);
      overflow: hidden;
    }

    .leaderboard__bar-fill {
      height: 100%;
      border-radius: var(--radius-full, 9999px);
      background: linear-gradient(90deg, var(--color-primary, #F97316), var(--color-primary-hover, #EA580C));
      opacity: 0.3;
      transition: width var(--duration-slower, 500ms) var(--ease-out);
    }

    .leaderboard__avatar {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      min-width: 32px;
      border-radius: var(--radius-full, 9999px);
      font-size: var(--text-xs, 0.75rem);
      font-weight: var(--font-bold, 700);
      color: #FFFFFF;
      text-transform: uppercase;
    }

    .leaderboard__avatar--gold {
      background: linear-gradient(135deg, #F59E0B, #D97706);
      box-shadow: 0 2px 6px rgba(245, 158, 11, 0.35);
    }

    .leaderboard__avatar--silver {
      background: linear-gradient(135deg, #9CA3AF, #6B7280);
      box-shadow: 0 2px 6px rgba(107, 114, 128, 0.3);
    }

    .leaderboard__avatar--bronze {
      background: linear-gradient(135deg, #D97706, #92400E);
      box-shadow: 0 2px 6px rgba(146, 64, 14, 0.3);
    }

    .leaderboard__avatar--default {
      background: linear-gradient(135deg, var(--color-border-strong, #D1D5DB), var(--color-text-muted, #9CA3AF));
    }

    .leaderboard__info {
      flex: 1;
      min-width: 0;
    }

    .leaderboard__name {
      display: block;
      font-size: var(--text-sm, 0.8125rem);
      font-weight: var(--font-medium, 500);
      color: var(--color-text, #111827);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      line-height: var(--leading-tight, 1.25);
    }

    .leaderboard__rank-label {
      font-size: 10px;
      color: var(--color-text-muted, #9CA3AF);
      font-weight: var(--font-medium, 500);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .leaderboard__value {
      font-size: var(--text-sm, 0.8125rem);
      font-weight: var(--font-bold, 700);
      color: var(--color-text, #111827);
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
    }

    .leaderboard__empty {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: var(--color-text-muted, #9CA3AF);
      font-size: var(--text-sm, 0.8125rem);
      padding: var(--space-4, 16px);
    }
  `,
  template: `
    @if (entries().length > 0) {
      <div class="leaderboard">
        @for (entry of entries(); track entry.rank) {
          <div class="leaderboard__entry">
            <div class="leaderboard__avatar" [class]="avatarClass(entry.rank)">
              {{ entry.initial }}
            </div>
            <div class="leaderboard__info">
              <span class="leaderboard__name">{{ entry.name }}</span>
              <span class="leaderboard__rank-label">#{{ entry.rank }}</span>
            </div>
            <span class="leaderboard__value">{{ entry.value }}</span>
            <div class="leaderboard__bar-bg">
              <div class="leaderboard__bar-fill" [style.width.%]="entry.barPercent"></div>
            </div>
          </div>
        }
      </div>
    } @else {
      <div class="leaderboard__empty">
        <span>{{ 'widgets.noData' | transloco }}</span>
      </div>
    }
  `,
})
export class LeaderboardComponent {
  readonly data = input<MetricResultDto | null>(null);
  readonly title = input<string>('');
  readonly valueFormat = input<'number' | 'currency'>('number');

  readonly entries = computed<LeaderboardEntry[]>(() => {
    const metric = this.data();
    const series = metric?.series ?? [];
    const fmt = this.valueFormat();

    const formatter =
      fmt === 'currency'
        ? new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          })
        : new Intl.NumberFormat('en-US');

    const sliced = series.slice(0, 10);
    const maxVal = sliced.length > 0 ? Math.max(...sliced.map((s) => s.value)) : 1;

    return sliced.map((s, i) => ({
      rank: i + 1,
      name: s.label,
      initial: s.label.charAt(0) || '?',
      value: formatter.format(s.value),
      barPercent: maxVal > 0 ? Math.round((s.value / maxVal) * 100) : 0,
    }));
  });

  avatarClass(rank: number): string {
    switch (rank) {
      case 1:
        return 'leaderboard__avatar leaderboard__avatar--gold';
      case 2:
        return 'leaderboard__avatar leaderboard__avatar--silver';
      case 3:
        return 'leaderboard__avatar leaderboard__avatar--bronze';
      default:
        return 'leaderboard__avatar leaderboard__avatar--default';
    }
  }
}

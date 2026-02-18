import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MetricResultDto } from '../../../models/dashboard.models';

interface LeaderboardEntry {
  rank: number;
  name: string;
  value: string;
}

/**
 * Leaderboard widget displays a ranked user list with values.
 * Top 3 entries get gold/silver/bronze color accents.
 * Shows up to 10 entries from series data.
 */
@Component({
  selector: 'app-leaderboard',
  standalone: true,
  imports: [MatIconModule],
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
      padding: var(--space-2, 8px) 0;
    }

    .leaderboard__entry {
      display: flex;
      align-items: center;
      gap: var(--space-3, 12px);
      padding: var(--space-2, 8px) var(--space-4, 16px);
    }

    .leaderboard__entry:nth-child(even) {
      background: var(--color-highlight, rgba(249, 115, 22, 0.08));
    }

    .leaderboard__rank {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      min-width: 28px;
      border-radius: var(--radius-full, 9999px);
      font-size: var(--text-xs, 0.75rem);
      font-weight: var(--font-bold, 700);
      background: var(--color-border-subtle, #F3F4F6);
      color: var(--color-text-secondary, #6B7280);
    }

    .leaderboard__rank--gold {
      background: #FFF3CD;
      color: #856404;
    }

    .leaderboard__rank--silver {
      background: #E8E8E8;
      color: #6C757D;
    }

    .leaderboard__rank--bronze {
      background: #F5DFC8;
      color: #8B5E34;
    }

    .leaderboard__name {
      flex: 1;
      font-size: var(--text-sm, 0.8125rem);
      font-weight: var(--font-medium, 500);
      color: var(--color-text, #111827);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .leaderboard__value {
      font-size: var(--text-sm, 0.8125rem);
      font-weight: var(--font-semibold, 600);
      color: var(--color-primary-text, #C2410C);
      white-space: nowrap;
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
            <div class="leaderboard__rank" [class]="rankClass(entry.rank)">
              {{ entry.rank }}
            </div>
            <span class="leaderboard__name">{{ entry.name }}</span>
            <span class="leaderboard__value">{{ entry.value }}</span>
          </div>
        }
      </div>
    } @else {
      <div class="leaderboard__empty">
        <span>No data available</span>
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

    return series.slice(0, 10).map((s, i) => ({
      rank: i + 1,
      name: s.label,
      value: formatter.format(s.value),
    }));
  });

  rankClass(rank: number): string {
    switch (rank) {
      case 1:
        return 'leaderboard__rank leaderboard__rank--gold';
      case 2:
        return 'leaderboard__rank leaderboard__rank--silver';
      case 3:
        return 'leaderboard__rank leaderboard__rank--bronze';
      default:
        return 'leaderboard__rank';
    }
  }
}

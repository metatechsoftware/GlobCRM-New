import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ReportListItem, ReportChartType } from '../report.models';

/**
 * Individual report card with mini SVG chart thumbnail, report name,
 * entity type chip, chart type badge, last run info, and shared indicator.
 * Used in the card grid on ReportGalleryComponent.
 *
 * SVG thumbnails are schematic representations (not real charts) using
 * colored shapes that convey the chart type at a glance.
 */
@Component({
  selector: 'app-report-card',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatTooltipModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="report-card" (click)="viewReport.emit()">
      <!-- SVG Chart Thumbnail -->
      <div class="report-card__thumbnail">
        <svg
          viewBox="0 0 280 120"
          class="report-card__svg"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <linearGradient id="orangeGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#F97316" stop-opacity="0.8" />
              <stop offset="100%" stop-color="#F97316" stop-opacity="0.3" />
            </linearGradient>
            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#F97316" stop-opacity="0.25" />
              <stop offset="100%" stop-color="#F97316" stop-opacity="0.05" />
            </linearGradient>
          </defs>

          @switch (report().chartType) {
            @case ('bar') {
              <!-- Bar chart: vertical bars of varying height -->
              <rect x="30" y="50" width="36" height="60" rx="3" fill="url(#orangeGrad)" />
              <rect x="76" y="30" width="36" height="80" rx="3" fill="url(#orangeGrad)" />
              <rect x="122" y="45" width="36" height="65" rx="3" fill="url(#orangeGrad)" />
              <rect x="168" y="20" width="36" height="90" rx="3" fill="url(#orangeGrad)" />
              <rect x="214" y="55" width="36" height="55" rx="3" fill="url(#orangeGrad)" />
            }
            @case ('line') {
              <!-- Line chart: smooth path with area fill -->
              <path
                d="M 20 85 C 60 75, 80 40, 120 50 S 180 25, 220 35 S 250 60, 260 55"
                fill="none"
                stroke="#F97316"
                stroke-width="2.5"
                stroke-linecap="round"
              />
              <path
                d="M 20 85 C 60 75, 80 40, 120 50 S 180 25, 220 35 S 250 60, 260 55 L 260 110 L 20 110 Z"
                fill="url(#areaGrad)"
              />
              <!-- Data points -->
              <circle cx="20" cy="85" r="3" fill="#F97316" />
              <circle cx="120" cy="50" r="3" fill="#F97316" />
              <circle cx="220" cy="35" r="3" fill="#F97316" />
              <circle cx="260" cy="55" r="3" fill="#F97316" />
            }
            @case ('pie') {
              <!-- Pie chart: colored arc segments -->
              <circle cx="140" cy="60" r="45" fill="#FDBA74" />
              <path d="M 140 60 L 140 15 A 45 45 0 0 1 179 38 Z" fill="#F97316" />
              <path d="M 140 60 L 179 38 A 45 45 0 0 1 185 60 Z" fill="#EA580C" />
              <path d="M 140 60 L 185 60 A 45 45 0 0 1 163 100 Z" fill="#FB923C" />
            }
            @case ('funnel') {
              <!-- Funnel: trapezoid shapes narrowing downward -->
              <rect x="40" y="15" width="200" height="18" rx="3" fill="#F97316" opacity="0.9" />
              <rect x="65" y="38" width="150" height="18" rx="3" fill="#F97316" opacity="0.7" />
              <rect x="90" y="61" width="100" height="18" rx="3" fill="#F97316" opacity="0.5" />
              <rect x="110" y="84" width="60" height="18" rx="3" fill="#F97316" opacity="0.35" />
            }
            @default {
              <!-- Table: grid lines suggesting data table -->
              <line x1="30" y1="20" x2="250" y2="20" stroke="#D1D5DB" stroke-width="1.5" />
              <line x1="30" y1="40" x2="250" y2="40" stroke="#E5E7EB" stroke-width="1" />
              <line x1="30" y1="58" x2="250" y2="58" stroke="#E5E7EB" stroke-width="1" />
              <line x1="30" y1="76" x2="250" y2="76" stroke="#E5E7EB" stroke-width="1" />
              <line x1="30" y1="94" x2="250" y2="94" stroke="#E5E7EB" stroke-width="1" />
              <!-- Header cells -->
              <rect x="30" y="10" width="50" height="10" rx="2" fill="#F97316" opacity="0.6" />
              <rect x="90" y="10" width="60" height="10" rx="2" fill="#F97316" opacity="0.6" />
              <rect x="160" y="10" width="40" height="10" rx="2" fill="#F97316" opacity="0.6" />
              <rect x="210" y="10" width="40" height="10" rx="2" fill="#F97316" opacity="0.6" />
              <!-- Data cells -->
              <rect x="30" y="28" width="45" height="8" rx="2" fill="#D1D5DB" opacity="0.5" />
              <rect x="90" y="28" width="55" height="8" rx="2" fill="#D1D5DB" opacity="0.5" />
              <rect x="160" y="28" width="35" height="8" rx="2" fill="#D1D5DB" opacity="0.5" />
              <rect x="210" y="28" width="30" height="8" rx="2" fill="#D1D5DB" opacity="0.5" />
              <rect x="30" y="46" width="40" height="8" rx="2" fill="#D1D5DB" opacity="0.4" />
              <rect x="90" y="46" width="50" height="8" rx="2" fill="#D1D5DB" opacity="0.4" />
              <rect x="160" y="46" width="30" height="8" rx="2" fill="#D1D5DB" opacity="0.4" />
              <rect x="210" y="46" width="35" height="8" rx="2" fill="#D1D5DB" opacity="0.4" />
              <rect x="30" y="64" width="48" height="8" rx="2" fill="#D1D5DB" opacity="0.3" />
              <rect x="90" y="64" width="45" height="8" rx="2" fill="#D1D5DB" opacity="0.3" />
              <rect x="160" y="64" width="38" height="8" rx="2" fill="#D1D5DB" opacity="0.3" />
              <rect x="210" y="64" width="28" height="8" rx="2" fill="#D1D5DB" opacity="0.3" />
            }
          }
        </svg>
      </div>

      <!-- Info Section -->
      <div class="report-card__info">
        <h3 class="report-card__name">{{ report().name }}</h3>
        @if (report().description) {
          <p class="report-card__desc">{{ report().description }}</p>
        }

        <div class="report-card__meta">
          <span class="report-card__entity-chip" [attr.data-entity]="report().entityType">
            <mat-icon class="report-card__entity-icon">{{ entityIcon() }}</mat-icon>
            {{ report().entityType }}
          </span>
          <span class="report-card__chart-badge">
            <mat-icon class="report-card__chart-icon">{{ chartIcon() }}</mat-icon>
            {{ chartLabel() }}
          </span>
        </div>

        <div class="report-card__footer">
          <span class="report-card__last-run">
            <mat-icon class="report-card__footer-icon">schedule</mat-icon>
            {{ lastRunText() }}
          </span>
          <span class="report-card__badges">
            @if (report().isShared) {
              <mat-icon
                class="report-card__share-icon"
                matTooltip="Shared with team"
              >people</mat-icon>
            } @else {
              <mat-icon
                class="report-card__share-icon report-card__share-icon--personal"
                matTooltip="Personal report"
              >person</mat-icon>
            }
            @if (report().isSeedData) {
              <span class="report-card__seed-chip">Starter</span>
            }
          </span>
        </div>
      </div>
    </div>
  `,
  styles: `
    @keyframes cardEntrance {
      from {
        opacity: 0;
        transform: translateY(12px) scale(0.98);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    @keyframes svgFadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    :host {
      animation: cardEntrance 500ms cubic-bezier(0, 0, 0.2, 1) backwards;
      animation-delay: calc(var(--card-index, 0) * 60ms);
    }

    .report-card {
      display: flex;
      flex-direction: column;
      background: var(--color-surface, #fff);
      border: 1px solid var(--color-border, #E8E8E6);
      border-radius: var(--radius-lg, 12px);
      box-shadow: var(--shadow-sm);
      overflow: hidden;
      cursor: pointer;
      transition: box-shadow var(--duration-normal, 200ms) cubic-bezier(0, 0, 0.2, 1),
                  border-color var(--duration-normal, 200ms) cubic-bezier(0, 0, 0.2, 1),
                  transform var(--duration-normal, 200ms) cubic-bezier(0, 0, 0.2, 1);
    }

    .report-card:hover {
      box-shadow: 0 8px 25px rgba(249, 115, 22, 0.08), var(--shadow-md);
      border-color: var(--color-primary, #F97316);
      transform: translateY(-2px) scale(1.01);
    }

    /* Thumbnail */
    .report-card__thumbnail {
      height: 140px;
      background: linear-gradient(135deg, var(--color-primary-soft, #FFF7ED), var(--color-bg-secondary, #F0F0EE));
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      border-bottom: 1px solid var(--color-border-subtle, #F0F0EE);
    }

    .report-card__svg {
      width: 100%;
      height: 100%;
      padding: 0 16px;
      animation: svgFadeIn 400ms cubic-bezier(0, 0, 0.2, 1) 300ms backwards;
    }

    /* Info */
    .report-card__info {
      padding: var(--space-4, 16px);
      flex: 1;
      display: flex;
      flex-direction: column;
    }

    .report-card__name {
      margin: 0;
      font-size: var(--text-base, 14px);
      font-weight: var(--font-semibold, 600);
      color: var(--color-text, #1A1A1A);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .report-card__desc {
      margin: var(--space-1, 4px) 0 0;
      font-size: var(--text-xs, 12px);
      color: var(--color-text-secondary, #6B7280);
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      line-height: var(--leading-normal, 1.5);
    }

    .report-card__meta {
      display: flex;
      align-items: center;
      gap: var(--space-2, 8px);
      margin-top: var(--space-3, 12px);
    }

    .report-card__entity-chip {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      font-size: var(--text-xs, 12px);
      padding: 2px 8px;
      border-radius: var(--radius-sm, 4px);
      background: var(--color-info-soft, #EFF6FF);
      color: var(--color-info-text, #1D4ED8);
      font-weight: var(--font-medium, 500);
      text-transform: capitalize;
    }

    /* Entity-colored chips */
    .report-card__entity-chip[data-entity="Contact"] {
      background: #EFF6FF; color: #1D4ED8;
    }
    .report-card__entity-chip[data-entity="Deal"] {
      background: #F0FDF4; color: #16A34A;
    }
    .report-card__entity-chip[data-entity="Company"] {
      background: #F5F3FF; color: #7C3AED;
    }
    .report-card__entity-chip[data-entity="Lead"] {
      background: #FFF7ED; color: #EA580C;
    }
    .report-card__entity-chip[data-entity="Activity"] {
      background: #F0FDFA; color: #0D9488;
    }
    .report-card__entity-chip[data-entity="Quote"] {
      background: #FFFBEB; color: #D97706;
    }
    .report-card__entity-chip[data-entity="Request"] {
      background: #FEF2F2; color: #DC2626;
    }
    .report-card__entity-chip[data-entity="Product"] {
      background: #F0FDFA; color: #0D9488;
    }

    .report-card__entity-icon {
      font-size: 12px;
      width: 12px;
      height: 12px;
    }

    .report-card__chart-badge {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      font-size: var(--text-xs, 12px);
      padding: 2px 8px;
      border-radius: var(--radius-sm, 4px);
      background: var(--color-surface-hover, #F7F7F5);
      color: var(--color-text-secondary, #6B7280);
      font-weight: var(--font-medium, 500);
      text-transform: capitalize;
    }

    .report-card__chart-icon {
      font-size: 12px;
      width: 12px;
      height: 12px;
    }

    /* Footer */
    .report-card__footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: auto;
      padding-top: var(--space-3, 12px);
      border-top: 1px solid var(--color-border-subtle, #F0F0EE);
    }

    .report-card__last-run {
      display: flex;
      align-items: center;
      gap: var(--space-1, 4px);
      font-size: var(--text-xs, 12px);
      color: var(--color-text-secondary, #6B7280);
    }

    .report-card__footer-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }

    .report-card__badges {
      display: flex;
      align-items: center;
      gap: var(--space-1, 4px);
    }

    .report-card__share-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      color: var(--color-primary, #F97316);
    }

    .report-card__share-icon--personal {
      color: var(--color-text-muted, #9CA3AF);
    }

    .report-card__seed-chip {
      font-size: 10px;
      padding: 1px 6px;
      border-radius: var(--radius-sm, 4px);
      background: var(--color-warning-soft, #FFFBEB);
      color: var(--color-warning-text, #B45309);
      font-weight: var(--font-medium, 500);
    }
  `,
})
export class ReportCardComponent {
  readonly report = input.required<ReportListItem>();
  readonly viewReport = output<void>();

  /** Icon for the entity type */
  readonly entityIcon = computed(() => {
    const map: Record<string, string> = {
      Contact: 'people',
      Company: 'business',
      Deal: 'handshake',
      Lead: 'person_search',
      Activity: 'task_alt',
      Quote: 'request_quote',
      Request: 'support_agent',
      Product: 'inventory_2',
    };
    return map[this.report().entityType] ?? 'table_chart';
  });

  /** Icon for the chart type */
  readonly chartIcon = computed((): string => {
    const map: Record<ReportChartType, string> = {
      table: 'table_chart',
      bar: 'bar_chart',
      line: 'show_chart',
      pie: 'pie_chart',
      funnel: 'filter_alt',
    };
    return map[this.report().chartType] ?? 'table_chart';
  });

  /** Label for the chart type */
  readonly chartLabel = computed((): string => {
    const map: Record<ReportChartType, string> = {
      table: 'Table',
      bar: 'Bar',
      line: 'Line',
      pie: 'Pie',
      funnel: 'Funnel',
    };
    return map[this.report().chartType] ?? 'Table';
  });

  /** Relative time for last run */
  readonly lastRunText = computed(() => {
    const lastRun = this.report().lastRunAt;
    if (!lastRun) return 'Never run';
    const diff = Date.now() - new Date(lastRun).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  });
}

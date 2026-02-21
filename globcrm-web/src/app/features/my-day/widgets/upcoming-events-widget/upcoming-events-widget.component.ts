import { Component, ChangeDetectionStrategy, computed, input, output, inject } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { DatePipe } from '@angular/common';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { MyDayEventDto } from '../../my-day.models';

interface EventGroup {
  label: string;
  events: MyDayEventDto[];
}

@Component({
  selector: 'app-upcoming-events-widget',
  standalone: true,
  imports: [MatCardModule, MatIconModule, DatePipe, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-card class="events-widget">
      <mat-card-header>
        <div class="widget-header-icon">
          <mat-icon>calendar_month</mat-icon>
        </div>
        <mat-card-title>{{ 'widgets.upcomingEvents.title' | transloco }}</mat-card-title>
      </mat-card-header>

      <mat-card-content>
        @if (isLoading()) {
          <div class="events-widget__loading">
            @for (i of [1, 2, 3]; track i) {
              <div class="events-widget__shimmer-row"></div>
            }
          </div>
        } @else if (eventGroups().length === 0) {
          <div class="events-widget__empty">
            <mat-icon class="events-widget__empty-icon">event_busy</mat-icon>
            <span class="events-widget__empty-text">{{ 'widgets.upcomingEvents.empty' | transloco }}</span>
          </div>
        } @else {
          @for (group of eventGroups(); track group.label) {
            <div class="events-widget__group">
              <div class="events-widget__day-header">{{ group.label }}</div>
              @for (event of group.events; track event.id) {
                <button class="events-widget__row" (click)="eventClicked.emit(event.id)">
                  <div class="events-widget__type-dot"
                       [class.events-widget__type-dot--call]="event.type !== 'Meeting'"></div>
                  <span class="events-widget__time">{{ event.dueDate | date:'HH:mm' }}</span>
                  <div class="events-widget__details">
                    <span class="events-widget__subject">{{ event.subject }}</span>
                    @if (event.assignedToName) {
                      <span class="events-widget__assignee">{{ event.assignedToName }}</span>
                    }
                  </div>
                  <mat-icon class="events-widget__arrow">chevron_right</mat-icon>
                </button>
              }
            </div>
          }
        }
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    @keyframes shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }

    .events-widget {
      width: 100%;
      height: fit-content;
      border: none;
      border-radius: var(--radius-xl, 16px);
      box-shadow:
        0 1px 3px rgba(0, 0, 0, 0.04),
        0 6px 20px rgba(0, 0, 0, 0.05);
      transition: box-shadow 250ms ease;

      &:hover {
        box-shadow:
          0 1px 3px rgba(0, 0, 0, 0.04),
          0 8px 28px rgba(0, 0, 0, 0.07);
      }
    }

    mat-card-header {
      display: flex;
      align-items: center;
      gap: var(--space-3, 12px);
      margin-bottom: var(--space-4, 16px);
    }

    .widget-header-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border-radius: var(--radius-md, 8px);
      background: var(--color-primary-soft);

      mat-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
        color: #F97316;
      }
    }

    mat-card-title {
      margin: 0;
      font-size: var(--text-lg, 1.125rem);
      font-weight: var(--font-semibold, 600);
      letter-spacing: -0.01em;
    }

    .events-widget__group {
      margin-bottom: var(--space-3, 12px);

      &:last-child {
        margin-bottom: 0;
      }
    }

    .events-widget__day-header {
      font-size: var(--text-xs, 0.75rem);
      font-weight: var(--font-semibold, 600);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--color-text-secondary);
      padding-bottom: var(--space-1, 4px);
      margin-bottom: var(--space-2, 8px);
      border-bottom: 1px solid var(--color-border-subtle);
    }

    .events-widget__row {
      display: flex;
      align-items: center;
      gap: var(--space-2, 8px);
      padding: var(--space-2, 8px);
      border-radius: var(--radius-md, 8px);
      width: 100%;
      background: none;
      border: none;
      cursor: pointer;
      font-family: inherit;
      text-align: left;
      transition: background-color 150ms ease;

      &:hover {
        background: rgba(249, 115, 22, 0.04);

        .events-widget__arrow {
          opacity: 1;
          transform: translateX(0);
        }
      }
    }

    .events-widget__type-dot {
      flex-shrink: 0;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #F97316;
    }

    .events-widget__type-dot--call {
      background: var(--color-accent, #14B8A6);
    }

    .events-widget__time {
      flex-shrink: 0;
      font-size: var(--text-sm, 0.875rem);
      font-weight: var(--font-semibold, 600);
      color: var(--color-text);
      min-width: 44px;
      font-variant-numeric: tabular-nums;
    }

    .events-widget__details {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .events-widget__subject {
      font-size: var(--text-sm, 0.875rem);
      color: var(--color-text);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .events-widget__assignee {
      font-size: var(--text-xs, 0.75rem);
      color: var(--color-text-muted);
    }

    .events-widget__arrow {
      flex-shrink: 0;
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: var(--color-text-muted);
      opacity: 0;
      transform: translateX(-4px);
      transition: opacity 150ms ease, transform 150ms ease;
    }

    .events-widget__empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-3, 12px);
      padding: var(--space-10, 40px) 0;
    }

    .events-widget__empty-icon {
      font-size: 44px;
      width: 44px;
      height: 44px;
      color: var(--color-text-muted);
      opacity: 0.4;
    }

    .events-widget__empty-text {
      font-size: var(--text-sm, 0.875rem);
      color: var(--color-text-muted);
    }

    .events-widget__loading {
      display: flex;
      flex-direction: column;
      gap: var(--space-2, 8px);
    }

    .events-widget__shimmer-row {
      height: 44px;
      border-radius: var(--radius-md, 8px);
      background: linear-gradient(
        90deg,
        var(--color-border-subtle) 25%,
        var(--color-primary-soft) 37%,
        var(--color-border-subtle) 63%
      );
      background-size: 200% 100%;
      animation: shimmer 1.8s ease-in-out infinite;

      &:nth-child(2) { animation-delay: 150ms; }
      &:nth-child(3) { animation-delay: 300ms; }
    }

    @media (prefers-reduced-motion: reduce) {
      .events-widget {
        transition: none;
      }

      .events-widget__arrow {
        transition: none;
      }
    }
  `],
})
export class UpcomingEventsWidgetComponent {
  readonly events = input<MyDayEventDto[]>([]);
  readonly isLoading = input<boolean>(false);
  readonly eventClicked = output<string>();
  private readonly translocoService = inject(TranslocoService);

  /** Group events by day: Today, Tomorrow, or formatted date. */
  readonly eventGroups = computed<EventGroup[]>(() => {
    const events = this.events();
    if (!events || events.length === 0) return [];

    const now = new Date();
    const todayStr = this.toDateKey(now);
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = this.toDateKey(tomorrow);

    const groups = new Map<string, { label: string; events: MyDayEventDto[] }>();

    for (const event of events) {
      const eventDate = new Date(event.dueDate);
      const dateKey = this.toDateKey(eventDate);

      let label: string;
      if (dateKey === todayStr) {
        label = this.translocoService.translate('widgets.upcomingEvents.today');
      } else if (dateKey === tomorrowStr) {
        label = this.translocoService.translate('widgets.upcomingEvents.tomorrow');
      } else {
        label = new Intl.DateTimeFormat('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        }).format(eventDate);
      }

      const existing = groups.get(dateKey);
      if (existing) {
        existing.events.push(event);
      } else {
        groups.set(dateKey, { label, events: [event] });
      }
    }

    return Array.from(groups.values());
  });

  private toDateKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
}

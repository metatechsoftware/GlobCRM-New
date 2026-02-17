import {
  Component,
  ChangeDetectionStrategy,
  computed,
  input,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

/**
 * Represents a single entry in an entity timeline.
 * Each entry has a type that determines its icon and visual styling.
 */
export interface TimelineEntry {
  id: string;
  type:
    | 'created'
    | 'updated'
    | 'contact_linked'
    | 'contact_unlinked'
    | 'deal_created'
    | 'stage_changed'
    | 'product_linked'
    | 'product_unlinked'
    | 'activity'
    | 'note'
    | 'email';
  title: string;
  description: string | null;
  timestamp: string; // ISO 8601
  userId: string | null;
  userName: string | null;
}

/**
 * Maps timeline entry types to Material icon names.
 */
const TIMELINE_ICONS: Record<string, string> = {
  created: 'add_circle',
  updated: 'edit',
  contact_linked: 'person_add',
  contact_unlinked: 'person_remove',
  deal_created: 'handshake',
  stage_changed: 'swap_horiz',
  product_linked: 'add_shopping_cart',
  product_unlinked: 'remove_shopping_cart',
  activity: 'task',
  note: 'note',
  email: 'email',
};

/**
 * Maps timeline entry types to theme colors for the timeline dot.
 */
const TIMELINE_COLORS: Record<string, string> = {
  created: '#4caf50',
  updated: '#2196f3',
  contact_linked: '#9c27b0',
  contact_unlinked: '#f44336',
  deal_created: '#ff9800',
  stage_changed: '#ff5722',
  product_linked: '#4caf50',
  product_unlinked: '#f44336',
  activity: '#00bcd4',
  note: '#607d8b',
  email: '#3f51b5',
};

/**
 * Reusable vertical timeline component for displaying chronological events
 * on entity detail pages.
 *
 * Accepts an array of TimelineEntry objects (loaded by the parent component)
 * and renders them in a vertical timeline layout with type-specific icons and colors.
 *
 * Usage:
 *   <app-entity-timeline
 *     [entries]="timelineEntries()"
 *     [isLoading]="isLoadingTimeline()" />
 */
@Component({
  selector: 'app-entity-timeline',
  standalone: true,
  imports: [DatePipe, MatIconModule, MatProgressSpinnerModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
    }

    .timeline-loading {
      display: flex;
      justify-content: center;
      padding: 24px;
    }

    .timeline-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 32px 16px;
      color: var(--mat-sys-on-surface-variant, rgba(0, 0, 0, 0.6));
      text-align: center;
    }

    .timeline-empty mat-icon {
      font-size: 40px;
      width: 40px;
      height: 40px;
      opacity: 0.5;
    }

    .timeline-container {
      position: relative;
      padding: 0 0 0 8px;
    }

    .timeline-item {
      display: flex;
      gap: 12px;
      position: relative;
      padding-bottom: 24px;
    }

    .timeline-item:last-child {
      padding-bottom: 0;
    }

    .timeline-item:last-child .timeline-line {
      display: none;
    }

    .timeline-dot-container {
      position: relative;
      flex-shrink: 0;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      z-index: 1;
    }

    .timeline-dot {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
    }

    .timeline-dot mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .timeline-line {
      position: absolute;
      left: 15px;
      top: 32px;
      bottom: -24px;
      width: 2px;
      background-color: var(--mat-sys-outline-variant, rgba(0, 0, 0, 0.12));
    }

    .timeline-content {
      flex: 1;
      min-width: 0;
      padding-top: 4px;
    }

    .timeline-title {
      font-size: 14px;
      font-weight: 500;
      color: var(--mat-sys-on-surface, rgba(0, 0, 0, 0.87));
      line-height: 1.4;
    }

    .timeline-description {
      font-size: 13px;
      color: var(--mat-sys-on-surface-variant, rgba(0, 0, 0, 0.6));
      margin-top: 2px;
      line-height: 1.4;
    }

    .timeline-meta {
      display: flex;
      gap: 8px;
      align-items: center;
      margin-top: 4px;
      font-size: 12px;
      color: var(--mat-sys-on-surface-variant, rgba(0, 0, 0, 0.5));
    }

    .timeline-meta-separator {
      width: 3px;
      height: 3px;
      border-radius: 50%;
      background-color: var(--mat-sys-on-surface-variant, rgba(0, 0, 0, 0.3));
    }
  `,
  template: `
    @if (isLoading()) {
      <div class="timeline-loading">
        <mat-spinner diameter="32"></mat-spinner>
      </div>
    } @else if (sortedEntries().length === 0) {
      <div class="timeline-empty">
        <mat-icon>history</mat-icon>
        <span>No activity yet</span>
      </div>
    } @else {
      <div class="timeline-container">
        @for (entry of sortedEntries(); track entry.id) {
          <div class="timeline-item">
            <div class="timeline-dot-container">
              <div class="timeline-dot" [style.background-color]="getColor(entry.type)">
                <mat-icon>{{ getIcon(entry.type) }}</mat-icon>
              </div>
              <div class="timeline-line"></div>
            </div>
            <div class="timeline-content">
              <div class="timeline-title">{{ entry.title }}</div>
              @if (entry.description) {
                <div class="timeline-description">{{ entry.description }}</div>
              }
              <div class="timeline-meta">
                <span>{{ entry.timestamp | date:'MMM d, y, h:mm a' }}</span>
                @if (entry.userName) {
                  <span class="timeline-meta-separator"></span>
                  <span>{{ entry.userName }}</span>
                }
              </div>
            </div>
          </div>
        }
      </div>
    }
  `,
})
export class EntityTimelineComponent {
  /** The timeline entries to display, provided by the parent component. */
  entries = input<TimelineEntry[]>([]);

  /** Whether the timeline data is currently loading. */
  isLoading = input<boolean>(false);

  /**
   * Entries sorted by timestamp descending (newest first).
   */
  sortedEntries = computed(() => {
    const entries = this.entries();
    return [...entries].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  });

  /**
   * Get the Material icon name for a timeline entry type.
   */
  getIcon(type: string): string {
    return TIMELINE_ICONS[type] ?? 'circle';
  }

  /**
   * Get the dot background color for a timeline entry type.
   */
  getColor(type: string): string {
    return TIMELINE_COLORS[type] ?? '#757575';
  }
}

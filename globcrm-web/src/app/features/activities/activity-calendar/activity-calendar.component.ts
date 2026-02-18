import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { FullCalendarModule } from '@fullcalendar/angular';
import { CalendarOptions, EventInput } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { ActivityService } from '../activity.service';
import { ActivityListDto, ACTIVITY_PRIORITIES } from '../activity.models';

/**
 * Calendar view for activities displaying activities by due date.
 * Uses FullCalendar dayGridMonth with priority-based color coding.
 * Supports click-to-navigate to activity detail and view mode switching.
 */
@Component({
  selector: 'app-activity-calendar',
  standalone: true,
  imports: [
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatButtonToggleModule,
    MatProgressBarModule,
    FullCalendarModule,
  ],
  templateUrl: './activity-calendar.component.html',
  styleUrl: './activity-calendar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActivityCalendarComponent implements OnInit {
  private readonly activityService = inject(ActivityService);
  private readonly router = inject(Router);

  /** FullCalendar configuration options. */
  calendarOptions = signal<CalendarOptions>({
    plugins: [dayGridPlugin, interactionPlugin],
    initialView: 'dayGridMonth',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: '', // No view switcher (Phase 5 calendar is month-only; Phase 11 adds day/week)
    },
    events: [],
    eventClick: (info) => {
      this.router.navigate(['/activities', info.event.id]);
    },
    height: 'auto',
  });

  /** Loading state. */
  isLoading = signal<boolean>(false);

  /** Priority color legend items. */
  readonly priorityLegend = ACTIVITY_PRIORITIES;

  ngOnInit(): void {
    this.loadActivities();
  }

  /** Load all activities for calendar display. */
  private loadActivities(): void {
    this.isLoading.set(true);
    this.activityService
      .getList({ page: 1, pageSize: 200 })
      .subscribe({
        next: (result) => {
          const events = this.mapToEvents(result.items);
          this.calendarOptions.update((opts) => ({ ...opts, events }));
          this.isLoading.set(false);
        },
        error: () => {
          this.isLoading.set(false);
        },
      });
  }

  /** Map activities to FullCalendar EventInput objects. */
  private mapToEvents(activities: ActivityListDto[]): EventInput[] {
    return activities
      .filter((a) => a.dueDate != null)
      .map((a) => ({
        id: a.id,
        title: a.subject,
        date: a.dueDate!,
        backgroundColor: this.getPriorityColor(a.priority),
        borderColor: this.getPriorityColor(a.priority),
        extendedProps: {
          type: a.type,
          status: a.status,
          priority: a.priority,
          assignedToName: a.assignedToName,
        },
      }));
  }

  /** Get color for a priority level. */
  private getPriorityColor(priority: string): string {
    const colors: Record<string, string> = {
      Low: 'var(--color-success)',
      Medium: 'var(--color-info)',
      High: 'var(--color-warning)',
      Urgent: 'var(--color-danger)',
    };
    return colors[priority] ?? 'var(--color-text-muted)';
  }
}

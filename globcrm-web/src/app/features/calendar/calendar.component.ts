import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  inject,
  signal,
  effect,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { FullCalendarModule } from '@fullcalendar/angular';
import { CalendarOptions, EventInput, EventDropArg } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin, { DateClickArg } from '@fullcalendar/interaction';
import { CalendarService, CalendarEventDto } from './calendar.service';
import { ActivityService } from '../activities/activity.service';
import {
  ProfileService,
  TeamMemberDto,
} from '../profile/profile.service';
import { ACTIVITY_TYPES, ACTIVITY_PRIORITIES } from '../activities/activity.models';

/**
 * Unified calendar page displaying activities from all entities in day/week/month views.
 * Features: FullCalendar integration, drag-and-drop rescheduling with optimistic update,
 * date-click to create new activity, event-click to navigate to detail,
 * and filter bar with entity type, activity type, and owner dropdowns.
 */
@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [
    MatFormFieldModule,
    MatSelectModule,
    MatIconModule,
    MatProgressBarModule,
    MatSnackBarModule,
    FullCalendarModule,
  ],
  templateUrl: './calendar.component.html',
  styleUrl: './calendar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalendarComponent implements OnInit {
  private readonly calendarService = inject(CalendarService);
  private readonly activityService = inject(ActivityService);
  private readonly profileService = inject(ProfileService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly snackBar = inject(MatSnackBar);

  /** Loading state. */
  isLoading = signal(false);

  /** Calendar events from API. */
  events = signal<CalendarEventDto[]>([]);

  /** Filter: activity type (Task, Call, Meeting). */
  filterType = signal<string | null>(null);

  /** Filter: owner user ID. */
  filterOwnerId = signal<string | null>(null);

  /** Filter: entity type (contact, company, deal). */
  filterEntityType = signal<string | null>(null);

  /** Filter: entity ID (for deep-linking from entity detail pages). */
  filterEntityId = signal<string | null>(null);

  /** Team members for owner filter dropdown. */
  teamMembers = signal<TeamMemberDto[]>([]);

  /** Activity type options for filter dropdown. */
  readonly activityTypes = ACTIVITY_TYPES;

  /** Priority legend items. */
  readonly priorityLegend = ACTIVITY_PRIORITIES;

  /** Entity type options for filter dropdown. */
  readonly entityTypes = [
    { value: null, label: 'All Entities' },
    { value: 'contact', label: 'Contacts' },
    { value: 'company', label: 'Companies' },
    { value: 'deal', label: 'Deals' },
  ];

  /** Current date range tracked from FullCalendar datesSet callback. */
  private currentStart = '';
  private currentEnd = '';

  /** Track filter changes to debounce reload. */
  private filterReloadTimer: ReturnType<typeof setTimeout> | null = null;

  /** FullCalendar configuration. */
  calendarOptions = signal<CalendarOptions>({
    plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
    initialView: 'dayGridMonth',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,timeGridDay',
    },
    editable: true,
    eventStartEditable: true,
    eventDurationEditable: true,
    snapDuration: '00:15:00',
    slotDuration: '00:30:00',
    allDaySlot: true,
    height: 'auto',
    events: [],
    eventDrop: (info: EventDropArg) => this.handleEventDrop(info),
    dateClick: (info: DateClickArg) => this.handleDateClick(info),
    eventClick: (info) => this.handleEventClick(info),
    datesSet: (dateInfo) => this.handleDatesSet(dateInfo),
  });

  constructor() {
    // Watch filter signal changes and reload events with debounce
    effect(() => {
      // Read all filter signals to track them
      this.filterType();
      this.filterOwnerId();
      this.filterEntityType();
      this.filterEntityId();

      // Debounced reload
      if (this.filterReloadTimer) {
        clearTimeout(this.filterReloadTimer);
      }
      this.filterReloadTimer = setTimeout(() => {
        if (this.currentStart && this.currentEnd) {
          this.loadEvents();
        }
      }, 150);
    });
  }

  ngOnInit(): void {
    // Read entityType and entityId from queryParams for deep-linking
    const entityType = this.route.snapshot.queryParamMap.get('entityType');
    const entityId = this.route.snapshot.queryParamMap.get('entityId');
    if (entityType) {
      this.filterEntityType.set(entityType);
    }
    if (entityId) {
      this.filterEntityId.set(entityId);
    }

    // Load team members for owner filter dropdown
    this.profileService.getTeamDirectory({ pageSize: 100 }).subscribe({
      next: (result) => this.teamMembers.set(result.items),
      error: () => {},
    });
  }

  /**
   * Called when FullCalendar date range changes (view switch or navigation).
   * Extracts start/end ISO strings and loads events for the visible range.
   */
  handleDatesSet(dateInfo: { start: Date; end: Date }): void {
    this.currentStart = dateInfo.start.toISOString();
    this.currentEnd = dateInfo.end.toISOString();
    this.loadEvents();
  }

  /**
   * Drag-and-drop reschedule with optimistic update.
   * Gets new date from the dropped position, fetches the activity,
   * then sends a PUT update with the new dueDate.
   * Reverts on failure with a snackbar notification.
   */
  handleEventDrop(info: EventDropArg): void {
    const activityId = info.event.id;
    const newDate = info.event.start;
    if (!newDate) {
      info.revert();
      return;
    }

    const newDateStr = newDate.toISOString().split('T')[0];

    // Fetch activity detail first, then update with new dueDate
    this.activityService.getById(activityId).subscribe({
      next: (activity) => {
        this.activityService.update(activityId, {
          subject: activity.subject,
          type: activity.type,
          priority: activity.priority,
          description: activity.description,
          dueDate: newDateStr,
          assignedToId: activity.assignedToId || undefined,
          customFields: activity.customFields,
        }).subscribe({
          next: () => {
            this.snackBar.open('Activity rescheduled', 'Close', { duration: 2000 });
          },
          error: () => {
            info.revert();
            this.snackBar.open('Failed to reschedule activity', 'Close', { duration: 5000 });
          },
        });
      },
      error: () => {
        info.revert();
        this.snackBar.open('Failed to reschedule activity', 'Close', { duration: 5000 });
      },
    });
  }

  /**
   * Date click handler: navigate to activity creation with dueDate pre-filled.
   */
  handleDateClick(info: DateClickArg): void {
    this.router.navigate(['/activities/new'], {
      queryParams: { dueDate: info.dateStr },
    });
  }

  /**
   * Event click handler: navigate to activity detail page.
   */
  handleEventClick(info: { event: { id: string } }): void {
    this.router.navigate(['/activities', info.event.id]);
  }

  /**
   * Entity type filter change handler.
   * Clears entityId when entity type changes (no longer entity-specific).
   */
  onEntityTypeChanged(value: string | null): void {
    this.filterEntityType.set(value);
    this.filterEntityId.set(null);
  }

  /**
   * Activity type filter change handler.
   */
  onTypeChanged(value: string | null): void {
    this.filterType.set(value);
  }

  /**
   * Owner filter change handler.
   */
  onOwnerChanged(value: string | null): void {
    this.filterOwnerId.set(value);
  }

  /**
   * Load events from the CalendarService with current date range and filters.
   */
  private loadEvents(): void {
    if (!this.currentStart || !this.currentEnd) return;

    this.isLoading.set(true);
    this.calendarService.getEvents(this.currentStart, this.currentEnd, {
      type: this.filterType(),
      ownerId: this.filterOwnerId(),
      entityType: this.filterEntityType(),
      entityId: this.filterEntityId(),
    }).subscribe({
      next: (events) => {
        this.events.set(events);
        const calendarEvents = this.mapToCalendarEvents(events);
        this.calendarOptions.update((opts) => ({ ...opts, events: calendarEvents }));
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.snackBar.open('Failed to load calendar events', 'Close', { duration: 5000 });
      },
    });
  }

  /**
   * Map CalendarEventDto[] to FullCalendar EventInput[] with priority-based coloring.
   */
  private mapToCalendarEvents(events: CalendarEventDto[]): EventInput[] {
    return events.map((e) => ({
      id: e.id,
      title: e.title,
      start: e.start,
      end: e.end,
      backgroundColor: e.color || this.getPriorityColor(e.extendedProps?.priority),
      borderColor: e.color || this.getPriorityColor(e.extendedProps?.priority),
      extendedProps: e.extendedProps,
    }));
  }

  /**
   * Priority-to-color mapping matching existing activity calendar.
   */
  private getPriorityColor(priority: string): string {
    const colors: Record<string, string> = {
      Low: '#4caf50',
      Medium: '#2196f3',
      High: '#ff9800',
      Urgent: '#f44336',
    };
    return colors[priority] ?? '#757575';
  }
}

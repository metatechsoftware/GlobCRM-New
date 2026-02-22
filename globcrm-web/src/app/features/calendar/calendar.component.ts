import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  inject,
  signal,
  computed,
  effect,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { FullCalendarModule } from '@fullcalendar/angular';
import { CalendarOptions, EventInput, EventDropArg, EventContentArg } from '@fullcalendar/core';
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
    MatTooltipModule,
    TranslocoPipe,
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
  private readonly translocoService = inject(TranslocoService);

  /** Loading state. */
  isLoading = signal(false);

  /** Whether at least one load has completed (prevents empty state flash on init). */
  hasLoaded = signal(false);

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

  /** Activity type → Material Icon name mapping. */
  private readonly typeIconMap: Record<string, string> = {
    Task: 'task_alt',
    Call: 'phone',
    Meeting: 'groups',
  };

  /** Event counts by activity type for stat chips. */
  typeCounts = computed(() => {
    const counts: Record<string, number> = {};
    for (const e of this.events()) {
      const type = e.extendedProps?.type || 'Other';
      counts[type] = (counts[type] || 0) + 1;
    }
    return counts;
  });

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
    eventContent: (arg: EventContentArg) => this.renderEventContent(arg),
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
            this.snackBar.open(this.translocoService.translate('calendar.messages.rescheduled'), 'Close', { duration: 2000 });
          },
          error: () => {
            info.revert();
            this.snackBar.open(this.translocoService.translate('calendar.messages.rescheduleFailed'), 'Close', { duration: 5000 });
          },
        });
      },
      error: () => {
        info.revert();
        this.snackBar.open(this.translocoService.translate('calendar.messages.rescheduleFailed'), 'Close', { duration: 5000 });
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
        this.hasLoaded.set(true);
      },
      error: () => {
        this.isLoading.set(false);
        this.snackBar.open(this.translocoService.translate('calendar.messages.loadFailed'), 'Close', { duration: 5000 });
      },
    });
  }

  /**
   * Custom event content renderer — shows type icon + time + truncated title.
   * Returns HTML string for FullCalendar to render inside each event element.
   */
  renderEventContent(arg: EventContentArg): { html: string } {
    const type = arg.event.extendedProps?.['type'] || 'Task';
    const icon = this.typeIconMap[type] || 'event';
    const time = arg.timeText || '';
    const title = this.escapeHtml(arg.event.title || '');

    return {
      html: `<div class="cal-event-inner">
        <span class="material-icons cal-event-inner__icon">${icon}</span>
        <div class="cal-event-inner__content">
          ${time ? `<span class="cal-event-inner__time">${this.escapeHtml(time)}</span>` : ''}
          <span class="cal-event-inner__title">${title}</span>
        </div>
      </div>`,
    };
  }

  /**
   * Map CalendarEventDto[] to FullCalendar EventInput[] with priority/type classNames.
   * CSS custom properties on the className handle coloring via the stylesheet.
   */
  private mapToCalendarEvents(events: CalendarEventDto[]): EventInput[] {
    return events.map((e) => ({
      id: e.id,
      title: e.title,
      start: e.start,
      end: e.end,
      classNames: [
        `cal-priority-${(e.extendedProps?.priority || 'Medium').toLowerCase()}`,
        `cal-type-${(e.extendedProps?.type || 'Task').toLowerCase()}`,
      ],
      extendedProps: e.extendedProps,
    }));
  }

  /** Escape HTML to prevent XSS in custom event content. */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { TranslocoPipe } from '@jsverse/transloco';
import { FullCalendarModule } from '@fullcalendar/angular';
import { CalendarOptions, EventInput } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { DealService } from '../deal.service';
import { PipelineService } from '../pipeline.service';
import { PipelineDto, DealListDto } from '../deal.models';

/**
 * Calendar view for deals displaying deals by expected close date.
 * Uses FullCalendar for month grid rendering with color-coded stage events.
 * Supports pipeline filtering and click-to-navigate to deal detail.
 */
@Component({
  selector: 'app-deal-calendar',
  standalone: true,
  imports: [
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatFormFieldModule,
    MatButtonToggleModule,
    MatProgressBarModule,
    FullCalendarModule,
    TranslocoPipe,
  ],
  templateUrl: './deal-calendar.component.html',
  styleUrl: './deal-calendar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DealCalendarComponent implements OnInit {
  private readonly dealService = inject(DealService);
  private readonly pipelineService = inject(PipelineService);
  private readonly router = inject(Router);

  /** All pipelines for the filter dropdown. */
  pipelines = signal<PipelineDto[]>([]);

  /** Currently selected pipeline ID (null = all pipelines). */
  selectedPipelineId = signal<string | null>(null);

  /** All loaded deals. */
  deals = signal<DealListDto[]>([]);

  /** FullCalendar configuration options. */
  calendarOptions = signal<CalendarOptions>({
    plugins: [dayGridPlugin, interactionPlugin],
    initialView: 'dayGridMonth',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: '',
    },
    events: [],
    eventClick: (info) => {
      this.router.navigate(['/deals', info.event.id]);
    },
    height: 'auto',
  });

  /** Loading state. */
  isLoading = signal<boolean>(false);

  ngOnInit(): void {
    this.loadPipelines();
    this.loadDeals();
  }

  /** Load all pipelines for the filter dropdown. */
  private loadPipelines(): void {
    this.pipelineService.getAll().subscribe({
      next: (pipelines) => this.pipelines.set(pipelines),
      error: () => {},
    });
  }

  /** Load deals with optional pipeline filter. */
  private loadDeals(): void {
    this.isLoading.set(true);
    const params: any = { page: 1, pageSize: 500 };
    const pipelineId = this.selectedPipelineId();
    if (pipelineId) {
      params.pipelineId = pipelineId;
    }

    this.dealService.getList(params).subscribe({
      next: (result) => {
        this.deals.set(result.items);
        const events = this.mapDealsToEvents(result.items);
        this.calendarOptions.update((opts) => ({ ...opts, events }));
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      },
    });
  }

  /** Map deals to FullCalendar EventInput objects. */
  private mapDealsToEvents(deals: DealListDto[]): EventInput[] {
    return deals
      .filter((d) => d.expectedCloseDate != null)
      .map((d) => ({
        id: d.id,
        title: `${d.title}${d.value ? ' - $' + d.value.toLocaleString() : ''}`,
        date: d.expectedCloseDate!,
        backgroundColor: d.stageColor || '#1976d2',
        borderColor: d.stageColor || '#1976d2',
        extendedProps: {
          companyName: d.companyName,
          stageName: d.stageName,
          value: d.value,
        },
      }));
  }

  /** Handle pipeline filter selection change. */
  onPipelineChanged(pipelineId: string | null): void {
    this.selectedPipelineId.set(pipelineId);
    this.loadDeals();
  }
}

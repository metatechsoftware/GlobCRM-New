import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  inject,
  signal,
  computed,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatSelectModule } from '@angular/material/select';
import { HasPermissionDirective } from '../../../core/permissions/has-permission.directive';
import {
  RelatedEntityTabsComponent,
  EntityTab,
} from '../../../shared/components/related-entity-tabs/related-entity-tabs.component';
import { EntityTimelineComponent } from '../../../shared/components/entity-timeline/entity-timeline.component';
import { EntityAttachmentsComponent } from '../../../shared/components/entity-attachments/entity-attachments.component';
import { CustomFieldFormComponent } from '../../../shared/components/custom-field-form/custom-field-form.component';
import { ConfirmDeleteDialogComponent } from '../../../shared/components/confirm-delete-dialog/confirm-delete-dialog.component';
import { TimelineEntry } from '../../../shared/models/query.models';
import { LeadService } from '../lead.service';
import {
  LeadDetailDto,
  LeadStageDto,
} from '../lead.models';
import { NoteService } from '../../notes/note.service';
import { NoteListDto } from '../../notes/note.models';
import { ActivityService } from '../../activities/activity.service';
import { ActivityListDto, ACTIVITY_STATUSES, ACTIVITY_PRIORITIES } from '../../activities/activity.models';
import { EntitySummaryTabComponent } from '../../../shared/components/summary-tab/entity-summary-tab.component';
import { EntityFormDialogComponent } from '../../../shared/components/entity-form-dialog/entity-form-dialog.component';
import { EntityFormDialogData, EntityFormDialogResult } from '../../../shared/components/entity-form-dialog/entity-form-dialog.models';
import { SummaryService } from '../../../shared/components/summary-tab/summary.service';
import { LeadSummaryDto } from '../../../shared/components/summary-tab/summary.models';

/**
 * Lead detail page with interactive stage stepper, temperature badge, source tag,
 * Convert Lead button, and 6 entity tabs (Overview, Activities, Notes, Attachments,
 * Timeline, Conversion). Converted leads are read-only.
 */
@Component({
  selector: 'app-lead-detail',
  standalone: true,
  imports: [
    RouterLink,
    DatePipe,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    MatSnackBarModule,
    MatTabsModule,
    MatSelectModule,
    HasPermissionDirective,
    RelatedEntityTabsComponent,
    EntityTimelineComponent,
    EntityAttachmentsComponent,
    CustomFieldFormComponent,
    EntitySummaryTabComponent,
  ],
  templateUrl: './lead-detail.component.html',
  styleUrl: './lead-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeadDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly leadService = inject(LeadService);
  private readonly noteService = inject(NoteService);
  private readonly activityService = inject(ActivityService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly summaryService = inject(SummaryService);

  /** Lead detail data. */
  lead = signal<LeadDetailDto | null>(null);
  isLoading = signal(true);

  /** All lead stages for the stepper. */
  stages = signal<LeadStageDto[]>([]);

  /** Timeline entries. */
  timelineEntries = signal<TimelineEntry[]>([]);
  timelineLoading = signal(false);

  /** Notes linked to this lead. */
  leadNotes = signal<NoteListDto[]>([]);
  notesLoading = signal(false);
  notesLoaded = signal(false);

  /** Activities linked to this lead. */
  linkedActivities = signal<ActivityListDto[]>([]);
  activitiesLoading = signal(false);
  activitiesLoaded = signal(false);

  /** Summary tab data. */
  summaryData = signal<LeadSummaryDto | null>(null);
  summaryLoading = signal(false);
  summaryDirty = signal(false);
  activeTabIndex = signal(0);

  /** Current lead ID from route. */
  private leadId = '';

  /** Whether stage confirmation dialog is open (prevents double-click). */
  stageChangeInProgress = signal(false);

  /** Computed: whether lead is in a terminal stage. */
  isTerminal = computed(() => {
    const lead = this.lead();
    if (!lead) return false;
    const stage = this.stages().find(s => s.id === lead.leadStageId);
    return stage?.isConverted || stage?.isLost || lead.isConverted;
  });

  /** Computed: sorted active (non-terminal) stages for the stepper. */
  activeStages = computed(() => {
    return this.stages()
      .filter(s => !s.isConverted && !s.isLost)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  });

  /** Computed: terminal stages. */
  terminalStages = computed(() => {
    return this.stages()
      .filter(s => s.isConverted || s.isLost)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  });

  /** Computed: current stage object. */
  currentStage = computed(() => {
    const lead = this.lead();
    if (!lead) return null;
    return this.stages().find(s => s.id === lead.leadStageId) ?? null;
  });

  /** Tab configuration -- dynamically includes Conversion tab when converted. */
  tabs = computed<EntityTab[]>(() => {
    const baseTabs: EntityTab[] = [
      { label: 'Summary', icon: 'dashboard', enabled: true },
      { label: 'Overview', icon: 'info', enabled: true },
      { label: 'Activities', icon: 'task_alt', enabled: true },
      { label: 'Notes', icon: 'note', enabled: true },
      { label: 'Attachments', icon: 'attach_file', enabled: true },
      { label: 'Timeline', icon: 'timeline', enabled: true },
    ];
    if (this.lead()?.isConverted) {
      baseTabs.push({ label: 'Conversion', icon: 'swap_horiz', enabled: true });
    }
    return baseTabs;
  });

  ngOnInit(): void {
    this.leadId = this.route.snapshot.paramMap.get('id') ?? '';
    if (!this.leadId) {
      this.isLoading.set(false);
      return;
    }
    this.loadLead();
    this.loadStages();
    this.loadTimeline();
    this.loadSummary();
  }

  /** Load summary data for the Summary tab. */
  private loadSummary(): void {
    this.summaryLoading.set(true);
    this.summaryDirty.set(false);
    this.summaryService.getLeadSummary(this.leadId).subscribe({
      next: (data) => {
        this.summaryData.set(data);
        this.summaryLoading.set(false);
      },
      error: () => this.summaryLoading.set(false),
    });
  }

  /** Mark summary data as stale. */
  markSummaryDirty(): void {
    this.summaryDirty.set(true);
  }

  /** Load lead detail data. */
  private loadLead(): void {
    this.isLoading.set(true);
    this.leadService.getById(this.leadId).subscribe({
      next: (lead) => {
        this.lead.set(lead);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.snackBar.open('Failed to load lead', 'Close', { duration: 5000 });
        this.router.navigate(['/leads']);
      },
    });
  }

  /** Load all stages for the stepper. */
  private loadStages(): void {
    this.leadService.getStages().subscribe({
      next: (stages) => this.stages.set(stages),
      error: () => {},
    });
  }

  /** Load timeline entries. */
  private loadTimeline(): void {
    this.timelineLoading.set(true);
    this.leadService.getTimeline(this.leadId).subscribe({
      next: (entries) => {
        // Map to TimelineEntry format
        this.timelineEntries.set(
          entries.map((e, i) => ({
            id: `${i}`,
            type: 'stage_changed' as const,
            title: e.type,
            description: e.description,
            timestamp: e.timestamp,
            userId: e.userId,
            userName: e.userName,
          })),
        );
        this.timelineLoading.set(false);
      },
      error: () => {
        this.timelineLoading.set(false);
      },
    });
  }

  /** Handle tab change -- lazy load data for certain tabs. */
  onTabChanged(label: string): void {
    if (label === 'Summary') {
      if (!this.summaryData() || this.summaryDirty()) {
        this.loadSummary();
      }
      return;
    }
    if (label === 'Activities') {
      this.loadLinkedActivities();
    }
    if (label === 'Notes') {
      this.loadLeadNotes();
    }
  }

  /** Load activities linked to this lead (lazy on tab switch). */
  private loadLinkedActivities(): void {
    if (this.activitiesLoaded() || this.activitiesLoading()) return;

    this.activitiesLoading.set(true);
    this.activityService
      .getList({ linkedEntityType: 'Lead', linkedEntityId: this.leadId, page: 1, pageSize: 50 })
      .subscribe({
        next: (result) => {
          this.linkedActivities.set(result.items);
          this.activitiesLoading.set(false);
          this.activitiesLoaded.set(true);
        },
        error: () => {
          this.activitiesLoading.set(false);
        },
      });
  }

  /** Load notes linked to this lead (lazy on tab switch). */
  private loadLeadNotes(): void {
    if (this.notesLoaded() || this.notesLoading()) return;

    this.notesLoading.set(true);
    this.noteService.getEntityNotes('Lead', this.leadId).subscribe({
      next: (notes) => {
        this.leadNotes.set(notes);
        this.notesLoading.set(false);
        this.notesLoaded.set(true);
      },
      error: () => {
        this.notesLoading.set(false);
      },
    });
  }

  /** Get temperature color for badge. */
  getTemperatureColor(temperature: string): string {
    switch (temperature) {
      case 'hot': return '#f44336';
      case 'warm': return '#ff9800';
      case 'cold': return '#2196f3';
      default: return '#9e9e9e';
    }
  }

  /** Get status color for activity chip. */
  getStatusColor(status: string): string {
    return ACTIVITY_STATUSES.find(s => s.value === status)?.color ?? 'var(--color-text-muted)';
  }

  /** Get priority color for activity chip. */
  getPriorityColor(priority: string): string {
    return ACTIVITY_PRIORITIES.find(p => p.value === priority)?.color ?? 'var(--color-text-muted)';
  }

  /** Whether a stage in the stepper is "past" (before current). */
  isStagePast(stage: LeadStageDto): boolean {
    const current = this.currentStage();
    if (!current) return false;
    return stage.sortOrder < current.sortOrder;
  }

  /** Whether a stage is the current stage. */
  isStageCurrent(stage: LeadStageDto): boolean {
    const lead = this.lead();
    return lead?.leadStageId === stage.id;
  }

  /** Whether a stage is clickable (future, non-terminal, and lead not terminal). */
  isStageClickable(stage: LeadStageDto): boolean {
    if (this.isTerminal()) return false;
    const current = this.currentStage();
    if (!current) return false;
    return stage.sortOrder > current.sortOrder && !stage.isConverted && !stage.isLost;
  }

  /** Handle clicking a future stage in the stepper. */
  onStageClick(stage: LeadStageDto): void {
    if (!this.isStageClickable(stage)) return;
    if (this.stageChangeInProgress()) return;

    const dialogRef = this.dialog.open(ConfirmDeleteDialogComponent, {
      width: '400px',
      data: { name: stage.name, type: 'stage change' },
    });

    dialogRef.afterClosed().subscribe((confirmed: boolean) => {
      if (confirmed) {
        this.stageChangeInProgress.set(true);
        this.leadService.updateStage(this.leadId, stage.id).subscribe({
          next: (updated) => {
            this.lead.set(updated);
            this.stageChangeInProgress.set(false);
            this.snackBar.open(`Lead moved to ${stage.name}`, 'OK', { duration: 3000 });
            this.loadTimeline();
            this.markSummaryDirty();
          },
          error: () => {
            this.stageChangeInProgress.set(false);
            this.snackBar.open('Failed to update stage', 'Close', { duration: 5000 });
          },
        });
      }
    });
  }

  /** Reopen a lead from a terminal stage. */
  onReopen(): void {
    // We show a simple dialog to pick a stage
    // For simplicity, move to the first active stage
    const firstActive = this.activeStages()[0];
    if (!firstActive) return;

    const dialogRef = this.dialog.open(ConfirmDeleteDialogComponent, {
      width: '400px',
      data: { name: firstActive.name, type: 'reopen to stage' },
    });

    dialogRef.afterClosed().subscribe((confirmed: boolean) => {
      if (confirmed) {
        this.leadService.reopenLead(this.leadId, firstActive.id).subscribe({
          next: (updated) => {
            this.lead.set(updated);
            this.snackBar.open(`Lead reopened to ${firstActive.name}`, 'OK', { duration: 3000 });
            this.loadTimeline();
            this.markSummaryDirty();
          },
          error: () => {
            this.snackBar.open('Failed to reopen lead', 'Close', { duration: 5000 });
          },
        });
      }
    });
  }

  /** Open the convert lead dialog. */
  onConvert(): void {
    const lead = this.lead();
    if (!lead) return;

    import('../lead-convert/lead-convert-dialog.component').then((m) => {
      const dialogRef = this.dialog.open(m.LeadConvertDialogComponent, {
        data: { lead },
        width: '700px',
        disableClose: true,
      });

      dialogRef.afterClosed().subscribe((result) => {
        if (result) {
          // Reload lead to show converted state
          this.loadLead();
          this.loadTimeline();
          this.markSummaryDirty();
          this.snackBar.open('Lead converted successfully', 'OK', { duration: 3000 });
        }
      });
    });
  }

  /** Handle association chip click -- switch to the corresponding tab. */
  onAssociationClicked(label: string): void {
    const index = this.tabs().findIndex(t => t.label === label);
    if (index >= 0) {
      this.activeTabIndex.set(index);
    }
  }

  /** Quick action: Add Note via dialog. */
  onSummaryAddNote(): void {
    const dialogRef = this.dialog.open(EntityFormDialogComponent, {
      width: '700px',
      data: {
        entityType: 'Note',
        prefill: {
          entityType: 'Lead',
          entityId: this.leadId,
          entityName: this.lead()?.fullName,
        },
      } as EntityFormDialogData,
    });
    dialogRef.afterClosed().subscribe((result: EntityFormDialogResult | undefined) => {
      if (result?.entity) {
        this.loadSummary();
      }
    });
  }

  /** Quick action: Log Activity via dialog. */
  onSummaryLogActivity(): void {
    const dialogRef = this.dialog.open(EntityFormDialogComponent, {
      width: '700px',
      data: {
        entityType: 'Activity',
        prefill: {
          entityType: 'Lead',
          entityId: this.leadId,
          entityName: this.lead()?.fullName,
        },
      } as EntityFormDialogData,
    });
    dialogRef.afterClosed().subscribe((result: EntityFormDialogResult | undefined) => {
      if (result?.entity) {
        this.loadSummary();
      }
    });
  }

  /** Quick action: Send Email for this lead. */
  onSummarySendEmail(): void {
    this.router.navigate(['/emails/compose'], {
      queryParams: {
        contactName: this.lead()?.fullName,
        email: this.lead()?.email,
      },
    });
  }

  /** Handle delete with confirmation dialog. */
  onDelete(): void {
    const lead = this.lead();
    if (!lead) return;

    const dialogRef = this.dialog.open(ConfirmDeleteDialogComponent, {
      width: '400px',
      data: { name: lead.fullName, type: 'lead' },
    });

    dialogRef.afterClosed().subscribe((confirmed: boolean) => {
      if (confirmed) {
        this.leadService.delete(this.leadId).subscribe({
          next: () => {
            this.snackBar.open('Lead deleted', 'OK', { duration: 3000 });
            this.router.navigate(['/leads']);
          },
          error: () => {
            this.snackBar.open('Failed to delete lead', 'Close', { duration: 5000 });
          },
        });
      }
    });
  }

  /** Get initials from lead full name for hero avatar. */
  getInitials(): string {
    const name = this.lead()?.fullName ?? '';
    const words = name.trim().split(/\s+/);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  /** Format note date for display. */
  formatNoteDate(dateStr: string): string {
    if (!dateStr) return '';
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(dateStr));
  }
}

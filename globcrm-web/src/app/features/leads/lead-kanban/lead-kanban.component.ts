import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  inject,
  signal,
  computed,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import {
  CdkDropListGroup,
  CdkDropList,
  CdkDrag,
  CdkDragDrop,
  moveItemInArray,
  transferArrayItem,
} from '@angular/cdk/drag-drop';
import { HasPermissionDirective } from '../../../core/permissions/has-permission.directive';
import { LeadService } from '../lead.service';
import {
  LeadKanbanDto,
  LeadKanbanStageDto,
  LeadKanbanCardDto,
} from '../lead.models';

/**
 * Kanban board component for visual lead pipeline management.
 * Uses Angular CDK drag-drop for stage transitions with optimistic updates.
 * Enforces forward-only progression: backward moves are rejected with a snackbar.
 * Terminal stages (Converted/Lost) are drop targets but not drag sources.
 */
@Component({
  selector: 'app-lead-kanban',
  standalone: true,
  imports: [
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatSlideToggleModule,
    MatSnackBarModule,
    MatButtonToggleModule,
    MatProgressBarModule,
    CdkDropListGroup,
    CdkDropList,
    CdkDrag,
    HasPermissionDirective,
  ],
  templateUrl: './lead-kanban.component.html',
  styleUrl: './lead-kanban.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeadKanbanComponent implements OnInit {
  private readonly leadService = inject(LeadService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);

  /** Loaded Kanban data with stages and lead cards. */
  kanbanData = signal<LeadKanbanDto | null>(null);

  /** Loading state for data fetches. */
  isLoading = signal<boolean>(false);

  /** Toggle to show/hide terminal stages (Converted/Lost). */
  includeTerminal = signal<boolean>(false);

  /** Computed: stages with their grouped leads for template rendering. */
  stagesWithLeads = computed(() => {
    const data = this.kanbanData();
    if (!data) return [];

    const leadsByStage = new Map<string, LeadKanbanCardDto[]>();
    for (const stage of data.stages) {
      leadsByStage.set(stage.id, []);
    }
    for (const lead of data.leads) {
      const stageLeads = leadsByStage.get(lead.leadStageId);
      if (stageLeads) {
        stageLeads.push(lead);
      }
    }

    return data.stages.map((stage) => ({
      ...stage,
      leads: leadsByStage.get(stage.id) ?? [],
    }));
  });

  /** Stage lookup for forward-only enforcement. */
  private stageMap = computed(() => {
    const data = this.kanbanData();
    if (!data) return new Map<string, LeadKanbanStageDto>();
    return new Map(data.stages.map((s) => [s.id, s]));
  });

  ngOnInit(): void {
    this.loadKanban();
  }

  /** Load Kanban data from API. */
  loadKanban(): void {
    this.isLoading.set(true);
    this.leadService.getKanban(this.includeTerminal()).subscribe({
      next: (data) => {
        this.kanbanData.set(data);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.snackBar.open('Failed to load Kanban data', 'Dismiss', {
          duration: 3000,
        });
      },
    });
  }

  /** Handle terminal stage toggle change. */
  onTerminalToggled(checked: boolean): void {
    this.includeTerminal.set(checked);
    this.loadKanban();
  }

  /**
   * Handle CDK drag-drop events for stage transitions.
   * Enforces forward-only: target stage SortOrder must be > source stage SortOrder.
   * Dropping on Converted stage is rejected (use Convert Lead action on detail page).
   * Performs optimistic UI update, then calls API. On failure, reverts.
   */
  onDrop(event: CdkDragDrop<LeadKanbanCardDto[]>, targetStageId: string): void {
    if (event.previousContainer === event.container) {
      // Reorder within same column -- just visual, no API call
      moveItemInArray(
        event.container.data,
        event.previousIndex,
        event.currentIndex,
      );
      return;
    }

    // Cross-column transfer (stage change)
    const lead = event.previousContainer.data[event.previousIndex];
    const sourceStageId = lead.leadStageId;
    const stages = this.stageMap();
    const sourceStage = stages.get(sourceStageId);
    const targetStage = stages.get(targetStageId);

    if (!sourceStage || !targetStage) return;

    // Reject dropping on Converted stage -- use Convert Lead action
    if (targetStage.isConverted) {
      this.snackBar.open(
        'Use the Convert Lead action on the detail page',
        'Dismiss',
        { duration: 4000 },
      );
      return;
    }

    // Forward-only enforcement
    if (targetStage.sortOrder <= sourceStage.sortOrder) {
      this.snackBar.open(
        'Leads can only move forward. Use Reopen to move backward.',
        'Dismiss',
        { duration: 4000 },
      );
      return;
    }

    // Optimistic update: move card immediately
    transferArrayItem(
      event.previousContainer.data,
      event.container.data,
      event.previousIndex,
      event.currentIndex,
    );

    // Update the lead's stageId locally for consistency
    lead.leadStageId = targetStageId;

    // API call to persist stage change
    this.leadService.updateStage(lead.id, targetStageId).subscribe({
      error: () => {
        // Revert on failure: move card back
        lead.leadStageId = sourceStageId;
        transferArrayItem(
          event.container.data,
          event.previousContainer.data,
          event.currentIndex,
          event.previousIndex,
        );
        this.snackBar.open('Failed to update lead stage', 'Dismiss', {
          duration: 3000,
        });
      },
    });
  }

  /** Check if a stage is terminal (drag disabled from terminal stages). */
  isTerminalStage(stageId: string): boolean {
    const stage = this.stageMap().get(stageId);
    return stage ? (stage.isConverted || stage.isLost) : false;
  }

  /** Navigate to lead detail page. */
  openLead(id: string): void {
    this.router.navigate(['/leads', id]);
  }
}

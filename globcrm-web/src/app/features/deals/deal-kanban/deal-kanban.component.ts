import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  inject,
  signal,
  computed,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
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
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { HasPermissionDirective } from '../../../core/permissions/has-permission.directive';
import { DealService } from '../deal.service';
import { PipelineService } from '../pipeline.service';
import {
  PipelineDto,
  KanbanDto,
  KanbanStageDto,
  DealKanbanCardDto,
} from '../deal.models';

/**
 * Kanban board component for visual deal pipeline management.
 * Uses Angular CDK drag-drop for stage transitions with optimistic updates.
 * Supports pipeline switching and terminal stage toggling (Closed Won/Lost).
 */
@Component({
  selector: 'app-deal-kanban',
  standalone: true,
  imports: [
    CurrencyPipe,
    DatePipe,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatFormFieldModule,
    MatSlideToggleModule,
    MatSnackBarModule,
    MatButtonToggleModule,
    MatProgressBarModule,
    CdkDropListGroup,
    CdkDropList,
    CdkDrag,
    HasPermissionDirective,
    TranslocoPipe,
  ],
  templateUrl: './deal-kanban.component.html',
  styleUrl: './deal-kanban.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DealKanbanComponent implements OnInit {
  private readonly dealService = inject(DealService);
  private readonly pipelineService = inject(PipelineService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly transloco = inject(TranslocoService);

  /** All pipelines for the selector dropdown. */
  pipelines = signal<PipelineDto[]>([]);

  /** Currently selected pipeline ID. */
  selectedPipelineId = signal<string | null>(null);

  /** Loaded Kanban data with stages and deal cards. */
  kanbanData = signal<KanbanDto | null>(null);

  /** Loading state for data fetches. */
  isLoading = signal<boolean>(false);

  /** Toggle to show/hide terminal stages (Closed Won/Lost). */
  includeTerminal = signal<boolean>(false);

  /** Stage lookup for forward-only enforcement. */
  private stageMap = computed(() => {
    const data = this.kanbanData();
    if (!data) return new Map<string, KanbanStageDto>();
    return new Map(data.stages.map((s) => [s.id, s]));
  });

  ngOnInit(): void {
    this.loadPipelines();
  }

  /** Load all pipelines and select the default one. */
  private loadPipelines(): void {
    this.pipelineService.getAll().subscribe({
      next: (pipelines) => {
        this.pipelines.set(pipelines);

        if (pipelines.length > 0) {
          // Select default pipeline, or first in list
          const defaultPipeline =
            pipelines.find((p) => p.isDefault) ?? pipelines[0];
          this.selectedPipelineId.set(defaultPipeline.id);
          this.loadKanban();
        }
      },
      error: () => {
        this.snackBar.open(this.transloco.translate('deals.messages.pipelineLoadFailed'), 'Dismiss', {
          duration: 3000,
        });
      },
    });
  }

  /** Load Kanban data for the currently selected pipeline. */
  loadKanban(): void {
    const pipelineId = this.selectedPipelineId();
    if (!pipelineId) return;

    this.isLoading.set(true);
    this.dealService.getKanban(pipelineId, this.includeTerminal()).subscribe({
      next: (data) => {
        this.kanbanData.set(data);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.snackBar.open(this.transloco.translate('deals.messages.kanbanLoadFailed'), 'Dismiss', {
          duration: 3000,
        });
      },
    });
  }

  /** Handle pipeline selection change. */
  onPipelineChanged(pipelineId: string): void {
    this.selectedPipelineId.set(pipelineId);
    this.loadKanban();
  }

  /** Handle terminal stage toggle change. */
  onTerminalToggled(checked: boolean): void {
    this.includeTerminal.set(checked);
    this.loadKanban();
  }

  /**
   * Handle CDK drag-drop events for stage transitions.
   * Enforces forward-only: target stage sortOrder must be > source stage sortOrder.
   * Performs optimistic UI update, then calls API. On failure, reverts.
   */
  onDrop(event: CdkDragDrop<DealKanbanCardDto[]>, targetStageId: string): void {
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
    const deal = event.previousContainer.data[event.previousIndex];

    // Extract source stage ID from container id (format: "stage-{uuid}")
    const sourceStageId = event.previousContainer.id.replace('stage-', '');
    const stages = this.stageMap();
    const sourceStage = stages.get(sourceStageId);
    const targetStage = stages.get(targetStageId);

    if (!sourceStage || !targetStage) return;

    // Forward-only enforcement
    if (targetStage.sortOrder <= sourceStage.sortOrder) {
      this.snackBar.open(
        this.transloco.translate('deals.kanban.forwardOnly'),
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

    // API call to persist stage change
    this.dealService.updateStage(deal.id, targetStageId).subscribe({
      error: () => {
        // Revert on failure: move card back
        transferArrayItem(
          event.container.data,
          event.previousContainer.data,
          event.currentIndex,
          event.previousIndex,
        );
        this.snackBar.open(this.transloco.translate('deals.messages.stageUpdateFailed'), 'Dismiss', {
          duration: 3000,
        });
      },
    });
  }

  /** Calculate total deal value for a stage column. */
  getColumnTotal(stage: KanbanStageDto): number {
    return stage.deals.reduce((sum, deal) => sum + (deal.value ?? 0), 0);
  }

  /** Check if a stage is terminal (Won or Lost). */
  isTerminalStage(stageId: string): boolean {
    const stage = this.stageMap().get(stageId);
    return stage ? stage.isWon || stage.isLost : false;
  }

  /** Get 2-letter uppercase initials from a name. */
  getOwnerInitials(name: string | null): string {
    if (!name) return '';
    const parts = name.trim().split(/\s+/);
    return parts.map((p) => p.charAt(0)).join('').substring(0, 2).toUpperCase();
  }

  /** Get days until close date (negative = overdue). */
  getDaysToClose(date: string | null): number | null {
    if (!date) return null;
    const close = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    close.setHours(0, 0, 0, 0);
    return Math.ceil((close.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  }

  /** Get urgency classification based on close date. */
  getCloseUrgency(date: string | null): 'overdue' | 'soon' | 'approaching' | 'future' | null {
    const days = this.getDaysToClose(date);
    if (days === null) return null;
    if (days < 0) return 'overdue';
    if (days <= 7) return 'soon';
    if (days <= 30) return 'approaching';
    return 'future';
  }

  /** Get human-readable close label. */
  getCloseLabel(date: string | null): string {
    const days = this.getDaysToClose(date);
    if (days === null) return '';
    if (days < 0) return `${Math.abs(days)}d overdue`;
    if (days === 0) return 'Due today';
    return `${days}d left`;
  }

  /** Navigate to deal detail page. */
  openDeal(id: string): void {
    this.router.navigate(['/deals', id]);
  }
}

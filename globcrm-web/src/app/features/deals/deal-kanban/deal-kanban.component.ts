import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CurrencyPipe } from '@angular/common';
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
        this.snackBar.open('Failed to load pipelines', 'Dismiss', {
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
        this.snackBar.open('Failed to load Kanban data', 'Dismiss', {
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
   * Performs optimistic UI update, then calls API.
   * On failure, reverts the card to its original column.
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
        this.snackBar.open('Failed to update deal stage', 'Dismiss', {
          duration: 3000,
        });
      },
    });
  }

  /** Calculate total deal value for a stage column. */
  getColumnTotal(stage: KanbanStageDto): number {
    return stage.deals.reduce((sum, deal) => sum + (deal.value ?? 0), 0);
  }

  /** Navigate to deal detail page. */
  openDeal(id: string): void {
    this.router.navigate(['/deals', id]);
  }
}

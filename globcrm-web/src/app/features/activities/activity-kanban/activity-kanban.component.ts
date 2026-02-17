import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';
import {
  CdkDropListGroup,
  CdkDropList,
  CdkDrag,
  CdkDragDrop,
  CdkDragPreview,
  CdkDragPlaceholder,
  moveItemInArray,
  transferArrayItem,
} from '@angular/cdk/drag-drop';
import { HasPermissionDirective } from '../../../core/permissions/has-permission.directive';
import { ActivityService } from '../activity.service';
import {
  ActivityStatus,
  ActivityKanbanColumnDto,
  ActivityKanbanCardDto,
  ACTIVITY_STATUSES,
  ACTIVITY_TYPES,
  ACTIVITY_PRIORITIES,
  ALLOWED_TRANSITIONS,
} from '../activity.models';

/**
 * Kanban board component for visual activity workflow management.
 * Displays fixed workflow columns (Assigned through Done) with CDK drag-drop
 * for status transitions. Uses optimistic UI updates with error revert.
 *
 * Key differences from Deal Kanban:
 * - No pipeline selector (fixed workflow columns from ACTIVITY_STATUSES)
 * - Client-side transition validation via ALLOWED_TRANSITIONS before API call
 * - Priority color indicator on cards instead of deal value
 */
@Component({
  selector: 'app-activity-kanban',
  standalone: true,
  imports: [
    DatePipe,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    MatButtonToggleModule,
    MatProgressBarModule,
    MatChipsModule,
    CdkDropListGroup,
    CdkDropList,
    CdkDrag,
    CdkDragPreview,
    CdkDragPlaceholder,
    HasPermissionDirective,
  ],
  templateUrl: './activity-kanban.component.html',
  styleUrl: './activity-kanban.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActivityKanbanComponent implements OnInit {
  private readonly activityService = inject(ActivityService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);

  /** Kanban columns initialized from ACTIVITY_STATUSES with empty activities arrays. */
  columns = signal<ActivityKanbanColumnDto[]>(
    ACTIVITY_STATUSES.map((s) => ({
      status: s.value,
      label: s.label,
      color: s.color,
      activities: [],
    })),
  );

  /** Loading state for data fetches. */
  isLoading = signal<boolean>(false);

  ngOnInit(): void {
    this.loadKanban();
  }

  /** Load Kanban data from API and populate columns. */
  loadKanban(): void {
    this.isLoading.set(true);
    this.activityService.getKanban().subscribe({
      next: (data) => {
        // Merge API data into fixed columns
        const columnMap = new Map(
          data.columns.map((col) => [col.status, col.activities]),
        );

        this.columns.set(
          ACTIVITY_STATUSES.map((s) => ({
            status: s.value,
            label: s.label,
            color: s.color,
            activities: columnMap.get(s.value) ?? [],
          })),
        );
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

  /**
   * Handle CDK drag-drop events for status transitions.
   * Validates transitions client-side before performing optimistic update.
   * On API failure, reverts the card to its original column.
   */
  onDrop(event: CdkDragDrop<ActivityKanbanCardDto[]>): void {
    if (event.previousContainer === event.container) {
      // Same column reorder (no status change needed)
      moveItemInArray(
        event.container.data,
        event.previousIndex,
        event.currentIndex,
      );
      return;
    }

    const activity = event.previousContainer.data[event.previousIndex];
    const fromStatus = event.previousContainer.id as ActivityStatus;
    const toStatus = event.container.id as ActivityStatus;

    // Client-side transition validation
    if (!ALLOWED_TRANSITIONS[fromStatus]?.includes(toStatus)) {
      this.snackBar.open(
        `Cannot move from ${this.getStatusLabel(fromStatus)} to ${this.getStatusLabel(toStatus)}`,
        'OK',
        { duration: 3000 },
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

    // API call to persist status change
    this.activityService.updateStatus(activity.id, toStatus).subscribe({
      error: () => {
        // Revert on failure: move card back
        transferArrayItem(
          event.container.data,
          event.previousContainer.data,
          event.currentIndex,
          event.previousIndex,
        );
        this.snackBar.open('Failed to update status', 'OK', {
          duration: 3000,
        });
      },
    });
  }

  /** Navigate to activity detail page on card click. */
  openActivity(id: string): void {
    this.router.navigate(['/activities', id]);
  }

  /** Get the type icon for an activity type. */
  getTypeIcon(type: string): string {
    return ACTIVITY_TYPES.find((t) => t.value === type)?.icon ?? 'task_alt';
  }

  /** Get the priority color for a priority level. */
  getPriorityColor(priority: string): string {
    return ACTIVITY_PRIORITIES.find((p) => p.value === priority)?.color ?? '#2196f3';
  }

  /** Get display label for a status value. */
  getStatusLabel(status: ActivityStatus): string {
    return ACTIVITY_STATUSES.find((s) => s.value === status)?.label ?? status;
  }

  /** Check if a due date is in the past (overdue). */
  isOverdue(dueDate: string | null): boolean {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  }

  /** Truncate text to a max length with ellipsis. */
  truncate(text: string, maxLength: number = 60): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }
}

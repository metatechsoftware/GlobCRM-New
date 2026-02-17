import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  inject,
  signal,
  computed,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { DatePipe } from '@angular/common';
import { HasPermissionDirective } from '../../../core/permissions/has-permission.directive';
import { PermissionStore } from '../../../core/permissions/permission.store';
import { AuthStore } from '../../../core/auth/auth.store';
import { ActivityService } from '../activity.service';
import {
  ActivityDetailDto,
  ActivityStatus,
  ACTIVITY_STATUSES,
  ACTIVITY_TYPES,
  ACTIVITY_PRIORITIES,
  ALLOWED_TRANSITIONS,
} from '../activity.models';
import { TimelineEntry } from '../../../shared/models/query.models';
import { ConfirmDeleteDialogComponent } from '../../settings/roles/role-list.component';

/**
 * Activity detail page with 6 tabs: Details, Comments, Attachments, Time Log, Links, Timeline.
 * Supports status workflow transitions, follow/unfollow, and full sub-entity CRUD.
 */
@Component({
  selector: 'app-activity-detail',
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
    HasPermissionDirective,
  ],
  templateUrl: './activity-detail.component.html',
  styleUrl: './activity-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActivityDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly activityService = inject(ActivityService);
  private readonly permissionStore = inject(PermissionStore);
  private readonly authStore = inject(AuthStore);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  /** Activity detail data. */
  activity = signal<ActivityDetailDto | null>(null);
  isLoading = signal(true);

  /** Timeline entries. */
  timelineEntries = signal<TimelineEntry[]>([]);
  timelineLoading = signal(false);

  /** Current active tab index. */
  activeTab = signal(0);

  /** Current activity ID from route. */
  private activityId = '';

  /** Current user ID for author checks. */
  private currentUserId = computed(() => this.authStore.user()?.id ?? '');

  /** Whether the current user is following this activity. */
  isFollowing = computed(() => {
    const act = this.activity();
    const userId = this.currentUserId();
    if (!act || !userId) return false;
    return act.followers.some((f) => f.userId === userId);
  });

  /** Allowed status transitions from current status. */
  allowedTransitions = computed(() => {
    const act = this.activity();
    if (!act) return [];
    return ALLOWED_TRANSITIONS[act.status] ?? [];
  });

  /** Get status config for a given status value. */
  getStatusConfig(status: ActivityStatus) {
    return ACTIVITY_STATUSES.find((s) => s.value === status);
  }

  /** Get type config for current activity. */
  typeConfig = computed(() => {
    const act = this.activity();
    if (!act) return null;
    return ACTIVITY_TYPES.find((t) => t.value === act.type) ?? null;
  });

  /** Get priority config for current activity. */
  priorityConfig = computed(() => {
    const act = this.activity();
    if (!act) return null;
    return ACTIVITY_PRIORITIES.find((p) => p.value === act.priority) ?? null;
  });

  /** Format total time from minutes. */
  formatTime(minutes: number): string {
    if (!minutes) return '0m';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  }

  /** Check if due date is overdue. */
  isOverdue = computed(() => {
    const act = this.activity();
    if (!act?.dueDate || act.status === 'Done') return false;
    return new Date(act.dueDate) < new Date();
  });

  ngOnInit(): void {
    this.activityId = this.route.snapshot.paramMap.get('id') ?? '';
    if (!this.activityId) {
      this.isLoading.set(false);
      return;
    }

    this.loadActivity();
    this.loadTimeline();
  }

  /** Load activity detail data. */
  loadActivity(): void {
    this.isLoading.set(true);
    this.activityService.getById(this.activityId).subscribe({
      next: (activity) => {
        this.activity.set(activity);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      },
    });
  }

  /** Load timeline entries. */
  loadTimeline(): void {
    this.timelineLoading.set(true);
    this.activityService.getTimeline(this.activityId).subscribe({
      next: (entries) => {
        this.timelineEntries.set(entries);
        this.timelineLoading.set(false);
      },
      error: () => {
        this.timelineLoading.set(false);
      },
    });
  }

  /** Transition activity to a new status. */
  transitionStatus(newStatus: ActivityStatus): void {
    if (newStatus === 'Done') {
      const dialogRef = this.dialog.open(ConfirmDeleteDialogComponent, {
        width: '400px',
        data: { name: this.activity()?.subject ?? '', type: 'activity completion' },
      });
      dialogRef.afterClosed().subscribe((confirmed: boolean) => {
        if (confirmed) {
          this.performStatusTransition(newStatus);
        }
      });
    } else {
      this.performStatusTransition(newStatus);
    }
  }

  private performStatusTransition(newStatus: ActivityStatus): void {
    this.activityService.updateStatus(this.activityId, newStatus).subscribe({
      next: () => {
        const label = ACTIVITY_STATUSES.find((s) => s.value === newStatus)?.label ?? newStatus;
        this.snackBar.open(`Status updated to ${label}`, 'OK', { duration: 3000 });
        this.loadActivity();
        this.loadTimeline();
      },
      error: () => {
        this.snackBar.open('Failed to update status', 'OK', { duration: 3000 });
      },
    });
  }

  /** Toggle follow/unfollow. */
  toggleFollow(): void {
    if (this.isFollowing()) {
      this.activityService.unfollow(this.activityId).subscribe({
        next: () => {
          this.snackBar.open('Unfollowed activity', 'OK', { duration: 3000 });
          this.loadActivity();
        },
        error: () => {
          this.snackBar.open('Failed to update follow status', 'OK', { duration: 3000 });
        },
      });
    } else {
      this.activityService.follow(this.activityId).subscribe({
        next: () => {
          this.snackBar.open('Following activity', 'OK', { duration: 3000 });
          this.loadActivity();
        },
        error: () => {
          this.snackBar.open('Failed to update follow status', 'OK', { duration: 3000 });
        },
      });
    }
  }

  /** Delete the activity. */
  onDelete(): void {
    const act = this.activity();
    if (!act) return;

    const dialogRef = this.dialog.open(ConfirmDeleteDialogComponent, {
      width: '400px',
      data: { name: act.subject, type: 'activity' },
    });

    dialogRef.afterClosed().subscribe((confirmed: boolean) => {
      if (confirmed) {
        this.activityService.delete(this.activityId).subscribe({
          next: () => {
            this.router.navigate(['/activities']);
          },
          error: () => {},
        });
      }
    });
  }
}

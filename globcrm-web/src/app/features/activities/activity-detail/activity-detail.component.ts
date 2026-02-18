import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  inject,
  signal,
  computed,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { provideNativeDateAdapter } from '@angular/material/core';
import { DatePipe } from '@angular/common';
import { Subject, debounceTime, distinctUntilChanged, switchMap, of } from 'rxjs';
import { HasPermissionDirective } from '../../../core/permissions/has-permission.directive';
import { PermissionStore } from '../../../core/permissions/permission.store';
import { AuthStore } from '../../../core/auth/auth.store';
import { NoteService } from '../../notes/note.service';
import { NoteListDto } from '../../notes/note.models';
import { ActivityService } from '../activity.service';
import {
  ActivityDetailDto,
  ActivityCommentDto,
  ActivityStatus,
  ACTIVITY_STATUSES,
  ACTIVITY_TYPES,
  ACTIVITY_PRIORITIES,
  ALLOWED_TRANSITIONS,
} from '../activity.models';
import { TimelineEntry } from '../../../shared/models/query.models';
import { ConfirmDeleteDialogComponent } from '../../settings/roles/role-list.component';
import { CompanyService } from '../../companies/company.service';
import { ContactService } from '../../contacts/contact.service';
import { DealService } from '../../deals/deal.service';
import { CompanyDto } from '../../companies/company.models';
import { ContactDto } from '../../contacts/contact.models';
import { DealListDto } from '../../deals/deal.models';

/** Timeline event type icon mapping for activity-specific events. */
const ACTIVITY_TIMELINE_ICONS: Record<string, string> = {
  created: 'add_circle',
  status_changed: 'swap_horiz',
  comment_added: 'comment',
  attachment_uploaded: 'attach_file',
  time_logged: 'schedule',
  entity_linked: 'link',
  updated: 'edit',
  entity_unlinked: 'link_off',
};

/** Timeline event type color mapping for activity-specific events. */
const ACTIVITY_TIMELINE_COLORS: Record<string, string> = {
  created: '#4caf50',
  status_changed: '#ff5722',
  comment_added: '#2196f3',
  attachment_uploaded: '#9c27b0',
  time_logged: '#00bcd4',
  entity_linked: '#ff9800',
  updated: '#607d8b',
  entity_unlinked: '#f44336',
};

/** Maximum file size for attachments (25MB). */
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

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
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    MatSnackBarModule,
    MatTabsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    HasPermissionDirective,
  ],
  providers: [provideNativeDateAdapter()],
  templateUrl: './activity-detail.component.html',
  styleUrl: './activity-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActivityDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly activityService = inject(ActivityService);
  private readonly noteService = inject(NoteService);
  private readonly companyService = inject(CompanyService);
  private readonly contactService = inject(ContactService);
  private readonly dealService = inject(DealService);
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

  /** Notes linked to this activity. */
  activityNotes = signal<NoteListDto[]>([]);
  notesLoading = signal(false);
  notesLoaded = signal(false);

  /** Current active tab index. */
  activeTab = signal(0);

  /** Current activity ID from route. */
  private activityId = '';

  /** Current user ID for author checks. */
  currentUserId = computed(() => this.authStore.user()?.id ?? '');

  /** Current user role for admin checks. */
  currentUserRole = computed(() => this.authStore.user()?.role ?? '');

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

  /** Sorted timeline entries (newest first). */
  sortedTimeline = computed(() => {
    const entries = this.timelineEntries();
    return [...entries].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  });

  // ─── Comment State ──────────────────────────────────────────────
  commentControl = new FormControl('', { nonNullable: true });
  editingCommentId = signal<string | null>(null);
  editCommentControl = new FormControl('', { nonNullable: true });

  // ─── Attachment State ───────────────────────────────────────────
  isUploading = signal(false);

  // ─── Time Entry State ───────────────────────────────────────────
  timeEntryForm = new FormGroup({
    durationMinutes: new FormControl<number | null>(null, [Validators.required, Validators.min(1)]),
    description: new FormControl('', { nonNullable: true }),
    entryDate: new FormControl<Date>(new Date(), { nonNullable: true }),
  });

  // ─── Link State ─────────────────────────────────────────────────
  showLinkSearch = signal(false);
  linkTypeControl = new FormControl<'Company' | 'Contact' | 'Deal'>('Company', { nonNullable: true });
  linkSearchControl = new FormControl('', { nonNullable: true });
  linkSearchResults = signal<Array<{ id: string; name: string; type: string }>>([]);
  linkSearchLoading = signal(false);
  private linkSearch$ = new Subject<string>();

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

  /** Format file size in human-readable form. */
  formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  /** Check if due date is overdue. */
  isOverdue = computed(() => {
    const act = this.activity();
    if (!act?.dueDate || act.status === 'Done') return false;
    return new Date(act.dueDate) < new Date();
  });

  /** Get links grouped by entity type. */
  linksByType = computed(() => {
    const act = this.activity();
    if (!act?.links?.length) return [];
    const groups: Record<string, typeof act.links> = {};
    for (const link of act.links) {
      const type = link.entityType;
      if (!groups[type]) groups[type] = [];
      groups[type].push(link);
    }
    return Object.entries(groups).map(([type, links]) => ({ type, links }));
  });

  /** Get timeline icon for event type. */
  getTimelineIcon(type: string): string {
    return ACTIVITY_TIMELINE_ICONS[type] ?? 'circle';
  }

  /** Get timeline color for event type. */
  getTimelineColor(type: string): string {
    return ACTIVITY_TIMELINE_COLORS[type] ?? 'var(--color-text-muted)';
  }

  /** Get route path for entity type. */
  getEntityRoute(entityType: string): string {
    switch (entityType) {
      case 'Company': return '/companies';
      case 'Contact': return '/contacts';
      case 'Deal': return '/deals';
      default: return '/';
    }
  }

  ngOnInit(): void {
    this.activityId = this.route.snapshot.paramMap.get('id') ?? '';
    if (!this.activityId) {
      this.isLoading.set(false);
      return;
    }

    this.loadActivity();
    this.loadTimeline();
    this.setupLinkSearch();
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

  /** Load notes linked to this activity (lazy on tab switch). */
  loadActivityNotes(): void {
    if (this.notesLoaded() || this.notesLoading()) return;

    this.notesLoading.set(true);
    this.noteService
      .getEntityNotes('Activity', this.activityId)
      .subscribe({
        next: (notes) => {
          this.activityNotes.set(notes);
          this.notesLoading.set(false);
          this.notesLoaded.set(true);
        },
        error: () => {
          this.notesLoading.set(false);
        },
      });
  }

  /** Handle tab change for lazy loading notes (index 6 = Notes). */
  onTabChange(index: number): void {
    if (index === 6) {
      this.loadActivityNotes();
    }
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

  // ─── Comment Methods ──────────────────────────────────────────────

  /** Add a new comment. */
  addComment(): void {
    const content = this.commentControl.value.trim();
    if (!content) return;

    this.activityService.addComment(this.activityId, content).subscribe({
      next: () => {
        this.commentControl.reset();
        this.snackBar.open('Comment added', 'OK', { duration: 3000 });
        this.loadActivity();
        this.loadTimeline();
      },
      error: () => {
        this.snackBar.open('Failed to add comment', 'OK', { duration: 3000 });
      },
    });
  }

  /** Start editing a comment inline. */
  startEditComment(comment: ActivityCommentDto): void {
    this.editingCommentId.set(comment.id);
    this.editCommentControl.setValue(comment.content);
  }

  /** Cancel editing a comment. */
  cancelEditComment(): void {
    this.editingCommentId.set(null);
    this.editCommentControl.reset();
  }

  /** Save the edited comment. */
  saveEditComment(commentId: string): void {
    const content = this.editCommentControl.value.trim();
    if (!content) return;

    this.activityService.updateComment(this.activityId, commentId, content).subscribe({
      next: () => {
        this.editingCommentId.set(null);
        this.editCommentControl.reset();
        this.snackBar.open('Comment updated', 'OK', { duration: 3000 });
        this.loadActivity();
      },
      error: () => {
        this.snackBar.open('Failed to update comment', 'OK', { duration: 3000 });
      },
    });
  }

  /** Delete a comment with confirmation. */
  deleteComment(commentId: string): void {
    const dialogRef = this.dialog.open(ConfirmDeleteDialogComponent, {
      width: '400px',
      data: { name: 'this comment', type: 'comment' },
    });

    dialogRef.afterClosed().subscribe((confirmed: boolean) => {
      if (confirmed) {
        this.activityService.deleteComment(this.activityId, commentId).subscribe({
          next: () => {
            this.snackBar.open('Comment deleted', 'OK', { duration: 3000 });
            this.loadActivity();
            this.loadTimeline();
          },
          error: () => {
            this.snackBar.open('Failed to delete comment', 'OK', { duration: 3000 });
          },
        });
      }
    });
  }

  /** Check if current user can edit a comment. */
  canEditComment(authorId: string): boolean {
    return authorId === this.currentUserId();
  }

  /** Check if current user can delete a comment. */
  canDeleteComment(authorId: string): boolean {
    return authorId === this.currentUserId() || this.currentUserRole() === 'Admin';
  }

  // ─── Attachment Methods ───────────────────────────────────────────

  /** Handle file selection from input. */
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    const file = input.files[0];
    if (file.size > MAX_FILE_SIZE_BYTES) {
      this.snackBar.open('File exceeds maximum size of 25MB', 'OK', { duration: 5000 });
      input.value = '';
      return;
    }

    this.uploadAttachment(file);
    input.value = '';
  }

  /** Upload a file attachment. */
  private uploadAttachment(file: File): void {
    this.isUploading.set(true);
    this.activityService.uploadAttachment(this.activityId, file).subscribe({
      next: () => {
        this.isUploading.set(false);
        this.snackBar.open(`Uploaded ${file.name}`, 'OK', { duration: 3000 });
        this.loadActivity();
        this.loadTimeline();
      },
      error: () => {
        this.isUploading.set(false);
        this.snackBar.open('Failed to upload file', 'OK', { duration: 3000 });
      },
    });
  }

  /** Download an attachment. */
  downloadAttachment(attachmentId: string, fileName: string): void {
    this.activityService.downloadAttachment(this.activityId, attachmentId).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: () => {
        this.snackBar.open('Failed to download file', 'OK', { duration: 3000 });
      },
    });
  }

  /** Delete an attachment with confirmation. */
  deleteAttachment(attachmentId: string, fileName: string): void {
    const dialogRef = this.dialog.open(ConfirmDeleteDialogComponent, {
      width: '400px',
      data: { name: fileName, type: 'attachment' },
    });

    dialogRef.afterClosed().subscribe((confirmed: boolean) => {
      if (confirmed) {
        this.activityService.deleteAttachment(this.activityId, attachmentId).subscribe({
          next: () => {
            this.snackBar.open('Attachment deleted', 'OK', { duration: 3000 });
            this.loadActivity();
            this.loadTimeline();
          },
          error: () => {
            this.snackBar.open('Failed to delete attachment', 'OK', { duration: 3000 });
          },
        });
      }
    });
  }

  // ─── Time Entry Methods ───────────────────────────────────────────

  /** Add a new time entry. */
  addTimeEntry(): void {
    if (this.timeEntryForm.invalid) return;

    const val = this.timeEntryForm.value;
    const entryDate = val.entryDate instanceof Date
      ? val.entryDate.toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];

    this.activityService.addTimeEntry(this.activityId, {
      durationMinutes: val.durationMinutes!,
      description: val.description || null,
      entryDate,
    }).subscribe({
      next: () => {
        this.timeEntryForm.reset({ entryDate: new Date() });
        this.snackBar.open('Time entry added', 'OK', { duration: 3000 });
        this.loadActivity();
        this.loadTimeline();
      },
      error: () => {
        this.snackBar.open('Failed to add time entry', 'OK', { duration: 3000 });
      },
    });
  }

  /** Delete a time entry. */
  deleteTimeEntry(entryId: string): void {
    this.activityService.deleteTimeEntry(this.activityId, entryId).subscribe({
      next: () => {
        this.snackBar.open('Time entry deleted', 'OK', { duration: 3000 });
        this.loadActivity();
        this.loadTimeline();
      },
      error: () => {
        this.snackBar.open('Failed to delete time entry', 'OK', { duration: 3000 });
      },
    });
  }

  // ─── Link Methods ─────────────────────────────────────────────────

  /** Toggle link search panel. */
  toggleLinkSearch(): void {
    this.showLinkSearch.update((v) => !v);
    if (!this.showLinkSearch()) {
      this.linkSearchControl.reset();
      this.linkSearchResults.set([]);
    }
  }

  /** Setup debounced link entity search. */
  private setupLinkSearch(): void {
    this.linkSearch$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((term) => {
          if (!term || term.length < 2) {
            return of([]);
          }
          this.linkSearchLoading.set(true);
          const type = this.linkTypeControl.value;
          return this.searchEntities(type, term);
        }),
      )
      .subscribe({
        next: (results) => {
          // Filter out already-linked entities of same type
          const linkedIds = new Set(
            this.activity()?.links
              ?.filter((l) => l.entityType === this.linkTypeControl.value)
              .map((l) => l.entityId) ?? [],
          );
          this.linkSearchResults.set(results.filter((r) => !linkedIds.has(r.id)));
          this.linkSearchLoading.set(false);
        },
        error: () => {
          this.linkSearchLoading.set(false);
        },
      });
  }

  /** Search entities by type. */
  private searchEntities(
    type: string,
    term: string,
  ) {
    switch (type) {
      case 'Company':
        return this.companyService
          .getList({ search: term, pageSize: 10 })
          .pipe(
            switchMap((result) =>
              of(result.items.map((c: CompanyDto) => ({ id: c.id, name: c.name, type: 'Company' }))),
            ),
          );
      case 'Contact':
        return this.contactService
          .getList({ search: term, pageSize: 10 })
          .pipe(
            switchMap((result) =>
              of(result.items.map((c: ContactDto) => ({ id: c.id, name: c.fullName, type: 'Contact' }))),
            ),
          );
      case 'Deal':
        return this.dealService
          .getList({ search: term, pageSize: 10 })
          .pipe(
            switchMap((result) =>
              of(result.items.map((d: DealListDto) => ({ id: d.id, name: d.title, type: 'Deal' }))),
            ),
          );
      default:
        return of([]);
    }
  }

  /** Trigger link search from input. */
  onLinkSearchInput(term: string): void {
    this.linkSearch$.next(term);
  }

  /** Reset search results when link type changes. */
  onLinkTypeChange(): void {
    this.linkSearchControl.reset();
    this.linkSearchResults.set([]);
  }

  /** Link an entity to this activity. */
  linkEntity(entityId: string, entityType: string, entityName: string): void {
    this.activityService.addLink(this.activityId, {
      entityType,
      entityId,
      entityName,
    }).subscribe({
      next: () => {
        this.snackBar.open(`Linked ${entityName}`, 'OK', { duration: 3000 });
        this.showLinkSearch.set(false);
        this.linkSearchControl.reset();
        this.linkSearchResults.set([]);
        this.loadActivity();
        this.loadTimeline();
      },
      error: () => {
        this.snackBar.open('Failed to link entity', 'OK', { duration: 3000 });
      },
    });
  }

  /** Unlink an entity from this activity. */
  unlinkEntity(linkId: string): void {
    this.activityService.deleteLink(this.activityId, linkId).subscribe({
      next: () => {
        this.snackBar.open('Link removed', 'OK', { duration: 3000 });
        this.loadActivity();
        this.loadTimeline();
      },
      error: () => {
        this.snackBar.open('Failed to remove link', 'OK', { duration: 3000 });
      },
    });
  }
}

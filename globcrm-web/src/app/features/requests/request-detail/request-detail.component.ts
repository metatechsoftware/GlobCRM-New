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
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { HasPermissionDirective } from '../../../core/permissions/has-permission.directive';
import { EntityTimelineComponent } from '../../../shared/components/entity-timeline/entity-timeline.component';
import { CustomFieldFormComponent } from '../../../shared/components/custom-field-form/custom-field-form.component';
import { EntityAttachmentsComponent } from '../../../shared/components/entity-attachments/entity-attachments.component';
import { NoteService } from '../../notes/note.service';
import { NoteListDto } from '../../notes/note.models';
import { RequestService } from '../request.service';
import {
  RequestDetailDto,
  RequestStatus,
  REQUEST_STATUSES,
  REQUEST_PRIORITIES,
  ALLOWED_TRANSITIONS,
} from '../request.models';
import { TimelineEntry } from '../../../shared/models/query.models';
import { ConfirmDeleteDialogComponent } from '../../../shared/components/confirm-delete-dialog/confirm-delete-dialog.component';
import { EntitySummaryTabComponent } from '../../../shared/components/summary-tab/entity-summary-tab.component';
import { EntityFormDialogComponent } from '../../../shared/components/entity-form-dialog/entity-form-dialog.component';
import { EntityFormDialogData, EntityFormDialogResult } from '../../../shared/components/entity-form-dialog/entity-form-dialog.models';
import { SummaryService } from '../../../shared/components/summary-tab/summary.service';
import { RequestSummaryDto } from '../../../shared/components/summary-tab/summary.models';

/**
 * Request detail page with status workflow, entity links, and timeline.
 * Shows header info, action bar with status transitions, info cards,
 * and 2 tabs: Details (description + custom fields) and Timeline.
 */
@Component({
  selector: 'app-request-detail',
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
    EntityTimelineComponent,
    CustomFieldFormComponent,
    EntityAttachmentsComponent,
    EntitySummaryTabComponent,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
    }

    .detail-container {
      max-width: 1100px;
      margin: 0 auto;
      padding: 24px;
    }

    .detail-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: 24px;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .header-left h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 500;
    }

    .header-badges {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .status-chip {
      display: inline-flex;
      align-items: center;
      padding: 4px 12px;
      border-radius: 16px;
      font-size: 13px;
      font-weight: 500;
      color: #fff;
    }

    .priority-badge {
      display: inline-flex;
      align-items: center;
      padding: 4px 12px;
      border-radius: 16px;
      font-size: 13px;
      font-weight: 500;
      color: #fff;
    }

    .loading-container {
      display: flex;
      justify-content: center;
      padding: 64px;
    }

    .action-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 24px;
      padding: 12px 16px;
      background: var(--color-bg-secondary);
      border-radius: 8px;
    }

    .action-bar .spacer {
      flex: 1;
    }

    .info-cards {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }

    .info-card {
      padding: 16px;
      background: var(--color-surface-hover);
      border-radius: 8px;
      border: 1px solid var(--color-border);
    }

    .info-card .label {
      font-size: 12px;
      color: var(--color-text-secondary);
      margin-bottom: 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .info-card .value {
      font-size: 16px;
      font-weight: 500;
    }

    .info-card a {
      color: var(--color-primary);
      text-decoration: none;
    }

    .info-card a:hover {
      text-decoration: underline;
    }

    /* Details tab */
    .details-section {
      padding: 16px 0;
    }

    .details-section h3 {
      margin: 0 0 8px;
      font-size: 14px;
      font-weight: 600;
      color: var(--color-text-secondary);
    }

    .details-section p {
      margin: 0 0 24px;
      font-size: 14px;
      white-space: pre-wrap;
    }

    .empty-state {
      text-align: center;
      padding: 48px 24px;
      color: var(--color-text-secondary);
    }

    .transition-buttons {
      display: flex;
      gap: 4px;
    }

    @media (max-width: 768px) {
      .detail-header {
        flex-direction: column;
        gap: 12px;
      }

      .action-bar {
        flex-direction: column;
      }

      .info-cards {
        grid-template-columns: repeat(2, 1fr);
      }
    }
  `,
  template: `
    @if (isLoading()) {
      <div class="loading-container">
        <mat-spinner diameter="48"></mat-spinner>
      </div>
    } @else if (request()) {
      <div class="detail-container">
        <!-- Header -->
        <div class="detail-header">
          <div class="header-left">
            <a mat-icon-button routerLink="/requests" aria-label="Back to requests">
              <mat-icon>arrow_back</mat-icon>
            </a>
            <div>
              <h1>{{ request()!.subject }}</h1>
              <div class="header-badges">
                <span class="status-chip"
                      [style.background-color]="getStatusColor(request()!.status)">
                  {{ getStatusLabel(request()!.status) }}
                </span>
                <span class="priority-badge"
                      [style.background-color]="getPriorityColor(request()!.priority)">
                  {{ getPriorityLabel(request()!.priority) }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Action Bar -->
        <div class="action-bar">
          <button mat-stroked-button routerLink="/requests/{{ request()!.id }}/edit"
                  *appHasPermission="'Request:Update'">
            <mat-icon>edit</mat-icon> {{ 'requests.detail.actions.edit' | transloco }}
          </button>
          <button mat-stroked-button (click)="onDelete()"
                  *appHasPermission="'Request:Delete'">
            <mat-icon>delete</mat-icon> {{ 'requests.detail.actions.delete' | transloco }}
          </button>
          <span class="spacer"></span>
          <div class="transition-buttons">
            @for (transition of allowedTransitions(); track transition) {
              <button mat-flat-button color="primary"
                      (click)="onTransitionStatus(transition)">
                {{ getTransitionLabel(transition) }}
              </button>
            }
          </div>
        </div>

        <!-- Info Cards -->
        <div class="info-cards">
          @if (request()!.category) {
            <div class="info-card">
              <div class="label">{{ 'requests.detail.fields.category' | transloco }}</div>
              <div class="value">{{ request()!.category }}</div>
            </div>
          }
          @if (request()!.ownerName) {
            <div class="info-card">
              <div class="label">{{ 'requests.detail.fields.owner' | transloco }}</div>
              <div class="value">{{ request()!.ownerName }}</div>
            </div>
          }
          @if (request()!.assignedToName) {
            <div class="info-card">
              <div class="label">{{ 'requests.detail.fields.assignedTo' | transloco }}</div>
              <div class="value">{{ request()!.assignedToName }}</div>
            </div>
          }
          @if (request()!.contactName) {
            <div class="info-card">
              <div class="label">{{ 'requests.detail.fields.contact' | transloco }}</div>
              <div class="value">
                <a [routerLink]="['/contacts', request()!.contactId]">{{ request()!.contactName }}</a>
              </div>
            </div>
          }
          @if (request()!.companyName) {
            <div class="info-card">
              <div class="label">{{ 'requests.detail.fields.company' | transloco }}</div>
              <div class="value">
                <a [routerLink]="['/companies', request()!.companyId]">{{ request()!.companyName }}</a>
              </div>
            </div>
          }
          <div class="info-card">
            <div class="label">{{ 'requests.detail.fields.created' | transloco }}</div>
            <div class="value">{{ request()!.createdAt | date:'medium' }}</div>
          </div>
          @if (request()!.resolvedAt) {
            <div class="info-card">
              <div class="label">{{ 'requests.detail.fields.resolved' | transloco }}</div>
              <div class="value">{{ request()!.resolvedAt | date:'medium' }}</div>
            </div>
          }
          @if (request()!.closedAt) {
            <div class="info-card">
              <div class="label">{{ 'requests.detail.fields.closed' | transloco }}</div>
              <div class="value">{{ request()!.closedAt | date:'medium' }}</div>
            </div>
          }
        </div>

        <!-- Tabs -->
        <mat-tab-group animationDuration="0ms" [selectedIndex]="selectedTabIndex()" (selectedIndexChange)="onTabSelected($event)">
          <!-- Summary Tab -->
          <mat-tab [label]="'requests.detail.tabs.summary' | transloco">
            <div style="padding: 16px 0;">
              <app-entity-summary-tab
                entityType="Request"
                [data]="summaryData()"
                [loading]="summaryLoading()"
                (associationClicked)="onAssociationClicked($event)"
                (addNote)="onSummaryAddNote()"
                (logActivity)="onSummaryLogActivity()" />
            </div>
          </mat-tab>

          <!-- Details Tab -->
          <mat-tab [label]="'requests.detail.tabs.details' | transloco">
            <div class="details-section">
              @if (request()!.description) {
                <h3>{{ 'requests.detail.sections.description' | transloco }}</h3>
                <p>{{ request()!.description }}</p>
              }
              @if (!request()!.description) {
                <div class="empty-state">{{ 'requests.detail.empty.noDescription' | transloco }}</div>
              }

              <!-- Custom fields in readonly mode -->
              <h3>{{ 'requests.detail.sections.customFields' | transloco }}</h3>
              <app-custom-field-form
                [entityType]="'Request'"
                [customFieldValues]="request()!.customFields"
                [readonly]="true" />
            </div>
          </mat-tab>

          <!-- Timeline Tab -->
          <mat-tab [label]="'requests.detail.tabs.timeline' | transloco">
            <div style="padding: 16px 0;">
              @if (timelineLoading()) {
                <div class="loading-container">
                  <mat-spinner diameter="32"></mat-spinner>
                </div>
              } @else {
                <app-entity-timeline [entries]="timelineEntries()" />
              }
            </div>
          </mat-tab>

          <!-- Notes Tab -->
          <mat-tab [label]="'requests.detail.tabs.notes' | transloco">
            <div style="padding: 16px 0;">
              @if (notesLoading()) {
                <div class="loading-container">
                  <mat-spinner diameter="32"></mat-spinner>
                </div>
              } @else if (requestNotes().length === 0) {
                <div class="empty-state">
                  {{ 'requests.detail.notes.noNotes' | transloco }}
                  <br /><br />
                  <a mat-stroked-button
                     [routerLink]="['/notes/new']"
                     [queryParams]="{ entityType: 'Request', entityId: request()?.id, entityName: request()?.subject }">
                    {{ 'requests.detail.notes.addNote' | transloco }}
                  </a>
                </div>
              } @else {
                <div style="margin-bottom: 12px; text-align: right;">
                  <a mat-stroked-button
                     [routerLink]="['/notes/new']"
                     [queryParams]="{ entityType: 'Request', entityId: request()?.id, entityName: request()?.subject }">
                    {{ 'requests.detail.notes.addNote' | transloco }}
                  </a>
                </div>
                @for (note of requestNotes(); track note.id) {
                  <div style="display: flex; align-items: flex-start; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--color-border-subtle);">
                    <div style="flex: 1; min-width: 0;">
                      <a [routerLink]="['/notes', note.id]" style="font-weight: 500; color: var(--color-primary); text-decoration: none;">{{ note.title }}</a>
                      <div style="font-size: 13px; color: var(--color-text-secondary); margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{{ note.plainTextBody }}</div>
                    </div>
                    <div style="font-size: 12px; color: var(--color-text-muted); white-space: nowrap;">
                      {{ note.authorName }} &middot; {{ formatNoteDate(note.createdAt) }}
                    </div>
                  </div>
                }
              }
            </div>
          </mat-tab>

          <!-- Attachments Tab -->
          <mat-tab [label]="'requests.detail.tabs.attachments' | transloco">
            <div style="padding: 16px 0;">
              <app-entity-attachments [entityType]="'request'" [entityId]="request()?.id ?? ''" />
            </div>
          </mat-tab>
        </mat-tab-group>
      </div>
    } @else {
      <div class="empty-state">
        <h2>{{ 'requests.detail.notFound' | transloco }}</h2>
        <a mat-button routerLink="/requests">{{ 'requests.detail.backToRequests' | transloco }}</a>
      </div>
    }
  `,
})
export class RequestDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly requestService = inject(RequestService);
  private readonly noteService = inject(NoteService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly summaryService = inject(SummaryService);
  private readonly transloco = inject(TranslocoService);

  /** Request detail data. */
  request = signal<RequestDetailDto | null>(null);
  isLoading = signal(true);

  /** Timeline entries. */
  timelineEntries = signal<TimelineEntry[]>([]);
  timelineLoading = signal(false);

  /** Notes linked to this request. */
  requestNotes = signal<NoteListDto[]>([]);
  notesLoading = signal(false);
  notesLoaded = signal(false);

  /** Summary tab data. */
  summaryData = signal<RequestSummaryDto | null>(null);
  summaryLoading = signal(false);
  summaryDirty = signal(false);
  selectedTabIndex = signal(0);

  /** Current request ID from route. */
  private requestId = '';

  /** Tab labels matching the mat-tab-group order (including Summary at index 0). */
  private readonly tabLabels = ['Summary', 'Details', 'Timeline', 'Notes', 'Attachments'];

  /** Computed: allowed status transitions from the detail response. */
  allowedTransitions = computed(() => {
    const r = this.request();
    if (!r) return [];
    return r.allowedTransitions ?? [];
  });

  ngOnInit(): void {
    this.requestId = this.route.snapshot.paramMap.get('id') ?? '';
    if (!this.requestId) {
      this.isLoading.set(false);
      return;
    }

    this.loadRequest();
    this.loadTimeline();
    this.loadSummary();
  }

  /** Load summary data for the Summary tab. */
  private loadSummary(): void {
    this.summaryLoading.set(true);
    this.summaryDirty.set(false);
    this.summaryService.getRequestSummary(this.requestId).subscribe({
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

  /** Load request detail data. */
  private loadRequest(): void {
    this.isLoading.set(true);
    this.requestService.getById(this.requestId).subscribe({
      next: (request) => {
        this.request.set(request);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      },
    });
  }

  /** Load timeline entries. */
  private loadTimeline(): void {
    this.timelineLoading.set(true);
    this.requestService.getTimeline(this.requestId).subscribe({
      next: (entries) => {
        this.timelineEntries.set(entries);
        this.timelineLoading.set(false);
      },
      error: () => {
        this.timelineLoading.set(false);
      },
    });
  }

  /** Load notes linked to this request (lazy on tab switch). */
  loadRequestNotes(): void {
    if (this.notesLoaded() || this.notesLoading()) return;

    this.notesLoading.set(true);
    this.noteService
      .getEntityNotes('Request', this.requestId)
      .subscribe({
        next: (notes) => {
          this.requestNotes.set(notes);
          this.notesLoading.set(false);
          this.notesLoaded.set(true);
        },
        error: () => {
          this.notesLoading.set(false);
        },
      });
  }

  /** Handle tab selection for lazy loading and summary dirty-flag. */
  onTabSelected(index: number): void {
    this.selectedTabIndex.set(index);
    // Summary at index 0
    if (index === 0 && this.summaryDirty()) {
      this.loadSummary();
    }
    // Notes at index 3 (shifted +1 for Summary insertion)
    if (index === 3) {
      this.loadRequestNotes();
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

  /** Get status color from REQUEST_STATUSES constant. */
  getStatusColor(status: string): string {
    return REQUEST_STATUSES.find((s) => s.value === status)?.color ?? 'var(--color-text-muted)';
  }

  /** Get status label from REQUEST_STATUSES constant. */
  getStatusLabel(status: string): string {
    return REQUEST_STATUSES.find((s) => s.value === status)?.label ?? status;
  }

  /** Get priority color from REQUEST_PRIORITIES constant. */
  getPriorityColor(priority: string): string {
    return REQUEST_PRIORITIES.find((p) => p.value === priority)?.color ?? 'var(--color-text-muted)';
  }

  /** Get priority label from REQUEST_PRIORITIES constant. */
  getPriorityLabel(priority: string): string {
    return REQUEST_PRIORITIES.find((p) => p.value === priority)?.label ?? priority;
  }

  /** Get a human-friendly label for a status transition button. */
  getTransitionLabel(status: string): string {
    switch (status) {
      case 'InProgress':
        return this.transloco.translate('requests.detail.transitions.startWork');
      case 'Resolved':
        return this.transloco.translate('requests.detail.transitions.resolve');
      case 'Closed':
        return this.transloco.translate('requests.detail.transitions.close');
      case 'New':
        return this.transloco.translate('requests.detail.transitions.reopen');
      default:
        return status;
    }
  }

  /** Handle association chip click -- switch to the corresponding tab. */
  onAssociationClicked(tabLabel: string): void {
    const index = this.tabLabels.indexOf(tabLabel);
    if (index >= 0) {
      this.selectedTabIndex.set(index);
    }
  }

  /** Quick action: Add Note via dialog. */
  onSummaryAddNote(): void {
    const dialogRef = this.dialog.open(EntityFormDialogComponent, {
      width: '700px',
      data: {
        entityType: 'Note',
        prefill: {
          entityType: 'Request',
          entityId: this.requestId,
          entityName: this.request()?.subject,
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
          entityType: 'Request',
          entityId: this.requestId,
          entityName: this.request()?.subject,
        },
      } as EntityFormDialogData,
    });
    dialogRef.afterClosed().subscribe((result: EntityFormDialogResult | undefined) => {
      if (result?.entity) {
        this.loadSummary();
      }
    });
  }

  /** Transition request to a new status. */
  onTransitionStatus(newStatus: string): void {
    this.requestService
      .updateStatus(this.requestId, { status: newStatus })
      .subscribe({
        next: () => {
          const label = this.getStatusLabel(newStatus);
          this.snackBar.open(this.transloco.translate('requests.messages.statusUpdated', { status: label }), 'OK', {
            duration: 3000,
          });
          this.loadRequest();
          this.loadTimeline();
          this.markSummaryDirty();
        },
        error: () => {
          this.snackBar.open(this.transloco.translate('requests.messages.statusUpdateFailed'), 'OK', {
            duration: 5000,
          });
        },
      });
  }

  /** Delete request with confirmation dialog. */
  onDelete(): void {
    const r = this.request();
    if (!r) return;

    const dialogRef = this.dialog.open(ConfirmDeleteDialogComponent, {
      width: '400px',
      data: { name: r.subject, type: 'request' },
    });

    dialogRef.afterClosed().subscribe((confirmed: boolean) => {
      if (confirmed) {
        this.requestService.delete(this.requestId).subscribe({
          next: () => {
            this.snackBar.open(this.transloco.translate('requests.messages.requestDeleted'), 'OK', { duration: 3000 });
            this.router.navigate(['/requests']);
          },
          error: () => {
            this.snackBar.open(this.transloco.translate('requests.messages.requestDeleteFailed'), 'OK', {
              duration: 5000,
            });
          },
        });
      }
    });
  }
}

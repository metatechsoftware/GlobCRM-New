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
import { EntityTimelineComponent } from '../../../shared/components/entity-timeline/entity-timeline.component';
import { CustomFieldFormComponent } from '../../../shared/components/custom-field-form/custom-field-form.component';
import { RequestService } from '../request.service';
import {
  RequestDetailDto,
  RequestStatus,
  REQUEST_STATUSES,
  REQUEST_PRIORITIES,
  ALLOWED_TRANSITIONS,
} from '../request.models';
import { TimelineEntry } from '../../../shared/models/query.models';
import { ConfirmDeleteDialogComponent } from '../../settings/roles/role-list.component';

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
      background: var(--mat-sys-surface-container, #f5f5f5);
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
      background: var(--mat-sys-surface-container-low, #fafafa);
      border-radius: 8px;
      border: 1px solid var(--mat-sys-outline-variant, rgba(0, 0, 0, 0.12));
    }

    .info-card .label {
      font-size: 12px;
      color: var(--mat-sys-on-surface-variant, rgba(0, 0, 0, 0.6));
      margin-bottom: 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .info-card .value {
      font-size: 16px;
      font-weight: 500;
    }

    .info-card a {
      color: var(--mat-sys-primary, #1976d2);
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
      color: var(--mat-sys-on-surface-variant, rgba(0, 0, 0, 0.6));
    }

    .details-section p {
      margin: 0 0 24px;
      font-size: 14px;
      white-space: pre-wrap;
    }

    .empty-state {
      text-align: center;
      padding: 48px 24px;
      color: var(--mat-sys-on-surface-variant, rgba(0, 0, 0, 0.6));
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
            <mat-icon>edit</mat-icon> Edit
          </button>
          <button mat-stroked-button (click)="onDelete()"
                  *appHasPermission="'Request:Delete'">
            <mat-icon>delete</mat-icon> Delete
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
              <div class="label">Category</div>
              <div class="value">{{ request()!.category }}</div>
            </div>
          }
          @if (request()!.ownerName) {
            <div class="info-card">
              <div class="label">Owner</div>
              <div class="value">{{ request()!.ownerName }}</div>
            </div>
          }
          @if (request()!.assignedToName) {
            <div class="info-card">
              <div class="label">Assigned To</div>
              <div class="value">{{ request()!.assignedToName }}</div>
            </div>
          }
          @if (request()!.contactName) {
            <div class="info-card">
              <div class="label">Contact</div>
              <div class="value">
                <a [routerLink]="['/contacts', request()!.contactId]">{{ request()!.contactName }}</a>
              </div>
            </div>
          }
          @if (request()!.companyName) {
            <div class="info-card">
              <div class="label">Company</div>
              <div class="value">
                <a [routerLink]="['/companies', request()!.companyId]">{{ request()!.companyName }}</a>
              </div>
            </div>
          }
          <div class="info-card">
            <div class="label">Created</div>
            <div class="value">{{ request()!.createdAt | date:'medium' }}</div>
          </div>
          @if (request()!.resolvedAt) {
            <div class="info-card">
              <div class="label">Resolved</div>
              <div class="value">{{ request()!.resolvedAt | date:'medium' }}</div>
            </div>
          }
          @if (request()!.closedAt) {
            <div class="info-card">
              <div class="label">Closed</div>
              <div class="value">{{ request()!.closedAt | date:'medium' }}</div>
            </div>
          }
        </div>

        <!-- Tabs -->
        <mat-tab-group animationDuration="0ms">
          <!-- Details Tab -->
          <mat-tab label="Details">
            <div class="details-section">
              @if (request()!.description) {
                <h3>Description</h3>
                <p>{{ request()!.description }}</p>
              }
              @if (!request()!.description) {
                <div class="empty-state">No description provided</div>
              }

              <!-- Custom fields in readonly mode -->
              <h3>Custom Fields</h3>
              <app-custom-field-form
                [entityType]="'Request'"
                [customFieldValues]="request()!.customFields"
                [readonly]="true" />
            </div>
          </mat-tab>

          <!-- Timeline Tab -->
          <mat-tab label="Timeline">
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
        </mat-tab-group>
      </div>
    } @else {
      <div class="empty-state">
        <h2>Request not found</h2>
        <a mat-button routerLink="/requests">Back to Requests</a>
      </div>
    }
  `,
})
export class RequestDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly requestService = inject(RequestService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  /** Request detail data. */
  request = signal<RequestDetailDto | null>(null);
  isLoading = signal(true);

  /** Timeline entries. */
  timelineEntries = signal<TimelineEntry[]>([]);
  timelineLoading = signal(false);

  /** Current request ID from route. */
  private requestId = '';

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

  /** Get status color from REQUEST_STATUSES constant. */
  getStatusColor(status: string): string {
    return REQUEST_STATUSES.find((s) => s.value === status)?.color ?? '#757575';
  }

  /** Get status label from REQUEST_STATUSES constant. */
  getStatusLabel(status: string): string {
    return REQUEST_STATUSES.find((s) => s.value === status)?.label ?? status;
  }

  /** Get priority color from REQUEST_PRIORITIES constant. */
  getPriorityColor(priority: string): string {
    return REQUEST_PRIORITIES.find((p) => p.value === priority)?.color ?? '#757575';
  }

  /** Get priority label from REQUEST_PRIORITIES constant. */
  getPriorityLabel(priority: string): string {
    return REQUEST_PRIORITIES.find((p) => p.value === priority)?.label ?? priority;
  }

  /** Get a human-friendly label for a status transition button. */
  getTransitionLabel(status: string): string {
    switch (status) {
      case 'InProgress':
        return 'Start Work';
      case 'Resolved':
        return 'Resolve';
      case 'Closed':
        return 'Close';
      case 'New':
        return 'Reopen';
      default:
        return status;
    }
  }

  /** Transition request to a new status. */
  onTransitionStatus(newStatus: string): void {
    this.requestService
      .updateStatus(this.requestId, { status: newStatus })
      .subscribe({
        next: () => {
          const label = this.getStatusLabel(newStatus);
          this.snackBar.open(`Status updated to ${label}`, 'OK', {
            duration: 3000,
          });
          this.loadRequest();
          this.loadTimeline();
        },
        error: () => {
          this.snackBar.open('Failed to update status', 'OK', {
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
            this.snackBar.open('Request deleted', 'OK', { duration: 3000 });
            this.router.navigate(['/requests']);
          },
          error: () => {
            this.snackBar.open('Failed to delete request', 'OK', {
              duration: 5000,
            });
          },
        });
      }
    });
  }
}

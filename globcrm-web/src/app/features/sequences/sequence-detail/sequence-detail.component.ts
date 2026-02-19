import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  inject,
  input,
  signal,
  computed,
} from '@angular/core';
import { CommonModule, TitleCasePipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { SequenceStore } from '../sequence.store';
import { EnrollmentListItem, StepMetrics } from '../sequence.models';
import { EnrollmentDialogComponent } from '../enrollment-dialog/enrollment-dialog.component';
import { ConfirmDeleteDialogComponent } from '../../../shared/components/confirm-delete-dialog/confirm-delete-dialog.component';

@Component({
  selector: 'app-sequence-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    TitleCasePipe,
    DatePipe,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatCheckboxModule,
    MatSlideToggleModule,
    MatTooltipModule,
    MatSnackBarModule,
    MatDialogModule,
  ],
  providers: [SequenceStore],
  templateUrl: './sequence-detail.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
    }

    .detail {
      max-width: 1200px;
      margin: 0 auto;
      padding: 24px;
    }

    .detail__loading {
      display: flex;
      justify-content: center;
      padding: 64px;
    }

    .detail__header {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      margin-bottom: 24px;
      flex-wrap: wrap;
    }

    .detail__header-info {
      flex: 1;
      min-width: 200px;
    }

    .detail__header-info h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 500;
    }

    .detail__description {
      color: var(--text-secondary, #64748b);
      font-size: 14px;
      margin: 4px 0 0 0;
    }

    .detail__status {
      display: inline-block;
      font-size: 12px;
      padding: 4px 12px;
      border-radius: 12px;
      font-weight: 500;
      align-self: center;
    }

    .status--draft { background-color: #e2e8f0; color: #475569; }
    .status--active { background-color: #dcfce7; color: #166534; }
    .status--paused { background-color: #fef3c7; color: #92400e; }
    .status--archived { background-color: #e2e8f0; color: #475569; }

    .detail__header-actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      align-self: center;
    }

    /* Metrics */
    .detail__metrics {
      display: flex;
      gap: 16px;
      margin-bottom: 24px;
      flex-wrap: wrap;
    }

    .metric-card {
      flex: 1;
      min-width: 120px;
      padding: 16px;
      border: 1px solid var(--border-color, #e2e8f0);
      border-radius: 8px;
      text-align: center;
    }

    .metric-card__value {
      display: block;
      font-size: 24px;
      font-weight: 600;
      color: var(--text-primary, #1e293b);
    }

    .metric-card__label {
      display: block;
      font-size: 12px;
      color: var(--text-secondary, #64748b);
      margin-top: 4px;
    }

    /* Section */
    .detail__section {
      margin-bottom: 32px;
    }

    .detail__section h2 {
      font-size: 18px;
      font-weight: 500;
      margin: 0 0 16px 0;
    }

    .detail__section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
    }

    .detail__section-header h2 {
      margin: 0;
    }

    .detail__empty-hint {
      color: var(--text-secondary, #64748b);
    }

    .detail__empty-hint a {
      color: var(--primary, #f97316);
    }

    /* Steps Overview */
    .detail__steps {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .step-overview {
      border: 1px solid var(--border-color, #e2e8f0);
      border-radius: 8px;
      cursor: pointer;
      transition: border-color 0.15s;
    }

    .step-overview:hover {
      border-color: var(--primary, #f97316);
    }

    .step-overview__header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
    }

    .step-overview__badge {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: var(--primary, #f97316);
      color: white;
      font-size: 13px;
      font-weight: 600;
      flex-shrink: 0;
    }

    .step-overview__info {
      flex: 1;
      min-width: 0;
    }

    .step-overview__name {
      display: block;
      font-weight: 500;
      font-size: 14px;
    }

    .step-overview__delay {
      display: block;
      font-size: 12px;
      color: var(--text-secondary, #64748b);
    }

    .step-overview__metrics {
      display: flex;
      gap: 12px;
    }

    .step-metric {
      font-size: 12px;
      color: var(--text-secondary, #64748b);
      white-space: nowrap;
    }

    .step-overview__chevron {
      color: var(--text-secondary, #94a3b8);
    }

    .step-overview__detail {
      padding: 0 16px 12px 56px;
      border-top: 1px solid var(--border-color, #e2e8f0);
    }

    .step-overview__field {
      font-size: 13px;
      margin-top: 8px;
    }

    .step-overview__field-label {
      font-weight: 500;
      color: var(--text-secondary, #64748b);
      margin-right: 4px;
    }

    /* Enrollment List */
    .detail__bulk-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .detail__bulk-count {
      font-size: 13px;
      color: var(--text-secondary, #64748b);
    }

    .detail__empty-enrollment {
      text-align: center;
      padding: 48px 24px;
      color: var(--text-secondary, #64748b);
      border: 2px dashed var(--border-color, #e2e8f0);
      border-radius: 8px;
    }

    .detail__empty-enrollment mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      opacity: 0.5;
      margin-bottom: 12px;
    }

    .detail__table-wrap {
      overflow-x: auto;
    }

    table {
      width: 100%;
    }

    .detail__contact-link {
      color: var(--primary, #f97316);
      text-decoration: none;
      font-weight: 500;
    }

    .detail__contact-link:hover {
      text-decoration: underline;
    }

    .detail__contact-email {
      font-size: 12px;
      color: var(--text-secondary, #64748b);
    }

    .enrollment-status {
      display: inline-block;
      font-size: 12px;
      padding: 2px 10px;
      border-radius: 12px;
      font-weight: 500;
    }

    .enrollment-status--active { background-color: #dcfce7; color: #166534; }
    .enrollment-status--paused { background-color: #fef3c7; color: #92400e; }
    .enrollment-status--completed { background-color: #dbeafe; color: #1e40af; }
    .enrollment-status--replied { background-color: #f3e8ff; color: #7c3aed; }
    .enrollment-status--bounced { background-color: #fecaca; color: #991b1b; }
    .enrollment-status--unenrolled { background-color: #e2e8f0; color: #475569; }

    .detail__enrollment-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }
  `,
})
export class SequenceDetailComponent implements OnInit {
  /** Route param :id provided by withComponentInputBinding() */
  readonly id = input.required<string>();

  readonly store = inject(SequenceStore);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);

  readonly expandedStepId = signal<string | null>(null);
  readonly selectedEnrollmentIds = signal<Set<string>>(new Set());
  readonly currentPage = signal(1);
  readonly pageSize = 25;

  readonly enrollmentColumns = [
    'select',
    'contact',
    'status',
    'currentStep',
    'stepsSent',
    'lastSent',
    'actions',
  ];

  ngOnInit(): void {
    const seqId = this.id();
    this.store.loadSequence(seqId);
    this.store.loadEnrollments(seqId, 1, this.pageSize);
    this.store.loadAnalytics(seqId);
    this.store.loadStepMetrics(seqId);
  }

  getStepMetric(stepNumber: number): StepMetrics | undefined {
    return this.store.stepMetrics().find((m) => m.stepNumber === stepNumber);
  }

  toggleStepExpand(stepId: string): void {
    this.expandedStepId.set(
      this.expandedStepId() === stepId ? null : stepId,
    );
  }

  // ---- Status Actions ----

  activateSequence(): void {
    const seq = this.store.selectedSequence();
    if (!seq) return;

    this.store.updateSequence(seq.id, { status: 'active' }, () => {
      this.snackBar.open('Sequence activated.', 'Close', { duration: 3000 });
    });
  }

  pauseSequence(): void {
    const seq = this.store.selectedSequence();
    if (!seq) return;

    this.store.updateSequence(seq.id, { status: 'paused' }, () => {
      this.snackBar.open('Sequence paused.', 'Close', { duration: 3000 });
    });
  }

  archiveSequence(): void {
    const seq = this.store.selectedSequence();
    if (!seq) return;

    this.store.updateSequence(seq.id, { status: 'archived' }, () => {
      this.snackBar.open('Sequence archived.', 'Close', { duration: 3000 });
    });
  }

  // ---- Enrollment Actions ----

  onToggleEnrollment(enrollment: EnrollmentListItem): void {
    const seqId = this.id();

    if (enrollment.status === 'active') {
      this.store.pauseEnrollment(seqId, enrollment.id, () => {
        this.snackBar.open('Enrollment paused.', 'Close', { duration: 3000 });
      });
    } else if (enrollment.status === 'paused') {
      this.store.resumeEnrollment(seqId, enrollment.id, () => {
        this.snackBar.open('Enrollment resumed.', 'Close', { duration: 3000 });
      });
    }
  }

  onUnenroll(enrollment: EnrollmentListItem): void {
    const dialogRef = this.dialog.open(ConfirmDeleteDialogComponent, {
      width: '400px',
      data: {
        name: enrollment.contactName ?? 'this contact',
        type: 'enrollment',
      },
    });

    dialogRef.afterClosed().subscribe((confirmed: boolean) => {
      if (!confirmed) return;

      this.store.unenroll(this.id(), enrollment.id, () => {
        this.snackBar.open('Contact unenrolled.', 'Close', { duration: 3000 });
      });
    });
  }

  // ---- Bulk Selection ----

  isAllSelected(): boolean {
    const items = this.store.enrollments()?.items ?? [];
    return items.length > 0 && this.selectedEnrollmentIds().size === items.length;
  }

  toggleSelectAll(checked: boolean): void {
    if (checked) {
      const items = this.store.enrollments()?.items ?? [];
      this.selectedEnrollmentIds.set(new Set(items.map((e) => e.id)));
    } else {
      this.selectedEnrollmentIds.set(new Set());
    }
  }

  toggleEnrollmentSelect(enrollmentId: string, checked: boolean): void {
    const current = new Set(this.selectedEnrollmentIds());
    if (checked) {
      current.add(enrollmentId);
    } else {
      current.delete(enrollmentId);
    }
    this.selectedEnrollmentIds.set(current);
  }

  bulkPause(): void {
    const ids = Array.from(this.selectedEnrollmentIds());
    if (ids.length === 0) return;

    this.store.bulkPauseEnrollments(this.id(), ids, (result) => {
      this.selectedEnrollmentIds.set(new Set());
      this.snackBar.open(
        `${result.paused} enrollment(s) paused.`,
        'Close',
        { duration: 3000 },
      );
    });
  }

  bulkResume(): void {
    const ids = Array.from(this.selectedEnrollmentIds());
    if (ids.length === 0) return;

    this.store.bulkResumeEnrollments(this.id(), ids, (result) => {
      this.selectedEnrollmentIds.set(new Set());
      this.snackBar.open(
        `${result.resumed} enrollment(s) resumed.`,
        'Close',
        { duration: 3000 },
      );
    });
  }

  // ---- Enrollment Dialog ----

  openEnrollmentDialog(): void {
    const seq = this.store.selectedSequence();
    if (!seq) return;

    const dialogRef = this.dialog.open(EnrollmentDialogComponent, {
      width: '600px',
      maxHeight: '80vh',
      data: { sequenceId: seq.id, mode: 'enroll' },
    });

    dialogRef.afterClosed().subscribe((result: boolean | undefined) => {
      if (result) {
        // Refresh enrollments and analytics
        this.store.loadEnrollments(this.id(), this.currentPage(), this.pageSize);
        this.store.loadAnalytics(this.id());
      }
    });
  }

  // ---- Pagination ----

  onPageChange(event: PageEvent): void {
    this.currentPage.set(event.pageIndex + 1);
    this.store.loadEnrollments(this.id(), event.pageIndex + 1, event.pageSize);
  }
}

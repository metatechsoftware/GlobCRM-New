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
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { SequenceStore } from '../sequence.store';
import { EnrollmentListItem, StepMetrics } from '../sequence.models';
import { EnrollmentDialogComponent } from '../enrollment-dialog/enrollment-dialog.component';
import { SequenceAnalyticsComponent } from '../sequence-analytics/sequence-analytics.component';
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
    TranslocoPipe,
    SequenceAnalyticsComponent,
  ],
  providers: [SequenceStore],
  templateUrl: './sequence-detail.component.html',
  styleUrl: './sequence-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SequenceDetailComponent implements OnInit {
  /** Route param :id provided by withComponentInputBinding() */
  readonly id = input.required<string>();

  readonly store = inject(SequenceStore);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly transloco = inject(TranslocoService);

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
    this.store.loadFunnelData(seqId);
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
      this.snackBar.open(this.transloco.translate('sequences.messages.activated'), this.transloco.translate('common.close'), { duration: 3000 });
    });
  }

  pauseSequence(): void {
    const seq = this.store.selectedSequence();
    if (!seq) return;

    this.store.updateSequence(seq.id, { status: 'paused' }, () => {
      this.snackBar.open(this.transloco.translate('sequences.messages.paused'), this.transloco.translate('common.close'), { duration: 3000 });
    });
  }

  archiveSequence(): void {
    const seq = this.store.selectedSequence();
    if (!seq) return;

    this.store.updateSequence(seq.id, { status: 'archived' }, () => {
      this.snackBar.open(this.transloco.translate('sequences.messages.archived'), this.transloco.translate('common.close'), { duration: 3000 });
    });
  }

  // ---- Enrollment Actions ----

  onToggleEnrollment(enrollment: EnrollmentListItem): void {
    const seqId = this.id();

    if (enrollment.status === 'active') {
      this.store.pauseEnrollment(seqId, enrollment.id, () => {
        this.snackBar.open(this.transloco.translate('sequences.messages.enrollmentPaused'), this.transloco.translate('common.close'), { duration: 3000 });
      });
    } else if (enrollment.status === 'paused') {
      this.store.resumeEnrollment(seqId, enrollment.id, () => {
        this.snackBar.open(this.transloco.translate('sequences.messages.enrollmentResumed'), this.transloco.translate('common.close'), { duration: 3000 });
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
        this.snackBar.open(this.transloco.translate('sequences.messages.unenrolled'), this.transloco.translate('common.close'), { duration: 3000 });
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
        this.transloco.translate('sequences.messages.bulkPaused', { count: result.paused }),
        this.transloco.translate('common.close'),
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
        this.transloco.translate('sequences.messages.bulkResumed', { count: result.resumed }),
        this.transloco.translate('common.close'),
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

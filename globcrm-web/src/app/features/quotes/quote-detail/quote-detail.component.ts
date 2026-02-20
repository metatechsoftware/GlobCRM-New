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
import { CurrencyPipe, DatePipe, DecimalPipe, PercentPipe } from '@angular/common';
import { HasPermissionDirective } from '../../../core/permissions/has-permission.directive';
import { EntityTimelineComponent } from '../../../shared/components/entity-timeline/entity-timeline.component';
import { EntityAttachmentsComponent } from '../../../shared/components/entity-attachments/entity-attachments.component';
import { NoteService } from '../../notes/note.service';
import { NoteListDto } from '../../notes/note.models';
import { QuoteService } from '../quote.service';
import {
  QuoteDetailDto,
  QuoteLineItemDto,
  QuoteVersionDto,
  QuoteStatus,
  QUOTE_STATUSES,
  QUOTE_TRANSITIONS,
} from '../quote.models';
import { TimelineEntry } from '../../../shared/models/query.models';
import { ConfirmDeleteDialogComponent } from '../../../shared/components/confirm-delete-dialog/confirm-delete-dialog.component';
import { EntitySummaryTabComponent } from '../../../shared/components/summary-tab/entity-summary-tab.component';
import { EntityFormDialogComponent } from '../../../shared/components/entity-form-dialog/entity-form-dialog.component';
import { EntityFormDialogData, EntityFormDialogResult } from '../../../shared/components/entity-form-dialog/entity-form-dialog.models';
import { SummaryService } from '../../../shared/components/summary-tab/summary.service';
import { QuoteSummaryDto } from '../../../shared/components/summary-tab/summary.models';

/**
 * Quote detail page with line items table, PDF download, versioning, and status management.
 * Shows header info, action bar, info cards, and 4 tabs: Line Items, Details, Versions, Timeline.
 */
@Component({
  selector: 'app-quote-detail',
  standalone: true,
  imports: [
    RouterLink,
    CurrencyPipe,
    DatePipe,
    DecimalPipe,
    PercentPipe,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    MatSnackBarModule,
    MatTabsModule,
    HasPermissionDirective,
    EntityTimelineComponent,
    EntityAttachmentsComponent,
    EntitySummaryTabComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './quote-detail.component.scss',
  templateUrl: './quote-detail.component.html',
})
export class QuoteDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly quoteService = inject(QuoteService);
  private readonly noteService = inject(NoteService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly summaryService = inject(SummaryService);

  /** Quote detail data. */
  quote = signal<QuoteDetailDto | null>(null);
  isLoading = signal(true);

  /** PDF generation state. */
  pdfGenerating = signal(false);

  /** Timeline entries. */
  timelineEntries = signal<TimelineEntry[]>([]);
  timelineLoading = signal(false);

  /** Notes linked to this quote. */
  quoteNotes = signal<NoteListDto[]>([]);
  notesLoading = signal(false);
  notesLoaded = signal(false);

  /** Summary tab data. */
  summaryData = signal<QuoteSummaryDto | null>(null);
  summaryLoading = signal(false);
  summaryDirty = signal(false);
  selectedTabIndex = signal(0);

  /** Current quote ID from route. */
  private quoteId = '';

  /** Tab labels matching the mat-tab-group order (including Summary at index 0). */
  private readonly tabLabels = ['Summary', 'Line Items', 'Details', 'Versions', 'Timeline', 'Notes', 'Attachments'];

  /** Computed: allowed status transitions from current status. */
  allowedTransitions = computed(() => {
    const q = this.quote();
    if (!q) return [];
    return QUOTE_TRANSITIONS[q.status] ?? [];
  });

  /** Computed: subtotal from line items (sum of lineTotal). */
  subtotal = computed(() => {
    const q = this.quote();
    if (!q?.lineItems?.length) return 0;
    return q.lineItems.reduce((sum, item) => sum + item.lineTotal, 0);
  });

  /** Computed: total discount across all line items. */
  discountTotal = computed(() => {
    const q = this.quote();
    if (!q?.lineItems?.length) return 0;
    return q.lineItems.reduce((sum, item) => sum + item.discountAmount, 0);
  });

  /** Computed: total tax across all line items. */
  taxTotal = computed(() => {
    const q = this.quote();
    if (!q?.lineItems?.length) return 0;
    return q.lineItems.reduce((sum, item) => sum + item.taxAmount, 0);
  });

  ngOnInit(): void {
    this.quoteId = this.route.snapshot.paramMap.get('id') ?? '';
    if (!this.quoteId) {
      this.isLoading.set(false);
      return;
    }

    this.loadQuote();
    this.loadTimeline();
    this.loadSummary();
  }

  /** Load summary data for the Summary tab. */
  private loadSummary(): void {
    this.summaryLoading.set(true);
    this.summaryDirty.set(false);
    this.summaryService.getQuoteSummary(this.quoteId).subscribe({
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

  /** Load quote detail data. */
  private loadQuote(): void {
    this.isLoading.set(true);
    this.quoteService.getById(this.quoteId).subscribe({
      next: (quote) => {
        this.quote.set(quote);
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
    this.quoteService.getTimeline(this.quoteId).subscribe({
      next: (entries) => {
        this.timelineEntries.set(entries);
        this.timelineLoading.set(false);
      },
      error: () => {
        this.timelineLoading.set(false);
      },
    });
  }

  /** Load notes linked to this quote (lazy on tab switch). */
  loadQuoteNotes(): void {
    if (this.notesLoaded() || this.notesLoading()) return;

    this.notesLoading.set(true);
    this.noteService
      .getEntityNotes('Quote', this.quoteId)
      .subscribe({
        next: (notes) => {
          this.quoteNotes.set(notes);
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
    // Notes at index 5 (shifted +1 for Summary insertion)
    if (index === 5) {
      this.loadQuoteNotes();
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

  /** Get status color from QUOTE_STATUSES constant. */
  getStatusColor(status: QuoteStatus): string {
    return QUOTE_STATUSES.find((s) => s.value === status)?.color ?? 'var(--color-text-muted)';
  }

  /** Get status label from QUOTE_STATUSES constant. */
  getStatusLabel(status: QuoteStatus): string {
    return QUOTE_STATUSES.find((s) => s.value === status)?.label ?? status;
  }

  /** Get a human-friendly label for a status transition button. */
  getTransitionLabel(status: QuoteStatus): string {
    switch (status) {
      case 'Sent':
        return 'Mark as Sent';
      case 'Accepted':
        return 'Accept';
      case 'Rejected':
        return 'Reject';
      case 'Expired':
        return 'Mark Expired';
      case 'Draft':
        return 'Revert to Draft';
      default:
        return status;
    }
  }

  /** Generate PDF and trigger download in browser. */
  onGeneratePdf(): void {
    this.pdfGenerating.set(true);
    this.quoteService.generatePdf(this.quoteId).subscribe({
      next: (blob) => {
        const q = this.quote()!;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Quote-${q.quoteNumber}-v${q.versionNumber}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        this.pdfGenerating.set(false);
      },
      error: () => {
        this.pdfGenerating.set(false);
        this.snackBar.open('Failed to generate PDF', 'OK', { duration: 5000 });
      },
    });
  }

  /** Create a new version from this quote. */
  onCreateNewVersion(): void {
    const q = this.quote()!;
    const dialogRef = this.dialog.open(ConfirmDeleteDialogComponent, {
      width: '400px',
      data: {
        name: `${q.quoteNumber} v${q.versionNumber}`,
        type: 'new version from Quote',
      },
    });

    dialogRef.afterClosed().subscribe((confirmed: boolean) => {
      if (confirmed) {
        this.quoteService.createNewVersion(this.quoteId).subscribe({
          next: (newVersion) => {
            this.snackBar.open(
              `Version ${newVersion.versionNumber} created`,
              'OK',
              { duration: 3000 },
            );
            this.router.navigate(['/quotes', newVersion.id]);
          },
          error: () => {
            this.snackBar.open('Failed to create new version', 'OK', {
              duration: 5000,
            });
          },
        });
      }
    });
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
          entityType: 'Quote',
          entityId: this.quoteId,
          entityName: this.quote()?.title,
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
          entityType: 'Quote',
          entityId: this.quoteId,
          entityName: this.quote()?.title,
        },
      } as EntityFormDialogData,
    });
    dialogRef.afterClosed().subscribe((result: EntityFormDialogResult | undefined) => {
      if (result?.entity) {
        this.loadSummary();
      }
    });
  }

  /** Transition quote to a new status. */
  onTransitionStatus(newStatus: QuoteStatus): void {
    this.quoteService
      .updateStatus(this.quoteId, { status: newStatus })
      .subscribe({
        next: () => {
          const label = this.getStatusLabel(newStatus);
          this.snackBar.open(`Status updated to ${label}`, 'OK', {
            duration: 3000,
          });
          this.loadQuote();
          this.loadTimeline();
          this.markSummaryDirty();
        },
        error: () => {
          this.snackBar.open('Failed to update status', 'OK', {
            duration: 5000,
          });
        },
      });
  }

  /** Delete quote with confirmation dialog. */
  onDelete(): void {
    const q = this.quote();
    if (!q) return;

    const dialogRef = this.dialog.open(ConfirmDeleteDialogComponent, {
      width: '400px',
      data: { name: q.title, type: 'quote' },
    });

    dialogRef.afterClosed().subscribe((confirmed: boolean) => {
      if (confirmed) {
        this.quoteService.delete(this.quoteId).subscribe({
          next: () => {
            this.snackBar.open('Quote deleted', 'OK', { duration: 3000 });
            this.router.navigate(['/quotes']);
          },
          error: () => {
            this.snackBar.open('Failed to delete quote', 'OK', {
              duration: 5000,
            });
          },
        });
      }
    });
  }
}

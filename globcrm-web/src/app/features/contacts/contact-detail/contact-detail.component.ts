import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { HasPermissionDirective } from '../../../core/permissions/has-permission.directive';
import { PermissionStore } from '../../../core/permissions/permission.store';
import {
  RelatedEntityTabsComponent,
  CONTACT_TABS,
} from '../../../shared/components/related-entity-tabs/related-entity-tabs.component';
import { EntityTimelineComponent } from '../../../shared/components/entity-timeline/entity-timeline.component';
import { CustomFieldFormComponent } from '../../../shared/components/custom-field-form/custom-field-form.component';
import { ContactService } from '../contact.service';
import { ContactDetailDto } from '../contact.models';
import { ActivityListDto, ACTIVITY_STATUSES, ACTIVITY_PRIORITIES } from '../../activities/activity.models';
import { ActivityService } from '../../activities/activity.service';
import { QuoteService } from '../../quotes/quote.service';
import { QuoteListDto, QUOTE_STATUSES } from '../../quotes/quote.models';
import { RequestService } from '../../requests/request.service';
import { RequestListDto, REQUEST_STATUSES, REQUEST_PRIORITIES } from '../../requests/request.models';
import { EmailService } from '../../emails/email.service';
import { EmailListDto } from '../../emails/email.models';
import { NoteService } from '../../notes/note.service';
import { NoteListDto } from '../../notes/note.models';
import { EntityAttachmentsComponent } from '../../../shared/components/entity-attachments/entity-attachments.component';
import { TimelineEntry } from '../../../shared/models/query.models';
import { ConfirmDeleteDialogComponent } from '../../../shared/components/confirm-delete-dialog/confirm-delete-dialog.component';
import { SequenceService } from '../../sequences/sequence.service';
import { SequenceListItem } from '../../sequences/sequence.models';
import { EntitySummaryTabComponent } from '../../../shared/components/summary-tab/entity-summary-tab.component';
import { EntityFormDialogComponent } from '../../../shared/components/entity-form-dialog/entity-form-dialog.component';
import { EntityFormDialogData, EntityFormDialogResult } from '../../../shared/components/entity-form-dialog/entity-form-dialog.models';
import { SummaryService } from '../../../shared/components/summary-tab/summary.service';
import { ContactSummaryDto } from '../../../shared/components/summary-tab/summary.models';

/**
 * Contact detail page with tabs (Details, Company, and disabled future tabs)
 * and a timeline sidebar showing entity events.
 */
@Component({
  selector: 'app-contact-detail',
  standalone: true,
  imports: [
    RouterLink,
    DatePipe,
    MatButtonModule,
    MatChipsModule,
    MatIconModule,
    MatMenuModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    MatSnackBarModule,
    HasPermissionDirective,
    RelatedEntityTabsComponent,
    EntityTimelineComponent,
    CustomFieldFormComponent,
    EntityAttachmentsComponent,
    EntitySummaryTabComponent,
    TranslocoPipe,
  ],
  templateUrl: './contact-detail.component.html',
  styleUrl: './contact-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly contactService = inject(ContactService);
  private readonly activityService = inject(ActivityService);
  private readonly quoteService = inject(QuoteService);
  private readonly requestService = inject(RequestService);
  private readonly emailService = inject(EmailService);
  private readonly noteService = inject(NoteService);
  private readonly sequenceService = inject(SequenceService);
  private readonly permissionStore = inject(PermissionStore);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly summaryService = inject(SummaryService);
  private readonly transloco = inject(TranslocoService);

  /** Contact detail data. */
  contact = signal<ContactDetailDto | null>(null);
  isLoading = signal(true);

  /** Timeline entries. */
  timelineEntries = signal<TimelineEntry[]>([]);
  timelineLoading = signal(false);

  /** Activities linked to this contact. */
  linkedActivities = signal<ActivityListDto[]>([]);
  activitiesLoading = signal(false);
  activitiesLoaded = signal(false);

  /** Quotes linked to this contact. */
  linkedQuotes = signal<QuoteListDto[]>([]);
  quotesLoading = signal(false);
  quotesLoaded = signal(false);

  /** Requests linked to this contact. */
  linkedRequests = signal<RequestListDto[]>([]);
  requestsLoading = signal(false);
  requestsLoaded = signal(false);

  /** Emails linked to this contact. */
  contactEmails = signal<EmailListDto[]>([]);
  emailsLoading = signal(false);
  emailsLoaded = signal(false);

  /** Notes linked to this contact. */
  contactNotes = signal<NoteListDto[]>([]);
  notesLoading = signal(false);
  notesLoaded = signal(false);

  /** Summary tab data. */
  summaryData = signal<ContactSummaryDto | null>(null);
  summaryLoading = signal(false);
  summaryDirty = signal(false);
  activeTabIndex = signal(0);

  /** Tab configuration for contact detail. */
  readonly tabs = CONTACT_TABS;

  /** Current contact ID from route. */
  private contactId = '';

  ngOnInit(): void {
    this.contactId = this.route.snapshot.paramMap.get('id') ?? '';
    if (!this.contactId) {
      this.isLoading.set(false);
      return;
    }

    this.loadContact();
    this.loadTimeline();
    this.loadSummary();
  }

  /** Load summary data for the Summary tab. */
  private loadSummary(): void {
    this.summaryLoading.set(true);
    this.summaryDirty.set(false);
    this.summaryService.getContactSummary(this.contactId).subscribe({
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

  /** Load contact detail data. Handles merged-record redirects. */
  private loadContact(): void {
    this.isLoading.set(true);
    this.contactService.getById(this.contactId).subscribe({
      next: (response: any) => {
        // Check if the response is a merged-record redirect
        if (response?.isMerged && response?.mergedIntoId) {
          this.snackBar.open(
            this.transloco.translate('messages.mergedRedirect'),
            this.transloco.translate('common.close'),
            { duration: 3000 }
          );
          this.router.navigate(['/contacts', response.mergedIntoId], {
            replaceUrl: true,
          });
          return;
        }
        this.contact.set(response);
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
    this.contactService.getTimeline(this.contactId).subscribe({
      next: (entries) => {
        this.timelineEntries.set(entries);
        this.timelineLoading.set(false);
      },
      error: () => {
        this.timelineLoading.set(false);
      },
    });
  }

  /** Handle tab change -- lazy load activities/quotes/requests/emails when tab is selected. */
  onTabChanged(label: string): void {
    if (label === 'Summary') {
      if (!this.summaryData() || this.summaryDirty()) {
        this.loadSummary();
      }
      return;
    }
    // Company tab data comes from the contact detail DTO itself.
    if (label === 'Activities') {
      this.loadLinkedActivities();
    }
    if (label === 'Quotes') {
      this.loadLinkedQuotes();
    }
    if (label === 'Requests') {
      this.loadLinkedRequests();
    }
    if (label === 'Emails') {
      this.loadContactEmails();
    }
    if (label === 'Notes') {
      this.loadContactNotes();
    }
  }

  /** Load activities linked to this contact (lazy on tab switch). */
  private loadLinkedActivities(): void {
    if (this.activitiesLoaded() || this.activitiesLoading()) return;

    this.activitiesLoading.set(true);
    this.activityService
      .getList({ linkedEntityType: 'Contact', linkedEntityId: this.contactId, page: 1, pageSize: 50 })
      .subscribe({
        next: (result) => {
          this.linkedActivities.set(result.items);
          this.activitiesLoading.set(false);
          this.activitiesLoaded.set(true);
        },
        error: () => {
          this.activitiesLoading.set(false);
        },
      });
  }

  /** Get status color for activity chip. */
  getStatusColor(status: string): string {
    return ACTIVITY_STATUSES.find(s => s.value === status)?.color ?? 'var(--color-text-muted)';
  }

  /** Get priority color for activity chip. */
  getPriorityColor(priority: string): string {
    return ACTIVITY_PRIORITIES.find(p => p.value === priority)?.color ?? 'var(--color-text-muted)';
  }

  /** Get quote status color. */
  getQuoteStatusColor(status: string): string {
    return QUOTE_STATUSES.find(s => s.value === status)?.color ?? 'var(--color-text-muted)';
  }

  /** Get request status color. */
  getRequestStatusColor(status: string): string {
    return REQUEST_STATUSES.find(s => s.value === status)?.color ?? 'var(--color-text-muted)';
  }

  /** Get request priority color. */
  getRequestPriorityColor(priority: string): string {
    return REQUEST_PRIORITIES.find(p => p.value === priority)?.color ?? 'var(--color-text-muted)';
  }

  /** Format currency value. */
  formatCurrency(value: number | null): string {
    if (value == null) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value);
  }

  /** Load quotes linked to this contact (lazy on tab switch). */
  private loadLinkedQuotes(): void {
    if (this.quotesLoaded() || this.quotesLoading()) return;

    this.quotesLoading.set(true);
    this.quoteService
      .getList({ filters: [{ fieldId: 'contactId', operator: 'eq', value: this.contactId }], page: 1, pageSize: 50 })
      .subscribe({
        next: (result) => {
          this.linkedQuotes.set(result.items);
          this.quotesLoading.set(false);
          this.quotesLoaded.set(true);
        },
        error: () => {
          this.quotesLoading.set(false);
        },
      });
  }

  /** Load requests linked to this contact (lazy on tab switch). */
  private loadLinkedRequests(): void {
    if (this.requestsLoaded() || this.requestsLoading()) return;

    this.requestsLoading.set(true);
    this.requestService
      .getList({ filters: [{ fieldId: 'contactId', operator: 'eq', value: this.contactId }], page: 1, pageSize: 50 })
      .subscribe({
        next: (result) => {
          this.linkedRequests.set(result.items);
          this.requestsLoading.set(false);
          this.requestsLoaded.set(true);
        },
        error: () => {
          this.requestsLoading.set(false);
        },
      });
  }

  /** Load emails linked to this contact (lazy on tab switch). */
  private loadContactEmails(): void {
    if (this.emailsLoaded() || this.emailsLoading()) return;

    this.emailsLoading.set(true);
    this.emailService
      .getByContact(this.contactId, { pageSize: 20, sortField: 'sentAt', sortDirection: 'desc' })
      .subscribe({
        next: (result) => {
          this.contactEmails.set(result.items);
          this.emailsLoading.set(false);
          this.emailsLoaded.set(true);
        },
        error: () => {
          this.emailsLoading.set(false);
        },
      });
  }

  /** Load notes linked to this contact (lazy on tab switch). */
  private loadContactNotes(): void {
    if (this.notesLoaded() || this.notesLoading()) return;

    this.notesLoading.set(true);
    this.noteService
      .getEntityNotes('Contact', this.contactId)
      .subscribe({
        next: (notes) => {
          this.contactNotes.set(notes);
          this.notesLoading.set(false);
          this.notesLoaded.set(true);
        },
        error: () => {
          this.notesLoading.set(false);
        },
      });
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

  /** Format email date for display. */
  formatEmailDate(dateStr: string): string {
    if (!dateStr) return '';
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(dateStr));
  }

  /** Handle association chip click -- switch to the corresponding tab. */
  onAssociationClicked(label: string): void {
    const index = CONTACT_TABS.findIndex(t => t.label === label);
    if (index >= 0) {
      this.activeTabIndex.set(index);
    }
  }

  /** Quick action: Add Note via dialog. */
  onSummaryAddNote(): void {
    const dialogRef = this.dialog.open(EntityFormDialogComponent, {
      width: '700px',
      data: {
        entityType: 'Note',
        prefill: {
          entityType: 'Contact',
          entityId: this.contactId,
          entityName: this.contact()?.fullName,
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
          entityType: 'Contact',
          entityId: this.contactId,
          entityName: this.contact()?.fullName,
        },
      } as EntityFormDialogData,
    });
    dialogRef.afterClosed().subscribe((result: EntityFormDialogResult | undefined) => {
      if (result?.entity) {
        this.loadSummary();
      }
    });
  }

  /** Quick action: Send Email for this contact. */
  onSummarySendEmail(): void {
    // Navigate to email compose with contact pre-filled
    // For now, this opens the email compose route
    this.router.navigate(['/emails/compose'], {
      queryParams: {
        contactId: this.contactId,
        contactName: this.contact()?.fullName,
        email: this.contact()?.email,
      },
    });
  }

  /** Open sequence picker and enroll this contact in the selected sequence. */
  enrollInSequence(): void {
    if (!this.contactId) return;

    // Lazy import to avoid eagerly loading sequence module
    import('../../sequences/sequence-picker-dialog/sequence-picker-dialog.component').then(
      ({ SequencePickerDialogComponent }) => {
        const dialogRef = this.dialog.open(SequencePickerDialogComponent, {
          width: '500px',
          maxHeight: '80vh',
        });

        dialogRef.afterClosed().subscribe((selectedSequence: SequenceListItem | undefined) => {
          if (!selectedSequence) return;

          this.sequenceService
            .enrollContact(selectedSequence.id, { contactId: this.contactId })
            .subscribe({
              next: () => {
                this.snackBar.open(
                  this.transloco.translate('messages.enrolledInSequence', { name: selectedSequence.name }),
                  this.transloco.translate('common.close'),
                  { duration: 3000 },
                );
                this.markSummaryDirty();
              },
              error: (err) => {
                this.snackBar.open(
                  err?.message ?? this.transloco.translate('messages.enrollFailed'),
                  this.transloco.translate('common.close'),
                  { duration: 5000 },
                );
              },
            });
        });
      },
    );
  }

  /** Get initials from contact full name for avatar display. */
  getInitials(): string {
    const name = this.contact()?.fullName ?? '';
    const words = name.trim().split(/\s+/);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  /** Handle delete with confirmation dialog. */
  onDelete(): void {
    const contact = this.contact();
    if (!contact) return;

    const dialogRef = this.dialog.open(ConfirmDeleteDialogComponent, {
      width: '400px',
      data: { name: contact.fullName, type: 'contact' },
    });

    dialogRef.afterClosed().subscribe((confirmed: boolean) => {
      if (confirmed) {
        this.contactService.delete(this.contactId).subscribe({
          next: () => {
            this.router.navigate(['/contacts']);
          },
          error: () => {
            // Error is handled by ApiService interceptor
          },
        });
      }
    });
  }
}
